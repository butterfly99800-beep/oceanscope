import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // TODO: Filter by current user after authentication is added.
    const order = await prisma.bookingOrder.findFirst({ where: { OR: [{ id }, { bookingNumber: id }] }, include: orderInclude });
    if (!order) return jsonError("ORDER_NOT_FOUND", "Order not found", 404);
    return jsonData(mapOrder(order));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to load order", 500);
  }
}