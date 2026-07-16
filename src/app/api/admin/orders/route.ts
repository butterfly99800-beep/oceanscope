import { BookingStatus, Prisma } from "@prisma/client";
import { requireAdminForApi } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { jsonError, jsonList, parsePagination } from "@/features/admin/server/api-utils";
import { mapAdminOrder, orderInclude } from "@/features/orders/server/order-mapper";

const statusMap: Record<string, BookingStatus> = { PENDING_CONFIRMATION: "PENDING_CONFIRMATION", CONFIRMED: "CONFIRMED", CANCELLED: "CANCELLED", COMPLETED: "COMPLETED" };

export async function GET(request: Request) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const sortable = new Set(["createdAt", "updatedAt", "total"]);
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const where: Prisma.BookingOrderWhereInput = {
      ...(status && statusMap[status] ? { status: statusMap[status] } : {}),
      ...(searchParams.get("originPortId") ? { originPortId: searchParams.get("originPortId") ?? undefined } : {}),
      ...(searchParams.get("destinationPortId") ? { destinationPortId: searchParams.get("destinationPortId") ?? undefined } : {}),
      ...(searchParams.get("carrierId") ? { carrierId: searchParams.get("carrierId") ?? undefined } : {}),
      ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo) } : {}) } } : {}),
      ...(search ? { OR: [{ bookingNumber: { contains: search } }, { originPort: { name: { contains: search } } }, { destinationPort: { name: { contains: search } } }, { carrier: { name: { contains: search } } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.bookingOrder.findMany({ where, include: orderInclude, skip, take: pageSize, orderBy: { [sortable.has(sortBy) ? sortBy : "createdAt"]: sortOrder } }),
      prisma.bookingOrder.count({ where }),
    ]);
    return jsonList(items.map(mapAdminOrder), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to load admin orders", 500);
  }
}
