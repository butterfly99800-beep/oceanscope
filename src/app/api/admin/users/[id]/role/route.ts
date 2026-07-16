import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/authorization";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";

const schema = z.object({ role: z.enum(["CUSTOMER", "ADMIN"]) });

async function activeAdminCount(exceptUserId?: string) {
  return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", ...(exceptUserId ? { id: { not: exceptUserId } } : {}) } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  const currentAdmin = adminAuth.user;
  if (!currentAdmin) return jsonError("UNAUTHORIZED", "Please sign in first", 401);
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("BAD_REQUEST", "Invalid role", 400);
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return jsonError("BAD_REQUEST", "User not found", 404);
  if (id === currentAdmin.id && parsed.data.role === "CUSTOMER") return jsonError("CONFLICT", "?????????????", 409);
  if (user.role === "ADMIN" && user.status === "ACTIVE" && parsed.data.role === "CUSTOMER" && await activeAdminCount(id) < 1) return jsonError("CONFLICT", "????????????????", 409);
  const updated = await prisma.user.update({ where: { id }, data: { role: parsed.data.role }, select: { id: true, name: true, email: true, role: true, status: true, updatedAt: true } });
  return jsonData(updated);
}
