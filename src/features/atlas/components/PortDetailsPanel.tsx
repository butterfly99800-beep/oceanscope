"use client";

import { Anchor, X } from "lucide-react";
import { DetailRow } from "@/features/atlas/components/VesselDetailsPanel";
import type { Port } from "@/features/atlas/types";

export function PortDetailsPanel({ port, onClose }: { port: Port; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
        <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-ocean-100 text-ocean-700"><Anchor className="h-5 w-5" aria-hidden="true" /></div><div><h2 className="text-base font-semibold text-ink">{port.name}</h2><p className="mt-1 text-xs text-slate-500">{port.nameZh ?? port.region} · {port.country}</p></div></div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ink" aria-label="关闭详情"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4"><section className="rounded-lg border border-slate-200 p-4"><div className="mb-3 text-sm font-semibold text-ink">港口摘要</div><dl><DetailRow label="国家" value={port.country} /><DetailRow label="UN/LOCODE" value={port.locode} /><DetailRow label="区域" value={port.region} /><DetailRow label="坐标" value={`${port.latitude.toFixed(4)}, ${port.longitude.toFixed(4)}`} /><DetailRow label="当前船舶数量" value={`${port.vesselCount}`} /><DetailRow label="等待船舶数量" value={`${port.waitingVesselCount}`} /><DetailRow label="平均等待时间" value={`${port.averageWaitingHours} 小时`} /></dl></section></div>
    </>
  );
}
