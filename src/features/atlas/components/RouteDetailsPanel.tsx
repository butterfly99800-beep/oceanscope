"use client";

import { Route, X } from "lucide-react";
import { DetailRow } from "@/features/atlas/components/VesselDetailsPanel";
import type { Port, RouteOption } from "@/features/atlas/types";

function portName(ports: Port[], id: string) {
  return ports.find((port) => port.id === id)?.name ?? id;
}

export function RouteDetailsPanel({ option, ports, onClose }: { option: RouteOption; ports: Port[]; onClose: () => void }) {
  const transit = option.transitPortIds.map((id) => portName(ports, id)).join(" / ") || "N/A";
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-violet-50 text-violet-700"><Route className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-base font-semibold text-ink">{option.service}</h2><p className="mt-1 text-xs text-slate-500">{option.carrier} · {option.direct ? "直达" : `${option.transferCount} 次中转`}</p></div></div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label="关闭详情"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4"><section className="rounded-lg border border-slate-200 p-4"><div className="mb-3 text-sm font-semibold text-ink">航线详情</div><dl><DetailRow label="承运商" value={option.carrier} /><DetailRow label="Service" value={option.service} /><DetailRow label="起运港" value={portName(ports, option.originPortId)} /><DetailRow label="中转港" value={transit} /><DetailRow label="目的港" value={portName(ports, option.destinationPortId)} /><DetailRow label="ETD" value={option.etd} /><DetailRow label="ETA" value={option.eta} /><DetailRow label="运输时长" value={`${option.transitDays} 天`} /><DetailRow label="类型" value={option.direct ? "直达" : `${option.transferCount} 次中转`} /><DetailRow label="船名/航次" value={`${option.vesselName} ${option.voyageNumber}`} /></dl></section></div>
    </>
  );
}
