"use client";

import { ArrowLeftRight, RefreshCw, Search } from "lucide-react";
import { PortAutocomplete } from "@/features/schedules/components/PortAutocomplete";
import type { DateRangeOption, PortOption, ScheduleSearchCriteria } from "@/features/schedules/types";

function labelFor(ports: PortOption[], id: string) {
  const port = ports.find((item) => item.id === id);
  return port ? `${port.name}, ${port.country}` : id;
}

export function ScheduleSearchForm({ criteria, ports, compact = false, errors, isLoading, onChange, onSubmit }: { criteria: ScheduleSearchCriteria; ports: PortOption[]; compact?: boolean; errors: Partial<Record<keyof ScheduleSearchCriteria, string>>; isLoading: boolean; onChange: (criteria: ScheduleSearchCriteria) => void; onSubmit: () => void }) {
  const originLabel = labelFor(ports, criteria.originPortId);
  const destinationLabel = labelFor(ports, criteria.destinationPortId);
  const setPort = (key: "originPortId" | "destinationPortId", port: PortOption) => onChange({ ...criteria, [key]: port.id });
  const swap = () => onChange({ ...criteria, originPortId: criteria.destinationPortId, destinationPortId: criteria.originPortId });

  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-card ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className={compact ? "grid gap-4 lg:grid-cols-[1fr_auto_1fr_180px_170px]" : "grid gap-5 lg:grid-cols-[1fr_auto_1fr_180px_170px]"}>
        <PortAutocomplete label="起运港" value={originLabel} selectedId={criteria.originPortId} ports={ports} error={errors.originPortId} onInputChange={(value) => onChange({ ...criteria, originPortId: value })} onSelect={(port) => setPort("originPortId", port)} />
        <div className="flex items-end justify-center pb-1"><button type="button" onClick={swap} className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-ocean-500 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100" aria-label="交换港口"><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /></button></div>
        <PortAutocomplete label="目的港" value={destinationLabel} selectedId={criteria.destinationPortId} ports={ports} error={errors.destinationPortId} onInputChange={(value) => onChange({ ...criteria, destinationPortId: value })} onSelect={(port) => setPort("destinationPortId", port)} />
        <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">预计出发日期</span><input type="date" value={criteria.departureDate} onChange={(event) => onChange({ ...criteria, departureDate: event.target.value })} className={`h-11 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-ocean-100 ${errors.departureDate ? "border-rose-300" : "border-slate-300 focus:border-ocean-500"}`} />{errors.departureDate ? <p className="mt-1 text-xs font-medium text-rose-600">{errors.departureDate}</p> : null}</label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">日期范围</span><select value={criteria.dateRange} onChange={(event) => onChange({ ...criteria, dateRange: event.target.value as DateRangeOption })} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="3">前后 3 天</option><option value="7">前后 7 天</option><option value="14">前后 14 天</option><option value="custom">自定义范围</option></select></label>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={criteria.directOnly} onChange={(event) => onChange({ ...criteria, directOnly: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" />仅查看直达</label>
        <button type="button" onClick={onSubmit} disabled={isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">{isLoading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}{isLoading ? "查询中..." : "查询船期"}</button>
      </div>
    </section>
  );
}
