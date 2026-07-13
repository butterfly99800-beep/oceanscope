"use client";

import { Anchor, Gauge, Navigation2, Ship, X } from "lucide-react";
import { getStatusClassName } from "@/features/atlas/components/statusStyles";
import type { Vessel } from "@/features/atlas/types";

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-xs font-semibold text-slate-800">{value}</dd>
    </div>
  );
}

export function VesselDetailsPanel({ vessel, onClose }: { vessel: Vessel; onClose: () => void }) {
  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-ocean-500 to-violet-500 text-white"><Ship className="h-5 w-5" aria-hidden="true" /></div>
            <div className="min-w-0"><h2 className="truncate text-base font-semibold text-ink">{vessel.name}</h2><p className="mt-1 text-xs text-slate-500">{vessel.type} · {vessel.flag}</p></div>
          </div>
          <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-xs font-semibold ring-1 ${getStatusClassName(vessel.status)}`}>{vessel.status}</span>
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-ink active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100" aria-label="关闭详情"><X className="h-4 w-4" aria-hidden="true" /></button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Navigation2 className="h-4 w-4 text-ocean-700" aria-hidden="true" />船舶详情</div>
          <dl><DetailRow label="IMO" value={vessel.imo} /><DetailRow label="MMSI" value={vessel.mmsi} /><DetailRow label="当前坐标" value={vessel.coordinates} /><DetailRow label="当前航速" value={vessel.speed} /><DetailRow label="当前航向" value={vessel.heading} /><DetailRow label="上一停靠港" value={vessel.previousPort} /><DetailRow label="下一目的港" value={vessel.nextPort} /><DetailRow label="ETA" value={vessel.eta} /><DetailRow label="最后更新时间" value={vessel.lastUpdated} /></dl>
        </section>
        <section className="mt-4 rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Gauge className="h-4 w-4 text-ocean-700" aria-hidden="true" />当前航程</div>
          <dl><DetailRow label="起运港" value={vessel.voyage.origin} /><DetailRow label="中转港" value={vessel.voyage.transit} /><DetailRow label="目的港" value={vessel.voyage.destination} /><DetailRow label="ETD" value={vessel.voyage.etd} /><DetailRow label="ETA" value={vessel.voyage.eta} /><DetailRow label="预计航程天数" value={`${vessel.voyage.days} 天`} /></dl>
          <div className="mt-4"><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-slate-600">航程进度</span><span className="font-semibold text-ocean-700">{vessel.voyage.progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-ocean-500 to-violet-500" style={{ width: `${vessel.voyage.progress}%` }} /></div></div>
        </section>
        <section className="mt-4 rounded-lg border border-slate-200 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><Anchor className="h-4 w-4 text-ocean-700" aria-hidden="true" />最近停靠记录</div>
          <div className="space-y-3">{vessel.portCalls.map((call) => <div key={`${call.port}-${call.arrivalTime}`} className="rounded-md bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div className="text-sm font-semibold text-ink">{call.port}</div><div className="text-xs font-medium text-slate-500">{call.duration}</div></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600"><div><span className="block text-slate-400">到达</span>{call.arrivalTime}</div><div><span className="block text-slate-400">离港</span>{call.departureTime}</div></div></div>)}</div>
        </section>
      </div>
    </>
  );
}
