import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUserForApi } from "@/lib/authorization";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";

const schema = z.object({ name: z.string().trim().min(1).max(50) });

export async function PUT(request: Request) {
  const auth = await requireUserForApi();
  if (auth.response) return auth.response;
  const currentUser = auth.user;
  if (!currentUser) return jsonError("UNAUTHORIZED", "Please sign in first", 401);
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("BAD_REQUEST", "Name must be 1 to 50 characters", 400);
  const user = await prisma.user.update({ where: { id: currentUser.id }, data: { name: parsed.data.name }, select: { id: true, name: true, email: true, role: true, status: true, updatedAt: true } });
  return jsonData(user);
}
