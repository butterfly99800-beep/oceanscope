import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonError, jsonList, parsePagination, routeSchema, statusToDb, statusToLabel, validationError } from "@/features/admin/server/api-utils";

const sortable = new Set(["name", "serviceName", "averageTransitDays", "updatedAt", "createdAt"]);
const includeRoute = {
  carrier: true,
  originPort: true,
  destinationPort: true,
  transitPorts: { include: { port: true }, orderBy: { sequence: "asc" as const } },
};

type RouteWithRelations = Prisma.RouteGetPayload<{ include: typeof includeRoute }>;

function toRouteRecord(route: RouteWithRelations) {
  const transitPorts = route.transitPorts.map((item) => `${item.port.name} (${item.port.locode})`).join(" / ");
  return {
    id: route.id,
    name: route.name,
    serviceName: route.serviceName,
    carrierId: route.carrierId,
    carrier: route.carrier.name,
    originPortId: route.originPortId,
    originPort: route.originPort.name,
    destinationPortId: route.destinationPortId,
    destinationPort: route.destinationPort.name,
    transitPortIds: route.transitPorts.map((item) => item.portId).join(","),
    transitPorts,
    direct: route.direct ? "直达" : "中转",
    averageTransitDays: route.averageTransitDays,
    status: statusToLabel(route.status),
    updatedAt: route.updatedAt.toISOString().slice(0, 10),
  };
}

async function ensureRouteRelations(input: { carrierId: string; originPortId: string; destinationPortId: string; transitPortIds: string[] }) {
  const [carrier, originPort, destinationPort, transitPorts] = await Promise.all([
    prisma.carrier.findUnique({ where: { id: input.carrierId } }),
    prisma.port.findUnique({ where: { id: input.originPortId } }),
    prisma.port.findUnique({ where: { id: input.destinationPortId } }),
    input.transitPortIds.length ? prisma.port.findMany({ where: { id: { in: input.transitPortIds } } }) : Promise.resolve([]),
  ]);
  if (!carrier) return jsonError("CARRIER_NOT_FOUND", "船公司不存在", 400);
  if (!originPort || !destinationPort) return jsonError("PORT_NOT_FOUND", "起运港或目的港不存在", 400);
  if (transitPorts.length !== input.transitPortIds.length) return jsonError("PORT_NOT_FOUND", "中转港不存在", 400);
  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = statusToDb(searchParams.get("status") ?? undefined);
    const carrierId = searchParams.get("carrierId")?.trim();
    const originPortId = searchParams.get("originPortId")?.trim();
    const destinationPortId = searchParams.get("destinationPortId")?.trim();
    const directParam = searchParams.get("direct");
    const sortBy = searchParams.get("sortBy") ?? "updatedAt";
    const where: Prisma.RouteWhereInput = {
      ...(status ? { status } : {}),
      ...(carrierId ? { carrierId } : {}),
      ...(originPortId ? { originPortId } : {}),
      ...(destinationPortId ? { destinationPortId } : {}),
      ...(directParam === "true" ? { direct: true } : directParam === "false" ? { direct: false } : {}),
      ...(search ? { OR: [
        { name: { contains: search } },
        { serviceName: { contains: search } },
        { carrier: { name: { contains: search } } },
        { originPort: { locode: { contains: search.toUpperCase() } } },
        { destinationPort: { locode: { contains: search.toUpperCase() } } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.route.findMany({ where, skip, take: pageSize, include: includeRoute, orderBy: { [sortable.has(sortBy) ? sortBy : "updatedAt"]: sortOrder } }),
      prisma.route.count({ where }),
    ]);
    return jsonList(items.map(toRouteRecord), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = routeSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const relationError = await ensureRouteRelations(parsed.data);
    if (relationError) return relationError;
    const route = await prisma.$transaction(async (tx) => {
      const created = await tx.route.create({ data: {
        name: parsed.data.name,
        serviceName: parsed.data.serviceName,
        carrierId: parsed.data.carrierId,
        originPortId: parsed.data.originPortId,
        destinationPortId: parsed.data.destinationPortId,
        direct: parsed.data.direct,
        averageTransitDays: parsed.data.averageTransitDays,
        status: parsed.data.status,
      } });
      await Promise.all(parsed.data.transitPortIds.map((portId, index) => tx.routeTransitPort.create({ data: { routeId: created.id, portId, sequence: index + 1 } })));
      return tx.route.findUniqueOrThrow({ where: { id: created.id }, include: includeRoute });
    });
    return jsonData(toRouteRecord(route), { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}

