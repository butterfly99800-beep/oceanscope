import { createHash } from "node:crypto";
﻿import { Prisma, type Port } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { matchesSourcePort, samePortCode } from "@/features/ports/server/source-port-match";
import type { CoscoSchedulePreview } from "@/features/cosco-scraper/types";

export type SaveCoscoResult = { created: number; updated: number; skipped: number; skippedItems: Array<{ id: string; reason: string }> };

type LiveScheduleSource = "COSCO_LIVE_QUERY" | "OOCL_LIVE_QUERY" | "CMA_LIVE_QUERY" | "MAERSK_LIVE_QUERY" | "MSC_LIVE_QUERY" | "HAPAG_LIVE_QUERY" | "ONE_LIVE_QUERY";

type SaveOptions = { mode?: "skipDuplicates" | "updateDuplicates"; originPort?: Port; destinationPort?: Port; source?: LiveScheduleSource; carrierCode?: string; carrierName?: string };

function parseIso(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function textWhere(value: string) {
  const token = value.split(/[,()]/)[0]?.trim();
  return token ? [{ name: { contains: token } }, { nameZh: { contains: token } }, { locode: token.toUpperCase() }] : [];
}

async function findPort(tx: Prisma.TransactionClient, locode: string | null, text: string) {
  return tx.port.findFirst({ where: { OR: [...(locode ? [{ locode: locode.toUpperCase() }] : []), ...textWhere(text)] } });
}

async function findCarrier(tx: Prisma.TransactionClient, options: SaveOptions) {
  const code = options.carrierCode || "COSCO";
  const name = options.carrierName || "COSCO SHIPPING";
  const existing = await tx.carrier.findUnique({ where: { code } });
  if (existing) return existing;
  const countries: Record<string, string> = { COSCO: "China", OOCL: "Hong Kong, China", CMA: "France", MAERSK: "Denmark", HAPAG: "Germany", MSC: "Switzerland", ONE: "Singapore" };
  return tx.carrier.create({ data: { name, code, country: countries[code] || "", status: "ACTIVE" } });
}

async function replaceScheduleChildren(tx: Prisma.TransactionClient, scheduleId: string, item: CoscoSchedulePreview, originPortId: string, destinationPortId: string, etd: Date, eta: Date) {
  await tx.scheduleTransitPort.deleteMany({ where: { scheduleId } });
  await tx.scheduleRouteNode.deleteMany({ where: { scheduleId } });
  void item;
  void originPortId;
  void destinationPortId;
  void etd;
  void eta;
}

function createScheduleData(item: CoscoSchedulePreview, carrierId: string, originPortId: string, destinationPortId: string, etd: Date, eta: Date, source: LiveScheduleSource): Prisma.SailingScheduleUncheckedCreateInput {
  return {
    carrierId,
    routeId: null,
    serviceName: item.serviceName,
    routeName: item.routeName,
    vesselName: item.vesselName,
    voyageNumber: item.voyageNumber,
    originPortId,
    destinationPortId,
    etd,
    eta,
    etdTimeKnown: item.etdTimeKnown ?? true,
    etaTimeKnown: item.etaTimeKnown ?? true,
    transitDays: item.transitDays,
    direct: item.direct,
    stopCount: item.stopCount,
    frequency: item.cargoNature ?? null,
    originTerminal: item.originFacilityName ?? null,
    destinationTerminal: item.destinationFacilityName ?? null,
    cyOpenTime: null,
    siCutOffTime: null,
    vgmCutOffTime: null,
    customsCutOffTime: parseIso(item.cutOffTime),
    estimatedBerthingTime: parseIso(item.availableTime),
    departureReliability: null,
    status: null,
    delayHours: null,
    lastUpdatedAt: new Date(),
    source,
    fetchedAt: new Date(),
    rawSourceData: item.rawText,
    sourceReference: item.id.slice(0, 160),
    routingKey: item.rawText.startsWith('{"officialLegs":') ? createHash("sha256").update(item.id).digest("hex") : "",
  };
}

export async function saveCoscoSchedules(schedules: CoscoSchedulePreview[], options: SaveOptions = {}): Promise<SaveCoscoResult> {
  return prisma.$transaction(async (tx) => {
    const source = options.source || "COSCO_LIVE_QUERY";
    const carrier = await findCarrier(tx, options);
    const result: SaveCoscoResult = { created: 0, updated: 0, skipped: 0, skippedItems: [] };
    for (const item of schedules) {
      const matchesName = matchesSourcePort;
      if ((options.originPort && item.originLocode && !samePortCode(item.originLocode, options.originPort.locode))
        || (options.destinationPort && item.destinationLocode && !samePortCode(item.destinationLocode, options.destinationPort.locode))
        || (options.originPort && !item.originLocode && !matchesName(item.originText, options.originPort))
        || (options.destinationPort && !item.destinationLocode && !matchesName(item.destinationText, options.destinationPort))) {
        result.skipped += 1;
        result.skippedItems.push({ id: item.id, reason: "Official result port does not match the requested port." });
        continue;
      }
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
      const data = createScheduleData(item, carrier.id, originPort.id, destinationPort.id, etd, eta, source);
      const existing = await tx.sailingSchedule.findFirst({
        where: {
          carrierId: carrier.id,
          source,
          originPortId: originPort.id,
          destinationPortId: destinationPort.id,
          OR: [
            { sourceReference: data.sourceReference },
            ...(item.rawText.startsWith('{"officialLegs":') ? [] : [{ vesselName: data.vesselName, voyageNumber: data.voyageNumber, originPortId: originPort.id, destinationPortId: destinationPort.id, etd }]),
          ],
        },
      });
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

