import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/prisma";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) return null;
  const user = await prisma.user.findUnique({ where: { id: sessionUserId }, select: { id: true, name: true, email: true, role: true, status: true } });
  if (!user || user.status !== "ACTIVE") return null;
  return { id: user.id, name: user.name ?? user.email, email: user.email, role: user.role };
}
