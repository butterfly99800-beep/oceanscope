import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonError, validationError } from "@/features/admin/server/api-utils";
import { ensureRateRelations, rateData, rateSchema, replaceRateLineItems } from "@/features/rates/server/admin-rate-api";
import { mapAdminRate, rateInclude } from "@/features/rates/server/rate-mapper";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quote = await prisma.rateQuote.findUnique({ where: { id }, include: rateInclude });
    if (!quote) return jsonError("RATE_NOT_FOUND", "未找到运价", 404);
    return jsonData(mapAdminRate(quote));
  } catch (error) { return handlePrismaError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = rateSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const relationError = await ensureRateRelations(parsed.data);
    if (relationError) return relationError;
    await prisma.rateQuote.update({ where: { id }, data: rateData(parsed.data) });
    await replaceRateLineItems(id, parsed.data);
    const full = await prisma.rateQuote.findUniqueOrThrow({ where: { id }, include: rateInclude });
    return jsonData(mapAdminRate(full));
  } catch (error) { return handlePrismaError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.rateQuote.delete({ where: { id } });
    return jsonData({ id });
  } catch (error) { return handlePrismaError(error); }
}