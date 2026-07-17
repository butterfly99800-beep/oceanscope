import { Prisma } from "@prisma/client";
import { z } from "zod";
import { jsonData, handlePrismaError, validationError } from "@/features/admin/server/api-utils";
import { prisma } from "@/lib/prisma";
import { requireAdminForApi } from "@/lib/authorization";

export const runtime = "nodejs";

const scheduleSchema = z.object({
  id: z.string().min(1),
  carrierName: z.string().min(1),
  serviceName: z.string().nullable(),
  routeName: z.string().nullable(),
  vesselName: z.string().nullable(),
  voyageNumber: z.string().nullable(),
  originText: z.string().min(1),
  destinationText: z.string().min(1),
  originLocode: z.string().nullable(),
  destinationLocode: z.string().nullable(),
  etd: z.string().nullable(),
  eta: z.string().nullable(),
  transitDays: z.number().nullable(),
  direct: z.boolean().nullable(),
  stopCount: z.number().nullable(),
  transitPorts: z.array(z.string()),
  rawText: z.string(),
});

const commitSchema = z.object({
  mode: z.enum(["skipDuplicates", "updateDuplicates"]).default("skipDuplicates"),
  schedules: z.array(scheduleSchema).min(1).max(50),
});

type CommitItem = z.infer<typeof scheduleSchema>;

function parseIso(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fallbackTransitDays(etd: Date, eta: Date) {
  return Math.max(1, Math.round((eta.getTime() - etd.getTime()) / 86400000));
}

function textWhere(value: string) {
  const token = value.split(/[,()]/)[0]?.trim();
  return token ? [{ name: { contains: token } }, { nameZh: { contains: token } }, { locode: token.toUpperCase() }] : [];
}

async function findPort(locode: string | null, text: string) {
  return prisma.port.findFirst({ where: { OR: [...(locode ? [{ locode: locode.toUpperCase() }] : []), ...textWhere(text)] } });
}

async function findCarrier() {
  const existing = await prisma.carrier.findFirst({ where: { OR: [{ code: "COSCO" }, { name: { contains: "COSCO" } }, { nameZh: { contains: "中远" } }] } });
  if (existing) return existing;
  return prisma.carrier.create({ data: { name: "COSCO SHIPPING", nameZh: "中远海运", code: "COSCO", country: "China", status: "ACTIVE" } });
}

async function replaceScheduleChildren(scheduleId: string, item: CommitItem, originPortId: string, destinationPortId: string, etd: Date, eta: Date) {
  await prisma.scheduleTransitPort.deleteMany({ where: { scheduleId } });
  await prisma.scheduleRouteNode.deleteMany({ where: { scheduleId } });
  await prisma.scheduleRouteNode.create({ data: { scheduleId, portId: originPortId, sequence: 1, nodeType: "ORIGIN", departureTime: etd, terminal: "COSCO online schedule" } });
  await prisma.scheduleRouteNode.create({ data: { scheduleId, portId: destinationPortId, sequence: item.transitPorts.length + 2, nodeType: "DESTINATION", arrivalTime: eta, terminal: "COSCO online schedule" } });
}

function createScheduleData(item: CommitItem, carrierId: string, originPortId: string, destinationPortId: string, etd: Date, eta: Date): Prisma.SailingScheduleUncheckedCreateInput {
  const transitDays = item.transitDays ?? fallbackTransitDays(etd, eta);
  const serviceName = item.serviceName || "COSCO Online";
  const routeName = item.routeName || `${item.originText} -> ${item.destinationText}`;
  const vesselName = item.vesselName || "COSCO UNKNOWN";
  const voyageNumber = item.voyageNumber || `COSCO-${etd.toISOString().slice(0, 10).replace(/-/g, "")}`;
  return {
    carrierId,
    routeId: null,
    serviceName,
    routeName,
    vesselName,
    voyageNumber,
    originPortId,
    destinationPortId,
    etd,
    eta,
    transitDays,
    direct: item.direct ?? (item.stopCount ?? item.transitPorts.length) === 0,
    stopCount: item.stopCount ?? item.transitPorts.length,
    frequency: "COSCO online preview",
    originTerminal: "COSCO online schedule",
    destinationTerminal: "COSCO online schedule",
    cyOpenTime: new Date(etd.getTime() - 5 * 86400000),
    siCutOffTime: new Date(etd.getTime() - 3 * 86400000),
    vgmCutOffTime: new Date(etd.getTime() - 2 * 86400000),
    customsCutOffTime: new Date(etd.getTime() - 2 * 86400000),
    estimatedBerthingTime: etd,
    departureReliability: 80,
    status: "NORMAL",
    delayHours: 0,
    lastUpdatedAt: new Date(),
    source: "COSCO_LIVE_QUERY",
  };
}

export async function POST(request: Request) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  const parsed = commitSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  try {
    const carrier = await findCarrier();
    const result = { created: 0, updated: 0, skipped: 0, skippedItems: [] as Array<{ id: string; reason: string }> };

    for (const item of parsed.data.schedules) {
      const etd = parseIso(item.etd);
      const eta = parseIso(item.eta);
      if (!etd || !eta || etd >= eta) {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Missing or invalid ETD/ETA." });
        continue;
      }
      const [originPort, destinationPort] = await Promise.all([findPort(item.originLocode, item.originText), findPort(item.destinationLocode, item.destinationText)]);
      if (!originPort || !destinationPort) {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Origin or destination port could not be matched in MySQL." });
        continue;
      }
      const data = createScheduleData(item, carrier.id, originPort.id, destinationPort.id, etd, eta);
      const existing = await prisma.sailingSchedule.findFirst({ where: { carrierId: carrier.id, vesselName: data.vesselName, voyageNumber: data.voyageNumber, originPortId: originPort.id, destinationPortId: destinationPort.id, etd } });
      if (existing && parsed.data.mode === "skipDuplicates") {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Duplicate schedule skipped." });
        continue;
      }
      const saved = existing
        ? await prisma.sailingSchedule.update({ where: { id: existing.id }, data })
        : await prisma.sailingSchedule.create({ data });
      await replaceScheduleChildren(saved.id, item, originPort.id, destinationPort.id, etd, eta);
      if (existing) result.updated += 1;
      else result.created += 1;
    }
    return jsonData(result);
  } catch (error) {
    return handlePrismaError(error);
  }
}


