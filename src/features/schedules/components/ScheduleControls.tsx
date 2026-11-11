import { CalendarDays, LayoutGrid, Table2 } from "lucide-react";
import type { ScheduleSortOption, ScheduleViewMode } from "@/features/schedules/types";

export function ScheduleControls({ view, sort, onViewChange, onSortChange }: { view: ScheduleViewMode; sort: ScheduleSortOption; onViewChange: (view: ScheduleViewMode) => void; onSortChange: (sort: ScheduleSortOption) => void }) {
  const views: { value: ScheduleViewMode; label: string; icon: React.ReactNode }[] = [
    { value: "table", label: "表格", icon: <Table2 className="h-4 w-4" /> },
    { value: "cards", label: "模块", icon: <LayoutGrid className="h-4 w-4" /> },
    { value: "calendar", label: "日历", icon: <CalendarDays className="h-4 w-4" /> },
  ];
  return <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between"><div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">{views.map((item) => <button key={item.value} type="button" onClick={() => onViewChange(item.value)} className={`inline-flex h-9 items-center gap-2 rounded px-3 text-sm font-semibold ${view === item.value ? "bg-white text-ocean-700 shadow-sm" : "text-slate-600 hover:text-ink"}`}>{item.icon}{item.label}</button>)}</div><select value={sort} onChange={(event) => onSortChange(event.target.value as ScheduleSortOption)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="recommended">默认：离港时间</option><option value="earliestDeparture">最早出发</option><option value="earliestArrival">最早到达</option><option value="shortestTransit">航程最短</option><option value="fewestStops">中转次数最少</option></select></div>;
}
