import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/authorization";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";

const passwordSchema = z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/);
const schema = z.object({ password: passwordSchema });

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("BAD_REQUEST", "Password must be at least 8 characters and include letters and numbers", 400);
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) return jsonError("BAD_REQUEST", "User not found", 404);
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
  return jsonData({ id, message: "Password reset successfully" });
}
