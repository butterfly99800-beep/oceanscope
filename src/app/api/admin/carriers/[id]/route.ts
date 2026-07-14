import { prisma } from "@/lib/prisma";
import { carrierSchema, handlePrismaError, jsonData, jsonError, statusToLabel, validationError } from "@/features/admin/server/api-utils";

function toCarrierRecord(carrier: NonNullable<Awaited<ReturnType<typeof prisma.carrier.findUnique>>>) {
  return {
    id: carrier.id,
    name: carrier.name,
    nameZh: carrier.nameZh ?? "",
    code: carrier.code,
    country: carrier.country,
    status: statusToLabel(carrier.status),
    updatedAt: carrier.updatedAt.toISOString().slice(0, 10),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const carrier = await prisma.carrier.findUnique({ where: { id } });
    if (!carrier) return jsonError("CARRIER_NOT_FOUND", "未找到船公司", 404);
    return jsonData(toCarrierRecord(carrier));
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = carrierSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const carrier = await prisma.carrier.update({ where: { id }, data: parsed.data });
    return jsonData(toCarrierRecord(carrier));
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const linkedRoutes = await prisma.route.count({ where: { carrierId: id } });
    if (linkedRoutes > 0) return jsonError("DELETE_BLOCKED", "该船公司已被航线引用，请先处理关联航线", 409);
    await prisma.carrier.delete({ where: { id } });
    return jsonData({ id });
  } catch (error) {
    return handlePrismaError(error);
  }
}
