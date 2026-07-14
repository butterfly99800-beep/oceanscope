import { ContainerType, Prisma, RateStatus, TransportMode } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/features/admin/server/api-utils";

export const statusValues: Record<string, RateStatus> = { 启用: "ACTIVE", 已过期: "EXPIRED", 停用: "INACTIVE", ACTIVE: "ACTIVE", EXPIRED: "EXPIRED", INACTIVE: "INACTIVE" };
export const transportValues: Record<string, TransportMode> = { FCL: "FCL", LCL: "LCL", AIR: "AIR", 整箱海运: "FCL", 拼箱海运: "LCL", 空运: "AIR" };
export const containerValues: Record<string, ContainerType> = { TWENTY_GP: "TWENTY_GP", FORTY_GP: "FORTY_GP", FORTY_HC: "FORTY_HC", FORTY_FIVE_HC: "FORTY_FIVE_HC", "20GP": "TWENTY_GP", "40GP": "FORTY_GP", "40HC": "FORTY_HC", "45HC": "FORTY_FIVE_HC" };

export const rateSchema = z.object({
  carrierId: z.string().min(1, "船公司必填"),
  routeId: z.string().optional().or(z.literal("")),
  originPortId: z.string().min(1, "起运港必填"),
  destinationPortId: z.string().min(1, "目的港必填"),
  serviceName: z.string().min(1, "Service 必填"),
  transportMode: z.string().transform((value) => transportValues[value] ?? "FCL"),
  containerType: z.string().transform((value, context) => { const mapped = containerValues[value]; if (!mapped) context.addIssue({ code: "custom", message: "箱型不合法" }); return mapped ?? "FORTY_GP"; }),
  currency: z.string().trim().regex(/^[A-Z]{3}$/, "币种必须为 3 位大写字母").default("USD"),
  baseFreight: z.coerce.number().min(0),
  fuelSurcharge: z.coerce.number().min(0),
  terminalHandlingCharge: z.coerce.number().min(0),
  documentationFee: z.coerce.number().min(0),
  bookingFee: z.coerce.number().min(0),
  dangerousGoodsSurcharge: z.coerce.number().min(0).default(0),
  otherSurcharge: z.coerce.number().min(0).default(0),
  totalBasePrice: z.coerce.number().min(0),
  effectiveFrom: z.coerce.date(),
  validUntil: z.coerce.date(),
  transitDays: z.coerce.number().int().positive(),
  direct: z.coerce.boolean().default(false),
  stopCount: z.coerce.number().int().min(0).default(0),
  vesselName: z.string().min(1, "船名必填"),
  voyageNumber: z.string().min(1, "航次必填"),
  etd: z.coerce.date(),
  eta: z.coerce.date(),
  cutOffDate: z.coerce.date(),
  freeDays: z.coerce.number().int().min(0).default(7),
  reliability: z.coerce.number().int().min(0).max(100),
  status: z.string().transform((value) => statusValues[value] ?? "ACTIVE"),
}).superRefine((value, context) => {
  if (value.originPortId === value.destinationPortId) context.addIssue({ code: "custom", message: "起运港不能等于目的港", path: ["destinationPortId"] });
  if (value.effectiveFrom > value.validUntil) context.addIssue({ code: "custom", message: "生效日期不能晚于失效日期", path: ["validUntil"] });
  if (value.etd >= value.eta) context.addIssue({ code: "custom", message: "ETD 必须早于 ETA", path: ["eta"] });
});

export type RateInput = z.infer<typeof rateSchema>;

export async function ensureRateRelations(data: RateInput) {
  const [carrier, origin, destination, route] = await Promise.all([
    prisma.carrier.findUnique({ where: { id: data.carrierId } }),
    prisma.port.findUnique({ where: { id: data.originPortId } }),
    prisma.port.findUnique({ where: { id: data.destinationPortId } }),
    data.routeId ? prisma.route.findUnique({ where: { id: data.routeId } }) : Promise.resolve(null),
  ]);
  if (!carrier) return jsonError("CARRIER_NOT_FOUND", "船公司不存在", 400);
  if (!origin || !destination) return jsonError("PORT_NOT_FOUND", "起运港或目的港不存在", 400);
  if (data.routeId && !route) return jsonError("ROUTE_NOT_FOUND", "航线不存在", 400);
  return null;
}

export function rateData(data: RateInput): Prisma.RateQuoteUncheckedCreateInput {
  return {
    carrierId: data.carrierId,
    routeId: data.routeId || null,
    originPortId: data.originPortId,
    destinationPortId: data.destinationPortId,
    serviceName: data.serviceName,
    transportMode: data.transportMode,
    containerType: data.containerType,
    currency: data.currency,
    baseFreight: data.baseFreight,
    fuelSurcharge: data.fuelSurcharge,
    terminalHandlingCharge: data.terminalHandlingCharge,
    documentationFee: data.documentationFee,
    bookingFee: data.bookingFee,
    dangerousGoodsSurcharge: data.dangerousGoodsSurcharge,
    otherSurcharge: data.otherSurcharge,
    totalBasePrice: data.totalBasePrice,
    effectiveFrom: data.effectiveFrom,
    validUntil: data.validUntil,
    transitDays: data.transitDays,
    direct: data.direct,
    stopCount: data.stopCount,
    vesselName: data.vesselName,
    voyageNumber: data.voyageNumber,
    etd: data.etd,
    eta: data.eta,
    cutOffDate: data.cutOffDate,
    freeDays: data.freeDays,
    reliability: data.reliability,
    status: data.status,
  };
}

export async function replaceRateLineItems(rateQuoteId: string, data: RateInput) {
  await prisma.rateLineItem.deleteMany({ where: { rateQuoteId } });
  const items = [
    ["BASE", "OCEAN_FREIGHT", "Ocean Freight", "PER_CONTAINER", data.baseFreight],
    ["SURCHARGE", "FUEL", "Fuel Surcharge", "PER_SHIPMENT", data.fuelSurcharge],
    ["ORIGIN", "THC", "Terminal Handling Charge", "PER_CONTAINER", data.terminalHandlingCharge],
    ["BASE", "DOC", "Documentation Fee", "PER_SHIPMENT", data.documentationFee],
    ["BASE", "BOOKING", "Booking Fee", "PER_SHIPMENT", data.bookingFee],
    ["SURCHARGE", "DG", "Dangerous Goods Surcharge", "PER_CONTAINER", data.dangerousGoodsSurcharge],
    ["SURCHARGE", "OTHER", "Other Surcharge", "PER_SHIPMENT", data.otherSurcharge],
  ] as const;
  await prisma.rateLineItem.createMany({ data: items.filter(([, , , , amount]) => amount > 0).map(([category, code, name, unit, unitPrice]) => ({ rateQuoteId, category, code, name, unit, unitPrice, currency: data.currency, required: true })) });
}
