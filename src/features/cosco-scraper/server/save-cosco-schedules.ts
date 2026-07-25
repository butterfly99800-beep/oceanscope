import { Prisma, type Port } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";

export type SaveCoscoResult = { created: number; updated: number; skipped: number; skippedItems: Array<{ id: string; reason: string }> };

type SaveOptions = { mode?: "skipDuplicates" | "updateDuplicates"; originPort?: Port; destinationPort?: Port };

function parseIso(value: string | null | undefined) {
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

async function findPort(tx: Prisma.TransactionClient, locode: string | null, text: string) {
  return tx.port.findFirst({ where: { OR: [...(locode ? [{ locode: locode.toUpperCase() }] : []), ...textWhere(text)] } });
}

async function findCarrier(tx: Prisma.TransactionClient) {
  const existing = await tx.carrier.findFirst({ where: { OR: [{ code: "COSCO" }, { name: { contains: "COSCO" } }, { nameZh: { contains: "中远" } }] } });
  if (existing) return existing;
  return tx.carrier.create({ data: { name: "COSCO SHIPPING", nameZh: "中远海运", code: "COSCO", country: "China", status: "ACTIVE" } });
}

async function replaceScheduleChildren(tx: Prisma.TransactionClient, scheduleId: string, item: CoscoSchedulePreview, originPortId: string, destinationPortId: string, etd: Date, eta: Date) {
  await tx.scheduleTransitPort.deleteMany({ where: { scheduleId } });
  await tx.scheduleRouteNode.deleteMany({ where: { scheduleId } });
  await tx.scheduleRouteNode.create({ data: { scheduleId, portId: originPortId, sequence: 1, nodeType: "ORIGIN", departureTime: etd, terminal: item.originFacilityName || undefined } });
  await tx.scheduleRouteNode.create({ data: { scheduleId, portId: destinationPortId, sequence: item.transitPorts.length + 2, nodeType: "DESTINATION", arrivalTime: eta, terminal: item.destinationFacilityName || undefined } });
}

function createScheduleData(item: CoscoSchedulePreview, carrierId: string, originPortId: string, destinationPortId: string, etd: Date, eta: Date): Prisma.SailingScheduleUncheckedCreateInput {
  const transitDays = item.transitDays ?? fallbackTransitDays(etd, eta);
  const cutOff = parseIso(item.cutOffTime) ?? etd;
  const available = parseIso(item.availableTime) ?? etd;
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
    frequency: item.cargoNature || "",
    originTerminal: item.originFacilityName || "",
    destinationTerminal: item.destinationFacilityName || "",
    cyOpenTime: cutOff,
    siCutOffTime: cutOff,
    vgmCutOffTime: cutOff,
    customsCutOffTime: cutOff,
    estimatedBerthingTime: available,
    departureReliability: 0,
    status: "NORMAL",
    delayHours: 0,
    lastUpdatedAt: new Date(),
    source: "COSCO_LIVE_QUERY",
  };
}

export async function saveCoscoSchedules(schedules: CoscoSchedulePreview[], options: SaveOptions = {}): Promise<SaveCoscoResult> {
  return prisma.$transaction(async (tx) => {
    const carrier = await findCarrier(tx);
    const result: SaveCoscoResult = { created: 0, updated: 0, skipped: 0, skippedItems: [] };
    for (const item of schedules) {
      const etd = parseIso(item.etd);
      const eta = parseIso(item.eta);
      if (!etd || !eta || etd >= eta) {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Missing or invalid ETD/ETA." });
        continue;
      }
      const originPort = options.originPort ?? await findPort(tx, item.originLocode, item.originText);
      const destinationPort = options.destinationPort ?? await findPort(tx, item.destinationLocode, item.destinationText);
      if (!originPort || !destinationPort) {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Origin or destination port could not be matched in MySQL." });
        continue;
      }
      const data = createScheduleData(item, carrier.id, originPort.id, destinationPort.id, etd, eta);
      const existing = await tx.sailingSchedule.findFirst({ where: { carrierId: carrier.id, vesselName: data.vesselName, voyageNumber: data.voyageNumber, originPortId: originPort.id, destinationPortId: destinationPort.id, etd, source: "COSCO_LIVE_QUERY" } });
      if (existing && options.mode === "skipDuplicates") {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Duplicate schedule skipped." });
        continue;
      }
      try {
        const saved = existing ? await tx.sailingSchedule.update({ where: { id: existing.id }, data }) : await tx.sailingSchedule.create({ data });
        await replaceScheduleChildren(tx, saved.id, item, originPort.id, destinationPort.id, etd, eta);
        if (existing) result.updated += 1;
        else result.created += 1;
      } catch {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Schedule could not be saved without changing existing manual data." });
      }
    }
    return result;
  }, { timeout: 30000 });
}

