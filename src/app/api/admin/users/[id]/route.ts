import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/authorization";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";

function mapUser(user: Prisma.UserGetPayload<{ include: { _count: { select: { orders: true } } } }>) {
  return { id: user.id, name: user.name ?? "", email: user.email, role: user.role, status: user.status, orderCount: user._count.orders, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, include: { _count: { select: { orders: true } } } });
  if (!user) return jsonError("BAD_REQUEST", "User not found", 404);
  return jsonData(mapUser(user));
}
