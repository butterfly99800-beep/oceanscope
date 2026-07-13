"use client";

import { X } from "lucide-react";
import type { SailingSchedule } from "@/features/schedules/types";

export function ScheduleCompareBar({ schedules, message, onClear, onOpen, onRemove }: { schedules: SailingSchedule[]; message: string; onClear: () => void; onOpen: () => void; onRemove: (id: string) => void }) {
  if (schedules.length === 0 && !message) return null;
  return <div className="fixed bottom-0 left-0 right-0 z-[1500] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-2xl backdrop-blur"><div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><div className="text-sm font-semibold text-ink">已选择 {schedules.length}/3 条船期</div>{message ? <p className="text-xs text-rose-600">{message}</p> : null}</div><div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">{schedules.map((schedule) => <span key={schedule.id} className="inline-flex shrink-0 items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{schedule.carrier} · {schedule.vesselName}<button type="button" onClick={() => onRemove(schedule.id)}><X className="h-3.5 w-3.5" /></button></span>)}</div><div className="flex gap-2"><button type="button" onClick={onClear} className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700">清空</button><button type="button" onClick={onOpen} disabled={schedules.length === 0} className="h-9 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white disabled:opacity-50">开始对比</button></div></div></div>;
}

export function ScheduleCompareDrawer({ open, schedules, onClose }: { open: boolean; schedules: SailingSchedule[]; onClose: () => void }) {
  if (!open) return null;
  const rows: { label: string; value: (schedule: SailingSchedule) => string }[] = [
    { label: "承运商", value: (s) => s.carrier },
    { label: "Service", value: (s) => s.serviceName },
    { label: "船名航次", value: (s) => `${s.vesselName} / ${s.voyageNumber}` },
    { label: "ETD", value: (s) => s.etd.slice(0, 16).replace("T", " ") },
    { label: "ETA", value: (s) => s.eta.slice(0, 16).replace("T", " ") },
    { label: "航程天数", value: (s) => `${s.transitDays} 天` },
    { label: "中转次数", value: (s) => `${s.stopCount} 次` },
    { label: "中转港", value: (s) => s.transitPorts.map((p) => p.portCode).join(" / ") || "直达" },
    { label: "截关时间", value: (s) => s.cutOffTime.slice(0, 16).replace("T", " ") },
    { label: "准班率", value: (s) => `${s.departureReliability}%` },
    { label: "船期状态", value: (s) => s.scheduleStatus },
    { label: "备注", value: (s) => s.terminalRemark },
  ];
  return <div className="fixed inset-0 z-[2200] bg-ink/40 backdrop-blur-sm"><aside className="ml-auto h-full w-full max-w-5xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold text-ink">船期对比</h2><p className="mt-1 text-sm text-slate-500">最多对比 3 条模拟船期，不包含价格信息。</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="mt-6 overflow-x-auto"><table className="min-w-[760px] w-full border-separate border-spacing-0 text-sm"><tbody>{rows.map((row) => <tr key={row.label}><th className="sticky left-0 w-36 border-b border-slate-100 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-600">{row.label}</th>{schedules.map((schedule) => <td key={schedule.id} className="border-b border-slate-100 px-4 py-3 text-slate-700">{row.value(schedule)}</td>)}</tr>)}</tbody></table></div></aside></div>;
}
