import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonList, parsePagination } from "@/features/admin/server/api-utils";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";
import { requireUserForApi } from "@/lib/authorization";

const statusMap: Record<string, BookingStatus> = { PENDING_CONFIRMATION: "PENDING_CONFIRMATION", CONFIRMED: "CONFIRMED", CANCELLED: "CANCELLED", COMPLETED: "COMPLETED" };

export async function GET(request: Request) {
  try {
    const auth = await requireUserForApi();
    if (auth.response) return auth.response;
    const currentUser = auth.user;
    if (!currentUser) return jsonError("UNAUTHORIZED", "Please sign in first", 401);
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortable = new Set(["createdAt", "updatedAt", "total"]);
    const where: Prisma.BookingOrderWhereInput = {
      userId: currentUser.id,
      ...(status && statusMap[status] ? { status: statusMap[status] } : {}),
      ...(search ? { OR: [{ bookingNumber: { contains: search } }, { originPort: { name: { contains: search } } }, { destinationPort: { name: { contains: search } } }, { carrier: { name: { contains: search } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.bookingOrder.findMany({ where, include: orderInclude, skip, take: pageSize, orderBy: { [sortable.has(sortBy) ? sortBy : "createdAt"]: sortOrder } }),
      prisma.bookingOrder.count({ where }),
    ]);
    return jsonList(items.map(mapOrder), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to load orders", 500);
  }
}
