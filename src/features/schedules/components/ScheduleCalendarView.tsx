"use client";

import { useEffect, useMemo, useState } from "react";
import type { SailingSchedule } from "@/features/schedules/types";

const dayKey = (date: Date) => date.toISOString().slice(0, 10);
export function ScheduleCalendarView({ schedules, startDate, onSelect }: { schedules: SailingSchedule[]; startDate: string; onSelect: (schedule: SailingSchedule) => void }) {
  const initial = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : dayKey(new Date());
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(initial);
  useEffect(() => { setMonth(initial.slice(0, 7)); setSelectedDay(initial); }, [initial]);
  const grouped = useMemo(() => {
    const result = new Map<string, SailingSchedule[]>();
    for (const schedule of schedules) {
      const key = schedule.etd.slice(0, 10);
      result.set(key, [...(result.get(key) || []), schedule]);
    }
    return result;
  }, [schedules]);
  const first = new Date(`${month}-01T00:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const days = Array.from({ length: 42 }, (_, i) => new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1 - offset + i)));
  const selected = [...(grouped.get(selectedDay) || [])].sort((a,b) => a.etd.localeCompare(b.etd) || (a.eta || "").localeCompare(b.eta || ""));
  const move = (amount: number) => setMonth(dayKey(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + amount, 1))).slice(0, 7));
  return <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-card sm:p-5">
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-lg font-semibold text-ink">{first.getUTCFullYear()} 年 {first.getUTCMonth() + 1} 月</h3>
      <div className="flex gap-2"><button type="button" aria-label="上个月" onClick={() => move(-1)} className="rounded border px-3 py-2">‹</button><button type="button" onClick={() => {setMonth(initial.slice(0,7));setSelectedDay(initial);}} className="rounded border px-3 py-2 text-sm">查询起始月</button><button type="button" aria-label="下个月" onClick={() => move(1)} className="rounded border px-3 py-2">›</button></div>
    </div>
    <div className="grid grid-cols-7 text-center text-sm text-slate-500">{["一","二","三","四","五","六","日"].map(day => <div key={day} className="py-2">周{day}</div>)}</div>
    <div className="grid grid-cols-7 gap-1">{days.map(day => {
      const key=dayKey(day), items=grouped.get(key)||[], chosen=key===selectedDay;
      return <button key={key} type="button" aria-label={`${key}，${items.length} 条船期`} aria-pressed={chosen} onClick={() => {setSelectedDay(key);setMonth(key.slice(0,7));}} className={`min-h-20 min-w-0 rounded border p-1 text-left sm:p-2 ${chosen ? "border-ocean-500 bg-ocean-50 ring-1 ring-ocean-500" : "border-slate-100 hover:bg-slate-50"} ${key.startsWith(month) ? "text-ink" : "text-slate-400"}`}>
        <span className="block text-sm font-semibold">{day.getUTCDate()}</span>
        {items.length ? <><span className="mt-1 block text-xs font-semibold text-ocean-700">{items.length} 条</span><span className="mt-1 hidden truncate text-xs text-slate-500 sm:block">{[...new Set(items.map(item=>item.carrier))].join(" · ")}</span></> : null}
      </button>;
    })}</div>
    <div className="mt-5 border-t pt-4"><h4 className="font-semibold text-ink">{selectedDay} 当天船期（{selected.length} 条）</h4>
      {selected.length ? <div className="mt-3 grid gap-3 md:grid-cols-2">{selected.map(schedule=><button key={schedule.id} type="button" onClick={()=>onSelect(schedule)} className="rounded-lg border border-slate-200 p-3 text-left hover:border-ocean-500">
        <div className="font-semibold">{schedule.carrier} · {schedule.vesselName || "船名未提供"}</div>
        <div className="mt-1 text-sm">{schedule.originPort} → {schedule.destinationPort}</div>
        <div className="mt-1 text-sm text-slate-500">{[schedule.serviceName,schedule.voyageNumber].filter(Boolean).join(" / ")}</div>
        <div className="mt-1 text-sm text-slate-500">离港 {schedule.etd.slice(0,10)} · 到达 {schedule.eta?.slice(0,10) || "—"}</div>
        <span className="mt-2 block text-sm font-semibold text-ocean-700">查看船期详情</span>
      </button>)}</div> : <p className="py-6 text-sm text-slate-500">当前查询结果中，这一天没有船期。</p>}
    </div>
  </section>;
}
