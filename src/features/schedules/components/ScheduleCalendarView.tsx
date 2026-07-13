import { ScheduleStatusBadge } from "@/features/schedules/components/ScheduleCard";
import type { SailingSchedule } from "@/features/schedules/types";

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function ScheduleCalendarView({ schedules, startDate, onSelect }: { schedules: SailingSchedule[]; startDate: string; onSelect: (schedule: SailingSchedule) => void }) {
  const base = startDate ? new Date(startDate) : new Date("2026-07-13");
  const days = Array.from({ length: 14 }, (_, index) => addDays(base, index));
  return <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-card"><div className="overflow-x-auto"><div className="grid min-w-[1120px] grid-cols-14 gap-3">{days.map((day) => { const key = day.toISOString().slice(0, 10); const daySchedules = schedules.filter((schedule) => schedule.etd.startsWith(key)); return <div key={key} className="min-h-72 rounded-lg bg-slate-50 p-2"><div className="sticky top-0 rounded-md bg-white px-2 py-2 text-center text-xs font-semibold text-slate-600 shadow-sm">{key.slice(5)}</div><div className="mt-2 space-y-2">{daySchedules.map((schedule) => <button key={schedule.id} type="button" onClick={() => onSelect(schedule)} className="w-full rounded-md border border-slate-200 bg-white p-2 text-left shadow-sm hover:border-ocean-300"><div className="text-xs font-semibold text-ink">{schedule.carrier}</div><div className="mt-1 text-xs text-slate-500">{schedule.vesselName} {schedule.voyageNumber}</div><div className="mt-1 text-xs text-slate-500">{schedule.originPortCode} → {schedule.destinationPortCode}</div><div className="mt-2"><ScheduleStatusBadge status={schedule.scheduleStatus} /></div></button>)}</div></div>; })}</div></div></div>;
}
