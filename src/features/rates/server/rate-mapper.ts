import type { Prisma, RateChargeCategory, RateStatus, TransportMode } from "@prisma/client";
import type { CostLineItem, RateOption, RateTag, TransportMode as UiTransportMode } from "@/features/rates/types";

export const rateInclude = {
  carrier: true,
  route: { include: { transitPorts: { include: { port: true }, orderBy: { sequence: "asc" as const } } } },
  originPort: true,
  destinationPort: true,
  lineItems: true,
};

export type RateQuoteWithRelations = Prisma.RateQuoteGetPayload<{ include: typeof rateInclude }>;

const transportModeLabels: Record<TransportMode, UiTransportMode> = {
  FCL: "整箱海运",
  LCL: "整箱海运",
  AIR: "整箱海运",
};

const statusLabels: Record<RateStatus, string> = {
  ACTIVE: "启用",
  EXPIRED: "已过期",
  INACTIVE: "停用",
};

const categoryLabels: Record<RateChargeCategory, CostLineItem["category"]> = {
  BASE: "基础费用",
  ORIGIN: "起运地费用",
  DESTINATION: "目的地费用",
  SURCHARGE: "其他费用",
  OPTIONAL: "其他费用",
};

function cents(value: Prisma.Decimal | number | string) {
  return Math.round(Number(value) * 100);
}

function date(value: Date) {
  return value.toISOString().slice(0, 10);
}

function tagsFor(quote: RateQuoteWithRelations): RateTag[] {
  const tags: RateTag[] = [];
  if (quote.direct) tags.push("直达");
  if (quote.reliability >= 94) tags.push("推荐");
  if (quote.transitDays <= 14) tags.push("最快");
  if (Number(quote.totalBasePrice) <= 3200) tags.push("最低价");
  return tags.length ? tags : ["推荐"];
}

export function mapAdminRate(quote: RateQuoteWithRelations) {
  return {
    id: quote.id,
    carrierId: quote.carrierId,
    carrier: quote.carrier.name,
    routeId: quote.routeId ?? "",
    originPortId: quote.originPortId,
    origin: quote.originPort.name,
    destinationPortId: quote.destinationPortId,
    destination: quote.destinationPort.name,
    serviceName: quote.serviceName,
    transportMode: quote.transportMode,
    containerType: quote.containerType,
    currency: quote.currency,
    baseFreight: Number(quote.baseFreight),
    fuelSurcharge: Number(quote.fuelSurcharge),
    terminalHandlingCharge: Number(quote.terminalHandlingCharge),
    documentationFee: Number(quote.documentationFee),
    bookingFee: Number(quote.bookingFee),
    dangerousGoodsSurcharge: Number(quote.dangerousGoodsSurcharge),
    otherSurcharge: Number(quote.otherSurcharge),
    totalBasePrice: Number(quote.totalBasePrice),
    effectiveFrom: quote.effectiveFrom.toISOString().slice(0, 16),
    validUntil: quote.validUntil.toISOString().slice(0, 16),
    transitDays: quote.transitDays,
    direct: quote.direct ? "直达" : "中转",
    stopCount: quote.stopCount,
    vesselName: quote.vesselName,
    voyageNumber: quote.voyageNumber,
    etd: quote.etd.toISOString().slice(0, 16),
    eta: quote.eta.toISOString().slice(0, 16),
    cutOffDate: quote.cutOffDate.toISOString().slice(0, 16),
    freeDays: quote.freeDays,
    reliability: quote.reliability,
    status: statusLabels[quote.status],
    updatedAt: quote.updatedAt.toISOString().slice(0, 10),
  };
}

export function mapRateOption(quote: RateQuoteWithRelations, override?: { id?: string; baseFreight?: number; surcharges?: number; totalPrice?: number; fixedLineItems?: CostLineItem[]; tags?: RateTag[] }): RateOption {
  const lineItems = override?.fixedLineItems ?? quote.lineItems.map((item) => ({
    category: categoryLabels[item.category],
    name: item.name,
    unitPrice: cents(item.unitPrice),
    quantity: 1,
    subtotal: cents(item.unitPrice),
  }));
  return {
    id: override?.id ?? quote.id,
    carrier: quote.carrier.name,
    serviceName: quote.serviceName,
    transportMode: transportModeLabels[quote.transportMode],
    origin: quote.originPort.name,
    destination: quote.destinationPort.name,
    originPortCode: quote.originPort.locode,
    destinationPortCode: quote.destinationPort.locode,
    transitPorts: quote.route?.transitPorts.map((item) => item.port.name) ?? [],
    etd: date(quote.etd),
    eta: date(quote.eta),
    transitDays: quote.transitDays,
    direct: quote.direct,
    stops: quote.stopCount,
    vesselName: quote.vesselName,
    voyageNumber: quote.voyageNumber,
    cutOffDate: date(quote.cutOffDate),
    validUntil: date(quote.validUntil),
    reliability: quote.reliability,
    baseFreight: override?.baseFreight ?? cents(quote.baseFreight),
    surcharges: override?.surcharges ?? cents(quote.totalBasePrice) - cents(quote.baseFreight),
    totalPrice: override?.totalPrice ?? cents(quote.totalBasePrice),
    currency: "USD",
    freeDays: quote.freeDays,
    tags: override?.tags ?? tagsFor(quote),
    fixedLineItems: lineItems,
    expired: quote.status === "EXPIRED" || quote.validUntil.getTime() < Date.now(),
  };
}

export function centsFromDecimal(value: Prisma.Decimal | number | string) {
  return cents(value);
}
