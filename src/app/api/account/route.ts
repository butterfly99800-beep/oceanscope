import { prisma } from "@/lib/prisma";
import { requireUserForApi } from "@/lib/authorization";
import { jsonData } from "@/features/admin/server/api-utils";

export async function GET() {
  const auth = await requireUserForApi();
  if (auth.response) return auth.response;
  const currentUser = auth.user;
  if (!currentUser) return auth.response;
  const user = await prisma.user.findUniqueOrThrow({ where: { id: currentUser.id }, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true, lastLoginAt: true, _count: { select: { orders: true } } } });
  return jsonData({ id: user.id, name: user.name ?? "", email: user.email, role: user.role, status: user.status, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), lastLoginAt: user.lastLoginAt?.toISOString() ?? null, orderCount: user._count.orders });
}
