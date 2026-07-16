import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";
import { requireUserForApi } from "@/lib/authorization";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireUserForApi();
    if (auth.response) return auth.response;
    const currentUser = auth.user;
    if (!currentUser) return jsonError("UNAUTHORIZED", "Please sign in first", 401);
    const { id } = await params;
    const order = await prisma.bookingOrder.findFirst({ where: { userId: currentUser.id, OR: [{ id }, { bookingNumber: id }] }, include: orderInclude });
    if (!order) return jsonError("ORDER_NOT_FOUND", "Order not found", 404);
    return jsonData(mapOrder(order));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to load order", 500);
  }
}