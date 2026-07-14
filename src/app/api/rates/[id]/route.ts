import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { mapRateOption, rateInclude } from "@/features/rates/server/rate-mapper";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const quoteId = id.startsWith("rate-") ? id.slice(5) : id;
    const quote = await prisma.rateQuote.findUnique({ where: { id: quoteId }, include: rateInclude });
    if (!quote) return jsonError("RATE_NOT_FOUND", "未找到运价", 404);
    return jsonData(mapRateOption(quote));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "运价详情读取失败", 500);
  }
}