import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonList, parsePagination, validationError } from "@/features/admin/server/api-utils";
import { containerValues, ensureRateRelations, rateData, rateSchema, replaceRateLineItems, statusValues } from "@/features/rates/server/admin-rate-api";
import { mapAdminRate, rateInclude } from "@/features/rates/server/rate-mapper";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const direct = searchParams.get("direct");
    const sortBy = searchParams.get("sortBy") ?? "updatedAt";
    const sortable = new Set(["effectiveFrom", "validUntil", "etd", "eta", "totalBasePrice", "updatedAt", "transitDays", "reliability"]);
    const where: Prisma.RateQuoteWhereInput = {
      ...(status && statusValues[status] ? { status: statusValues[status] } : {}),
      ...(searchParams.get("carrierId") ? { carrierId: searchParams.get("carrierId") ?? undefined } : {}),
      ...(searchParams.get("originPortId") ? { originPortId: searchParams.get("originPortId") ?? undefined } : {}),
      ...(searchParams.get("destinationPortId") ? { destinationPortId: searchParams.get("destinationPortId") ?? undefined } : {}),
      ...(searchParams.get("containerType") && containerValues[searchParams.get("containerType") ?? ""] ? { containerType: containerValues[searchParams.get("containerType") ?? ""] } : {}),
      ...(direct === "true" ? { direct: true } : direct === "false" ? { direct: false } : {}),
      ...((searchParams.get("effectiveFrom") || searchParams.get("validUntil")) ? { effectiveFrom: { ...(searchParams.get("effectiveFrom") ? { gte: new Date(searchParams.get("effectiveFrom") ?? "") } : {}), ...(searchParams.get("validUntil") ? { lte: new Date(searchParams.get("validUntil") ?? "") } : {}) } } : {}),
      ...(search ? { OR: [{ serviceName: { contains: search } }, { vesselName: { contains: search } }, { voyageNumber: { contains: search } }, { carrier: { name: { contains: search } } }, { originPort: { name: { contains: search } } }, { destinationPort: { name: { contains: search } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.rateQuote.findMany({ where, include: rateInclude, skip, take: pageSize, orderBy: { [sortable.has(sortBy) ? sortBy : "updatedAt"]: sortOrder } }),
      prisma.rateQuote.count({ where }),
    ]);
    return jsonList(items.map(mapAdminRate), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) { return handlePrismaError(error); }
}

export async function POST(request: Request) {
  try {
    const parsed = rateSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const relationError = await ensureRateRelations(parsed.data);
    if (relationError) return relationError;
    const created = await prisma.rateQuote.create({ data: rateData(parsed.data) });
    await replaceRateLineItems(created.id, parsed.data);
    const full = await prisma.rateQuote.findUniqueOrThrow({ where: { id: created.id }, include: rateInclude });
    return jsonData(mapAdminRate(full), { status: 201 });
  } catch (error) { return handlePrismaError(error); }
}
