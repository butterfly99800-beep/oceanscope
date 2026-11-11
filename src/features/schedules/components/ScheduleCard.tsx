import { CalendarClock, GitCompare, Heart, Map, Ship } from "lucide-react";
import Link from "next/link";
import type { SailingSchedule, ScheduleStatus } from "@/features/schedules/types";

const statusClass: Record<ScheduleStatus, string> = {
  正常: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  预计延误: "bg-amber-50 text-amber-700 ring-amber-200",
  已延误: "bg-rose-50 text-rose-700 ring-rose-200",
  即将截关: "bg-violet-50 text-violet-700 ring-violet-200",
  已取消: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusClass[status]}`}>{status}</span>;
}

export function ScheduleTimeline({ schedule }: { schedule: SailingSchedule }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <Node code={schedule.originPortCode} name={schedule.originPort} label="ETD" date={schedule.etd} timeKnown={schedule.etdTimeKnown !== false} terminal={schedule.terminal} />
        <div className="hidden items-center gap-2 md:flex">
          <span className="h-2 w-2 rounded-full bg-ocean-500" />
          <div className="h-px w-20 bg-gradient-to-r from-ocean-300 to-violet-300" />
          <Ship className="h-5 w-5 text-ocean-700" aria-hidden="true" />
          <div className="h-px w-20 bg-gradient-to-r from-violet-300 to-ocean-300" />
          <span className="h-2 w-2 rounded-full bg-violet-500" />
        </div>
        <Node alignRight code={schedule.destinationPortCode} name={schedule.destinationPort} label="ETA" date={schedule.eta} timeKnown={schedule.etaTimeKnown !== false} terminal={schedule.destinationTerminal} />
      </div>
      {schedule.transitPorts.length ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          中转：{schedule.transitPorts.map((port,index) => <span key={`${port.portCode}-${index}`} className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200">{port.portName} {port.portCode}</span>)}
        </div>
      ) : null}
    </div>
  );
}

function Node({ code, name, label, date, timeKnown, terminal, alignRight = false }: { code: string; name: string; label: string; date: string; timeKnown: boolean; terminal: string | null; alignRight?: boolean }) {
  const dt = new Date(date);
  return (
    <div className={alignRight ? "text-left md:text-right" : "text-left"}>
      <div className="text-xs font-semibold uppercase text-slate-500">{code}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{label} {dt.toISOString().slice(0, 10)}</div>
      <div className="text-xs text-slate-500">{name}{timeKnown ? ` · ${dt.toISOString().slice(11, 16)}` : ""}{terminal ? ` · ${terminal}` : ""}</div>
    </div>
  );
}

export function ScheduleCard({ schedule, selected, favorite, comparing, onSelect, onToggleFavorite, onToggleCompare }: { schedule: SailingSchedule; selected: boolean; favorite: boolean; comparing: boolean; onSelect: (schedule: SailingSchedule) => void; onToggleFavorite: (id: string) => void; onToggleCompare: (schedule: SailingSchedule) => void }) {
  return (
    <article className={`rounded-lg border bg-white p-4 shadow-card transition hover:shadow-lg ${selected ? "border-ocean-500 ring-2 ring-ocean-100" : "border-slate-200"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ink text-xs font-bold text-white">{schedule.carrierCode}</span>
            <h3 className="text-base font-semibold text-ink">{schedule.carrier}</h3>
            {schedule.serviceName ? <span className="text-sm text-slate-500">{schedule.serviceName}</span> : null}
            {schedule.direct === true ? <span className="rounded-full bg-ocean-50 px-2 py-1 text-xs font-semibold text-ocean-700 ring-1 ring-ocean-200">直达</span> : null}
            {schedule.direct === false ? <span className="rounded-full bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{schedule.stopCount !== null ? `${schedule.stopCount} 次中转` : "中转"}</span> : null}
          </div>
          {schedule.routeName ? <p className="mt-2 text-sm text-slate-500">{schedule.routeName}</p> : null}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => onToggleFavorite(schedule.id)} className={`flex h-8 w-8 items-center justify-center rounded-md border ${favorite ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500 hover:text-ocean-700"}`} aria-label="收藏船期"><Heart className="h-4 w-4" fill={favorite ? "currentColor" : "none"} /></button>
          <button type="button" onClick={() => onToggleCompare(schedule)} className={`flex h-8 w-8 items-center justify-center rounded-md border ${comparing ? "border-ocean-200 bg-ocean-50 text-ocean-700" : "border-slate-200 text-slate-500 hover:text-ocean-700"}`} aria-label="加入对比"><GitCompare className="h-4 w-4" /></button>
        </div>
      </div>
      <div className="mt-3"><ScheduleTimeline schedule={schedule} /></div>
      <div className="mt-3 grid gap-3 text-sm text-slate-600 md:grid-cols-4">
        <Info icon={<Ship className="h-4 w-4" />} label="船名 / Service / 航次" value={[schedule.vesselName, schedule.serviceName, schedule.voyageNumber].filter(Boolean).join(" / ")} />
        <Info icon={<CalendarClock className="h-4 w-4" />} label="航程" value={schedule.transitDays !== null ? `${schedule.transitDays} 天` : null} />
        <Info icon={<CalendarClock className="h-4 w-4" />} label="截载时间" value={formatDate(schedule.cutOffTime)} />
        <Info icon={<Ship className="h-4 w-4" />} label="货物类型" value={schedule.cargoNature} />
      </div>
      {schedule.terminal || schedule.destinationTerminal ? <div className="mt-3 grid gap-2 text-xs text-slate-500 md:grid-cols-2">{schedule.terminal ? <span>出发地码头 {schedule.terminal}</span> : null}{schedule.destinationTerminal ? <span>目的地码头 {schedule.destinationTerminal}</span> : null}</div> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onSelect(schedule)} className="h-9 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white hover:brightness-110">查看详情</button>
        <Link href={`/atlas?routeId=${schedule.id}&origin=${schedule.originPortCode}&destination=${schedule.destinationPortCode}${schedule.vesselName ? `&vesselName=${encodeURIComponent(schedule.vesselName)}` : ""}`} className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><Map className="h-4 w-4" />在地图中查看</Link>
        <button type="button" onClick={() => onToggleCompare(schedule)} className="h-9 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700">加入对比</button>
      </div>
    </article>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return <div className="flex items-start gap-2">{icon}<span><span className="block text-xs text-slate-400">{label}</span><b className="font-semibold text-slate-700">{value}</b></span></div>;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return `${date.toISOString().slice(5, 10)} ${date.toTimeString().slice(0, 5)}`;
}
