"use client";

import { Download, GitCompare, Heart, Map, X } from "lucide-react";
import Link from "next/link";
import type { SailingSchedule } from "@/features/schedules/types";

function fmt(value: string | null | undefined, timeKnown = true) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toISOString().slice(0, 10)}${timeKnown ? ` ${date.toISOString().slice(11, 16)}` : ""}`;
}

function Pair({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm"><span className="text-slate-500">{label}</span><b className="text-right font-semibold text-slate-700">{value}</b></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3><div className="space-y-2">{children}</div></section>;
}

export function ScheduleDetailsPanel({ schedule, favorite, comparing, onClose, onToggleFavorite, onToggleCompare }: { schedule: SailingSchedule | null; favorite: boolean; comparing: boolean; onClose: () => void; onToggleFavorite: (id: string) => void; onToggleCompare: (schedule: SailingSchedule) => void }) {
  if (!schedule) return <aside className="hidden rounded-lg border border-slate-200 bg-white p-6 shadow-card xl:block"><h2 className="text-lg font-semibold text-ink">船期详情</h2><p className="mt-2 text-sm text-slate-500">点击任意船期查看完整节点。</p></aside>;
  const exportSchedule = () => { const blob = new Blob([JSON.stringify(schedule, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = `${schedule.id}-schedule.json`; link.click(); URL.revokeObjectURL(url); };
  return (
    <aside className="rounded-lg border border-slate-200 bg-white shadow-card">
      <header className="border-b border-slate-200 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-ink">{schedule.vesselName || schedule.carrier}</h2>{schedule.direct === true ? <span className="rounded-full bg-ocean-50 px-2 py-1 text-xs font-semibold text-ocean-700 ring-1 ring-ocean-200">直达</span> : null}{schedule.direct === false ? <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{schedule.stopCount !== null ? `${schedule.stopCount} 次中转` : "中转"}</span> : null}</div>
            <p className="mt-1 text-sm text-slate-500">{[schedule.serviceName, schedule.carrier].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-5">
        <Section title="基本信息">
          <Pair label="船名 / Service / 航次" value={[schedule.vesselName, schedule.serviceName, schedule.voyageNumber].filter(Boolean).join(" / ")} />
          <Pair label="航线名称" value={schedule.routeName} />
          <Pair label="起运港" value={`${schedule.originPort} ${schedule.originPortCode}`} />
          <Pair label="目的港" value={`${schedule.destinationPort} ${schedule.destinationPortCode}`} />
          <Pair label="货物类型" value={schedule.cargoNature} />
          <Pair label="ETD" value={fmt(schedule.etd, schedule.etdTimeKnown !== false)} />
          <Pair label="ETA" value={fmt(schedule.eta, schedule.etaTimeKnown !== false)} />
          <Pair label="航程" value={schedule.transitDays !== null ? `${schedule.transitDays} 天` : null} />
          <Pair label="数据获取时间" value={fmt(schedule.lastUpdated)} />
          <Pair label="数据来源" value={schedule.source} />
        </Section>
        <Section title="关键时间节点">
          {[
            { label: "截载时间", value: schedule.cutOffTime, timeKnown: schedule.source !== "OOCL_LIVE_QUERY" },
            { label: "ETD", value: schedule.etd, timeKnown: schedule.etdTimeKnown !== false },
            { label: "ETA", value: schedule.eta, timeKnown: schedule.etaTimeKnown !== false },
          ].filter((item) => Boolean(item.value)).map((item) => <div key={item.label} className="flex gap-3 text-sm"><span className="mt-1 h-2 w-2 rounded-full bg-ocean-500" /><div><b className="text-ink">{item.label}</b><p className="text-slate-500">{fmt(item.value, item.timeKnown)}</p></div></div>)}
        </Section>
        {schedule.transitPorts.length ? <Section title="中转信息">{schedule.transitPorts.map((port) => <div key={port.portCode} className="rounded-md bg-slate-50 p-3 text-sm"><b>{port.portName} {port.portCode}</b><p className="mt-1 text-slate-500">到港 {fmt(port.arrivalTime)} · 离港 {fmt(port.departureTime)} · 等待 {port.waitingHours} 小时</p>{port.nextVesselName ? <p className="text-slate-500">后续船名航次：{port.nextVesselName} {port.nextVoyageNumber}</p> : null}</div>)}</Section> : null}
        {schedule.terminal || schedule.destinationTerminal ? <Section title="码头与服务"><Pair label="装货港码头" value={schedule.terminal} /><Pair label="卸货港码头" value={schedule.destinationTerminal} /></Section> : null}
        <div className="grid gap-2">
          <button type="button" onClick={() => onToggleFavorite(schedule.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><Heart className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />{favorite ? "取消收藏" : "收藏船期"}</button>
          <button type="button" onClick={() => onToggleCompare(schedule)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><GitCompare className="h-4 w-4" />{comparing ? "移出对比" : "加入对比"}</button>
          <Link href={`/atlas?routeId=${schedule.id}&origin=${schedule.originPortCode}&destination=${schedule.destinationPortCode}${schedule.vesselName ? `&vesselName=${encodeURIComponent(schedule.vesselName)}` : ""}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><Map className="h-4 w-4" />在航运地图查看</Link>
          <button type="button" onClick={exportSchedule} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white hover:brightness-110"><Download className="h-4 w-4" />导出船期</button>
        </div>
      </div>
    </aside>
  );
}
