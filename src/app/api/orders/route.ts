import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonList, parsePagination } from "@/features/admin/server/api-utils";
import { mapOrder, orderInclude } from "@/features/orders/server/order-mapper";

const statusMap: Record<string, BookingStatus> = { PENDING_CONFIRMATION: "PENDING_CONFIRMATION", CONFIRMED: "CONFIRMED", CANCELLED: "CANCELLED", COMPLETED: "COMPLETED" };

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortable = new Set(["createdAt", "updatedAt", "total"]);
    // TODO: Filter by current user after authentication is added.
    const where: Prisma.BookingOrderWhereInput = {
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
