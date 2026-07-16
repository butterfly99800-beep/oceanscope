import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserForApi } from "@/lib/authorization";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";

const passwordSchema = z.string().min(8).regex(/[A-Za-z]/).regex(/[0-9]/);
const schema = z.object({ currentPassword: z.string().min(1), newPassword: passwordSchema, confirmPassword: z.string().min(1) }).superRefine((value, context) => {
  if (value.newPassword !== value.confirmPassword) context.addIssue({ code: "custom", message: "New passwords do not match", path: ["confirmPassword"] });
});

export async function PUT(request: Request) {
  const auth = await requireUserForApi();
  if (auth.response) return auth.response;
  const currentUser = auth.user;
  if (!currentUser) return jsonError("UNAUTHORIZED", "Please sign in first", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid password", 400);
  const user = await prisma.user.findUnique({ where: { id: currentUser.id }, select: { id: true, passwordHash: true } });
  if (!user) return jsonError("UNAUTHORIZED", "Please sign in first", 401);
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return jsonError("BAD_REQUEST", "Current password is incorrect", 400);
  const same = await bcrypt.compare(parsed.data.newPassword, user.passwordHash);
  if (same) return jsonError("BAD_REQUEST", "New password must be different from current password", 400);
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  return jsonData({ message: "Password updated successfully" });
}
