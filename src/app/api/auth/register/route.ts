import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";

const passwordSchema = z.string().min(8, "Password must be at least 8 characters").regex(/[A-Za-z]/, "Password must include a letter").regex(/[0-9]/, "Password must include a number");
const registerSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: passwordSchema,
});

export async function POST(request: Request) {
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("BAD_REQUEST", parsed.error.issues[0]?.message ?? "Invalid registration data", 400);
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await prisma.user.create({
      data: { name: parsed.data.name || null, email: parsed.data.email, passwordHash, role: "CUSTOMER", status: "ACTIVE" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    return jsonData(user, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("EMAIL_ALREADY_EXISTS", "Email is already registered", 409);
    }
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("UNKNOWN_ERROR", "Failed to register user", 500);
  }
}
