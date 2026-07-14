import { ContainerType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { centsFromDecimal, mapRateOption, rateInclude, type RateQuoteWithRelations } from "@/features/rates/server/rate-mapper";
import type { CostLineItem, RateOption, RateTag } from "@/features/rates/types";

const containerMap: Record<string, ContainerType> = { "20GP": "TWENTY_GP", "40GP": "FORTY_GP", "40HC": "FORTY_HC", "45HC": "FORTY_FIVE_HC", TWENTY_GP: "TWENTY_GP", FORTY_GP: "FORTY_GP", FORTY_HC: "FORTY_HC", FORTY_FIVE_HC: "FORTY_FIVE_HC" };
const categoryMap = { BASE: "基础费用", ORIGIN: "起运地费用", DESTINATION: "目的地费用", SURCHARGE: "其他费用", OPTIONAL: "其他费用" } as const;

type SelectedContainer = { type: ContainerType; quantity: number };

type Group = { first: RateQuoteWithRelations; byType: Map<ContainerType, RateQuoteWithRelations> };

const searchSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  readyDate: z.coerce.date(),
  transportMode: z.string().optional(),
  cargoType: z.enum(["general", "dangerous"]).default("general"),
  containers: z.array(z.object({ type: z.string(), quantity: z.coerce.number().int().positive() })).min(1),
  filters: z.object({ stops: z.string().optional(), carriers: z.array(z.string()).optional(), maxPrice: z.number().optional(), maxTransitDays: z.number().optional(), minFreeDays: z.number().optional(), minReliability: z.number().optional(), departureFrom: z.string().optional() }).optional(),
  sort: z.string().optional(),
});

async function resolvePortId(value: string) {
  const query = value.trim();
  const port = await prisma.port.findFirst({ where: { OR: [{ id: query }, { locode: query.toUpperCase() }, { name: query }, { nameZh: query }, { name: { contains: query } }, { nameZh: { contains: query } }] } });
  return port?.id;
}

function groupKey(quote: RateQuoteWithRelations) {
  return [quote.carrierId, quote.serviceName, quote.etd.toISOString(), quote.eta.toISOString(), quote.vesselName, quote.voyageNumber].join("|");
}

function addLineItem(items: Map<string, CostLineItem>, category: CostLineItem["category"], name: string, unitPrice: number, quantity: number) {
  const key = `${category}|${name}|${unitPrice}`;
  const existing = items.get(key);
  const subtotal = unitPrice * quantity;
  if (existing) items.set(key, { ...existing, quantity: existing.quantity + quantity, subtotal: existing.subtotal + subtotal });
  else items.set(key, { category, name, unitPrice, quantity, subtotal });
}

function aggregate(group: Group, containers: SelectedContainer[], isDangerous: boolean): RateOption | null {
  let baseFreight = 0;
  let surcharges = 0;
  let totalPrice = 0;
  const lineItems = new Map<string, CostLineItem>();
  for (const container of containers) {
    const quote = group.byType.get(container.type);
    if (!quote) return null;
    baseFreight += centsFromDecimal(quote.baseFreight) * container.quantity;
    const quoteTotal = centsFromDecimal(quote.totalBasePrice) * container.quantity;
    totalPrice += quoteTotal;
    surcharges += quoteTotal - centsFromDecimal(quote.baseFreight) * container.quantity;
    for (const item of quote.lineItems) {
      if (item.code === "DG" && !isDangerous) continue;
      const quantity = item.unit === "PER_SHIPMENT" ? 1 : container.quantity;
      addLineItem(lineItems, categoryMap[item.category], item.name, centsFromDecimal(item.unitPrice), quantity);
    }
  }
  const tags: RateTag[] = [];
  if (group.first.direct) tags.push("直达");
  if (group.first.reliability >= 94) tags.push("推荐");
  if (group.first.transitDays <= 14) tags.push("最快");
  if (totalPrice <= 320000) tags.push("最低价");
  return mapRateOption(group.first, { id: `rate-${group.first.id}`, baseFreight, surcharges, totalPrice, fixedLineItems: Array.from(lineItems.values()), tags: tags.length ? tags : ["推荐"] });
}

function sortOptions(options: RateOption[], sort?: string) {
  return [...options].sort((a, b) => {
    if (sort === "price") return a.totalPrice - b.totalPrice;
    if (sort === "fastest") return a.transitDays - b.transitDays;
    if (sort === "earliestDeparture") return a.etd.localeCompare(b.etd);
    if (sort === "earliestArrival") return a.eta.localeCompare(b.eta);
    return Number(b.tags.includes("推荐")) - Number(a.tags.includes("推荐")) || a.totalPrice - b.totalPrice;
  });
}

export async function POST(request: Request) {
  try {
    const parsed = searchSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "参数格式错误", 400);
    const [originPortId, destinationPortId] = await Promise.all([resolvePortId(parsed.data.origin), resolvePortId(parsed.data.destination)]);
    if (!originPortId || !destinationPortId) return jsonData([]);
    const containers = parsed.data.containers.map((item) => ({ type: containerMap[item.type], quantity: item.quantity })).filter((item): item is SelectedContainer => Boolean(item.type));
    if (!containers.length) return jsonError("BAD_REQUEST", "箱型不合法", 400);
    const readyDate = parsed.data.readyDate;
    const where: Prisma.RateQuoteWhereInput = {
      originPortId,
      destinationPortId,
      status: "ACTIVE",
      effectiveFrom: { lte: readyDate },
      validUntil: { gte: readyDate },
      containerType: { in: containers.map((item) => item.type) },
      ...(parsed.data.filters?.stops === "direct" ? { direct: true } : parsed.data.filters?.stops === "one" ? { stopCount: 1 } : parsed.data.filters?.stops === "two" ? { stopCount: { gte: 2 } } : {}),
      ...(parsed.data.filters?.carriers?.length ? { carrier: { name: { in: parsed.data.filters.carriers } } } : {}),
      ...(parsed.data.filters?.maxTransitDays ? { transitDays: { lte: parsed.data.filters.maxTransitDays } } : {}),
      ...(parsed.data.filters?.minFreeDays ? { freeDays: { gte: parsed.data.filters.minFreeDays } } : {}),
      ...(parsed.data.filters?.minReliability ? { reliability: { gte: parsed.data.filters.minReliability } } : {}),
      ...(parsed.data.filters?.departureFrom ? { etd: { gte: new Date(parsed.data.filters.departureFrom) } } : {}),
    };
    const quotes = await prisma.rateQuote.findMany({ where, include: rateInclude, orderBy: { totalBasePrice: "asc" } });
    const groups = new Map<string, Group>();
    quotes.forEach((quote) => {
      const key = groupKey(quote);
      const existing = groups.get(key) ?? { first: quote, byType: new Map<ContainerType, RateQuoteWithRelations>() };
      existing.byType.set(quote.containerType, quote);
      groups.set(key, existing);
    });
    const options = Array.from(groups.values()).map((group) => aggregate(group, containers, parsed.data.cargoType === "dangerous")).filter((item): item is RateOption => Boolean(item));
    const filtered = parsed.data.filters?.maxPrice ? options.filter((option) => option.totalPrice / 100 <= Number(parsed.data.filters?.maxPrice)) : options;
    return jsonData(sortOptions(filtered, parsed.data.sort));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "运价查询失败，请稍后重试", 500);
  }
}
