import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/authorization";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  try {
    const { id } = await params;
    const order = await prisma.bookingOrder.findFirst({ where: { OR: [{ id }, { bookingNumber: id }] }, include: orderInclude });
    if (!order) return jsonError("ORDER_NOT_FOUND", "Order not found", 404);
    return jsonData(mapOrder(order));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to load order", 500);
  }
}