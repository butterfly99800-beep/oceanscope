import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonError, routeSchema, statusToLabel, validationError } from "@/features/admin/server/api-utils";

const includeRoute = { carrier: true, originPort: true, destinationPort: true, transitPorts: { include: { port: true }, orderBy: { sequence: "asc" as const } } };
type RouteWithRelations = Prisma.RouteGetPayload<{ include: typeof includeRoute }>;

function toRouteRecord(route: RouteWithRelations) {
  return { id: route.id, name: route.name, serviceName: route.serviceName, carrierId: route.carrierId, carrier: route.carrier.name, originPortId: route.originPortId, originPort: route.originPort.name, destinationPortId: route.destinationPortId, destinationPort: route.destinationPort.name, transitPortIds: route.transitPorts.map((item) => item.portId).join(","), transitPorts: route.transitPorts.map((item) => `${item.port.name} (${item.port.locode})`).join(" / "), direct: route.direct ? "Direct" : "Transshipment", averageTransitDays: route.averageTransitDays, status: statusToLabel(route.status), updatedAt: route.updatedAt.toISOString().slice(0, 10) };
}

async function ensureRouteRelations(input: { carrierId: string; originPortId: string; destinationPortId: string; transitPortIds: string[] }) {
  const [carrier, originPort, destinationPort, transitPorts] = await Promise.all([
    prisma.carrier.findUnique({ where: { id: input.carrierId } }),
    prisma.port.findUnique({ where: { id: input.originPortId } }),
    prisma.port.findUnique({ where: { id: input.destinationPortId } }),
    input.transitPortIds.length ? prisma.port.findMany({ where: { id: { in: input.transitPortIds } } }) : Promise.resolve([]),
  ]);
  if (!carrier) return jsonError("CARRIER_NOT_FOUND", "Carrier not found", 400);
  if (!originPort || !destinationPort) return jsonError("PORT_NOT_FOUND", "Origin or destination port not found", 400);
  if (transitPorts.length !== input.transitPortIds.length) return jsonError("PORT_NOT_FOUND", "Transit port not found", 400);
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const route = await prisma.route.findUnique({ where: { id }, include: includeRoute });
    if (!route) return jsonError("ROUTE_NOT_FOUND", "Route not found", 404);
    return jsonData(toRouteRecord(route));
  } catch (error) { return handlePrismaError(error); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = routeSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const relationError = await ensureRouteRelations(parsed.data);
    if (relationError) return relationError;
    const route = await prisma.$transaction(async (tx) => {
      await tx.routeTransitPort.deleteMany({ where: { routeId: id } });
      await tx.route.update({ where: { id }, data: { name: parsed.data.name, serviceName: parsed.data.serviceName, carrierId: parsed.data.carrierId, originPortId: parsed.data.originPortId, destinationPortId: parsed.data.destinationPortId, direct: parsed.data.direct, averageTransitDays: parsed.data.averageTransitDays, status: parsed.data.status } });
      await Promise.all(parsed.data.transitPortIds.map((portId, index) => tx.routeTransitPort.create({ data: { routeId: id, portId, sequence: index + 1 } })));
      return tx.route.findUniqueOrThrow({ where: { id }, include: includeRoute });
    });
    return jsonData(toRouteRecord(route));
  } catch (error) { return handlePrismaError(error); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const [linkedSchedules, linkedRates, linkedOrders] = await Promise.all([prisma.sailingSchedule.count({ where: { routeId: id } }), prisma.rateQuote.count({ where: { routeId: id } }), prisma.bookingOrder.count({ where: { routeId: id } })]);
    if (linkedSchedules > 0 || linkedRates > 0 || linkedOrders > 0) return jsonError("DELETE_BLOCKED", "This route is referenced by schedules or rates.", 409);
    await prisma.route.delete({ where: { id } });
    return jsonData({ id });
  } catch (error) { return handlePrismaError(error); }
}