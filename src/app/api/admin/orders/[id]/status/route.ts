import { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";

const schema = z.object({ status: z.enum(["PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "COMPLETED"]) });
const allowed: Record<BookingStatus, BookingStatus[]> = { PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["COMPLETED", "CANCELLED"], CANCELLED: [], COMPLETED: [] };

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return jsonError("BAD_REQUEST", "Invalid status", 400);
    const now = new Date();
    const order = await prisma.$transaction(async (tx) => {
      const current = await tx.bookingOrder.findUnique({ where: { id } });
      if (!current) throw new Error("ORDER_NOT_FOUND");
      if (!allowed[current.status].includes(parsed.data.status)) throw new Error("INVALID_STATUS_CHANGE");
      await tx.bookingOrder.update({ where: { id }, data: { status: parsed.data.status, confirmedAt: parsed.data.status === "CONFIRMED" ? now : current.confirmedAt, cancelledAt: parsed.data.status === "CANCELLED" ? now : current.cancelledAt } });
      await tx.bookingTimeline.create({ data: { orderId: id, status: parsed.data.status, title: `Status changed to ${parsed.data.status}`, description: "Updated from admin console.", occurredAt: now } });
      return tx.bookingOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
    });
    return jsonData(mapOrder(order));
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN";
    if (message === "ORDER_NOT_FOUND") return jsonError("ORDER_NOT_FOUND", "Order not found", 404);
    if (message === "INVALID_STATUS_CHANGE") return jsonError("CONFLICT", "Invalid status transition", 409);
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to update order status", 500);
  }
}