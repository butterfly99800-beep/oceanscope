import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonError, portSchema, statusToLabel, validationError } from "@/features/admin/server/api-utils";

function toPortRecord(port: NonNullable<Awaited<ReturnType<typeof prisma.port.findUnique>>>) {
  return {
    id: port.id,
    name: port.name,
    nameZh: port.nameZh ?? "",
    locode: port.locode,
    country: port.country,
    countryCode: port.countryCode ?? "",
    region: port.region,
    latitude: port.latitude ?? "",
    longitude: port.longitude ?? "",
    status: statusToLabel(port.status),
    updatedAt: port.updatedAt.toISOString().slice(0, 10),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const port = await prisma.port.findUnique({ where: { id } });
    if (!port) return jsonError("PORT_NOT_FOUND", "未找到港口", 404);
    return jsonData(toPortRecord(port));
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = portSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const port = await prisma.port.update({ where: { id }, data: parsed.data });
    return jsonData(toPortRecord(port));
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [linkedRoutes, linkedSchedules] = await Promise.all([
      prisma.route.count({ where: { OR: [{ originPortId: id }, { destinationPortId: id }, { transitPorts: { some: { portId: id } } }] } }),
      prisma.sailingSchedule.count({ where: { OR: [{ originPortId: id }, { destinationPortId: id }, { transitPorts: { some: { portId: id } } }, { routeNodes: { some: { portId: id } } }] } }),
    ]);
    if (linkedRoutes > 0 || linkedSchedules > 0) return jsonError("DELETE_BLOCKED", "该港口已被航线或船期引用，请先处理关联数据", 409);
    await prisma.port.delete({ where: { id } });
    return jsonData({ id });
  } catch (error) {
    return handlePrismaError(error);
  }
}


