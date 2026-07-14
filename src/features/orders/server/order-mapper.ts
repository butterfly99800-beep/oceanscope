import type { BookingOrder as PrismaBookingOrder, Prisma } from "@prisma/client";
import type { BookingOrder, OrderCostLineItem, OrderTimelineItem } from "@/features/orders/types";

export const orderInclude = {
  originPort: true,
  destinationPort: true,
  carrier: true,
  route: true,
  rateQuote: true,
  containers: true,
  services: true,
  costItems: true,
  timeline: { orderBy: { occurredAt: "asc" as const } },
};

export type OrderWithRelations = Prisma.BookingOrderGetPayload<{ include: typeof orderInclude }>;

function cents(value: Prisma.Decimal | number | string) {
  return Math.round(Number(value) * 100);
}

function statusLabel(status: PrismaBookingOrder["status"]) {
  if (status === "CONFIRMED") return "CONFIRMED";
  if (status === "CANCELLED") return "CANCELLED";
  if (status === "COMPLETED") return "COMPLETED";
  return "PENDING_CONFIRMATION";
}

function date(value: Date) {
  return value.toISOString().slice(0, 10);
}

function mapContainers(order: OrderWithRelations) {
  return Object.fromEntries(order.containers.map((item) => [item.containerType, item.quantity]));
}

function mapCosts(order: OrderWithRelations): OrderCostLineItem[] {
  return order.costItems.map((item) => ({ category: item.category, name: item.name, unitPrice: cents(item.unitPrice), quantity: item.quantity, subtotal: cents(item.subtotal) }));
}

function mapTimeline(order: OrderWithRelations): OrderTimelineItem[] {
  return order.timeline.map((item) => ({ title: item.title, description: item.description ?? "", timestamp: item.occurredAt.toISOString() }));
}

export function mapOrder(order: OrderWithRelations): BookingOrder {
  return {
    orderId: order.id,
    bookingNumber: order.bookingNumber,
    createdAt: order.createdAt.toISOString(),
    status: statusLabel(order.status),
    origin: order.originPort.name,
    destination: order.destinationPort.name,
    originPortCode: order.originPort.locode,
    destinationPortCode: order.destinationPort.locode,
    carrier: order.carrier.name,
    serviceName: order.serviceName,
    transportMode: order.transportMode,
    vesselName: order.vesselName,
    voyageNumber: order.voyageNumber,
    etd: date(order.etd),
    eta: date(order.eta),
    transitDays: order.transitDays,
    stops: order.stopCount,
    containerSelections: mapContainers(order),
    cargoType: order.cargoType === "dangerous" ? "dangerous" : "general",
    readyDate: date(order.readyDate),
    selectedAdditionalServices: order.services.map((item) => item.name),
    insuranceOption: order.services.find((item) => item.code.startsWith("INSURANCE"))?.code ?? "none",
    additionalFreeDays: order.services.find((item) => item.code.startsWith("FREE_DAYS"))?.code ?? "standard",
    costLineItems: mapCosts(order),
    subtotal: cents(order.subtotal),
    tax: cents(order.tax),
    total: cents(order.total),
    currency: "USD",
    quoteValidUntil: date(order.quoteValidUntil),
    timeline: mapTimeline(order),
  };
}

export function mapAdminOrder(order: OrderWithRelations) {
  const containers = order.containers.map((item) => `${item.quantity} x ${item.containerType}`).join(" / ");
  return {
    id: order.id,
    bookingNumber: order.bookingNumber,
    createdAt: order.createdAt.toISOString().slice(0, 16),
    origin: order.originPort.name,
    destination: order.destinationPort.name,
    originPortId: order.originPortId,
    destinationPortId: order.destinationPortId,
    carrier: order.carrier.name,
    carrierId: order.carrierId,
    containers,
    quantity: order.containers.reduce((sum, item) => sum + item.quantity, 0),
    total: Number(order.total),
    currency: order.currency,
    status: statusLabel(order.status),
    updatedAt: order.updatedAt.toISOString().slice(0, 10),
  };
}
