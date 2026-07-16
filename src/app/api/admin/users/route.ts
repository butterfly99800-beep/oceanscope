import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/authorization";
import { jsonError, jsonList, parsePagination } from "@/features/admin/server/api-utils";

const roles = new Set<UserRole>(["CUSTOMER", "ADMIN"]);
const statuses = new Set<UserStatus>(["ACTIVE", "DISABLED"]);
const sortable = new Set(["createdAt", "updatedAt", "lastLoginAt", "email", "name"]);

function mapUser(user: Prisma.UserGetPayload<{ include: { _count: { select: { orders: true } } } }>) {
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email,
    role: user.role,
    status: user.status,
    orderCount: user._count.orders,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  };
}

export async function GET(request: Request) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const role = searchParams.get("role") as UserRole | null;
    const status = searchParams.get("status") as UserStatus | null;
    const sortBy = searchParams.get("sortBy") ?? "createdAt";
    const where: Prisma.UserWhereInput = {
      ...(role && roles.has(role) ? { role } : {}),
      ...(status && statuses.has(status) ? { status } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search.toLowerCase() } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, include: { _count: { select: { orders: true } } }, skip, take: pageSize, orderBy: { [sortable.has(sortBy) ? sortBy : "createdAt"]: sortOrder } }),
      prisma.user.count({ where }),
    ]);
    return jsonList(items.map(mapUser), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "Failed to load users", 500);
  }
}
