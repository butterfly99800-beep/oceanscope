import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { calculateBookingTotal, centsToDecimal } from "@/features/orders/server/calculate-booking-total";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";
import { rateInclude } from "@/features/rates/server/rate-mapper";

const containerSchema = z.object({ type: z.string(), quantity: z.coerce.number().int().positive() });
const servicesSchema = z.object({ exportCustoms: z.boolean().default(false), importCustoms: z.boolean().default(false), pickup: z.boolean().default(false), delivery: z.boolean().default(false), insurance: z.enum(["none", "basic", "premium"]).default("none"), freeDays: z.enum(["standard", "plus5", "plus10", "plus15"]).default("standard") });
const bookingSchema = z.object({
  rateOptionId: z.string().optional(),
  rateQuoteIds: z.array(z.string()).min(1),
  originPortId: z.string().min(1),
  destinationPortId: z.string().min(1),
  carrierId: z.string().min(1),
  routeId: z.string().optional().nullable(),
  readyDate: z.coerce.date(),
  cargoType: z.enum(["general", "dangerous"]),
  containers: z.array(containerSchema).min(1),
  services: servicesSchema,
  subtotal: z.coerce.number().optional(),
  tax: z.coerce.number().optional(),
  total: z.coerce.number().optional(),
  currency: z.literal("USD").default("USD"),
  notes: z.string().optional(),
});

function containerSelection(containers: Array<z.infer<typeof containerSchema>>) {
  return { "20GP": 0, "40GP": 0, "40HC": 0, "45HC": 0, ...Object.fromEntries(containers.map((item) => [item.type, item.quantity])) };
}

function stamp(date = new Date()) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

async function nextBookingNumber(tx: Prisma.TransactionClient) {
  const today = stamp();
  const count = await tx.bookingOrder.count({ where: { bookingNumber: { startsWith: `OCS-${today}` } } });
  return `OCS-${today}-${String(count + 1).padStart(4, "0")}`;
}

async function createWithRetry(data: z.infer<typeof bookingSchema>) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const quotes = await tx.rateQuote.findMany({ where: { id: { in: data.rateQuoteIds } }, include: rateInclude });
        if (quotes.length !== data.rateQuoteIds.length) throw new Error("QUOTE_NOT_FOUND");
        const now = new Date();
        for (const quote of quotes) {
          if (quote.status !== "ACTIVE" || quote.validUntil < now) throw new Error("QUOTE_EXPIRED");
          if (quote.originPortId !== data.originPortId || quote.destinationPortId !== data.destinationPortId || quote.carrierId !== data.carrierId) throw new Error("QUOTE_MISMATCH");
        }
        const first = quotes[0];
        const calculation = calculateBookingTotal({ quotes, containers: containerSelection(data.containers), cargoType: data.cargoType, services: data.services });
        const bookingNumber = await nextBookingNumber(tx);
        const order = await tx.bookingOrder.create({ data: {
          bookingNumber,
          status: "PENDING_CONFIRMATION",
          originPortId: data.originPortId,
          destinationPortId: data.destinationPortId,
          carrierId: data.carrierId,
          routeId: data.routeId || first.routeId,
          rateQuoteId: first.id,
          serviceName: first.serviceName,
          transportMode: first.transportMode,
          cargoType: data.cargoType,
          readyDate: data.readyDate,
          vesselName: first.vesselName,
          voyageNumber: first.voyageNumber,
          etd: first.etd,
          eta: first.eta,
          transitDays: first.transitDays,
          stopCount: first.stopCount,
          currency: "USD",
          subtotal: centsToDecimal(calculation.subtotal),
          tax: centsToDecimal(calculation.tax),
          total: centsToDecimal(calculation.total),
          quoteValidUntil: first.validUntil,
          notes: data.notes,
          containers: { create: calculation.containerItems.map((item) => ({ containerType: item.containerType, quantity: item.quantity, unitPrice: centsToDecimal(item.unitPrice), subtotal: centsToDecimal(item.subtotal) })) },
          services: { create: calculation.serviceItems.map((item) => ({ code: item.code, name: item.name, quantity: item.quantity, unitPrice: centsToDecimal(item.unitPrice), subtotal: centsToDecimal(item.subtotal) })) },
          costItems: { create: calculation.costItems.map((item) => ({ category: item.category, code: item.code, name: item.name, quantity: item.quantity, unitPrice: centsToDecimal(item.unitPrice), subtotal: centsToDecimal(item.subtotal), currency: "USD" })) },
          timeline: { create: [
            { status: "PENDING_CONFIRMATION", title: "Booking submitted", description: "Simulated booking was submitted to OceanScope.", occurredAt: now },
            { status: "PENDING_CONFIRMATION", title: "Waiting for confirmation", description: "The platform is reviewing this simulated booking.", occurredAt: now },
          ] },
        }, include: orderInclude });
        return order;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("BOOKING_NUMBER_CONFLICT");
}

export async function POST(request: Request) {
  try {
    const parsed = bookingSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid request", 400);
    const order = await createWithRetry(parsed.data);
    return jsonData(mapOrder(order), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "QUOTE_NOT_FOUND") return jsonError("RATE_NOT_FOUND", "Rate quote not found", 404);
    if (message === "QUOTE_EXPIRED") return jsonError("CONFLICT", "Rate quote has expired", 409);
    if (message === "QUOTE_MISMATCH") return jsonError("CONFLICT", "Rate quote does not match route or carrier", 409);
    if (message === "BOOKING_NUMBER_CONFLICT") return jsonError("CONFLICT", "Booking number conflict, please retry", 409);
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("UNKNOWN_ERROR", "Failed to create booking", 500);
  }
}
