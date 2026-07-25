"use client";

import { ArrowLeftRight, RefreshCw, Search } from "lucide-react";
import { PortAutocomplete } from "@/features/schedules/components/PortAutocomplete";
import type { PortOption, ScheduleSearchCriteria } from "@/features/schedules/types";

function labelFor(ports: PortOption[], id: string) {
  const port = ports.find((item) => item.id === id);
  return port ? `${port.name}, ${port.country}` : id;
}

export function ScheduleSearchForm({ criteria, ports, compact = false, errors, isLoading, onChange, onSubmit }: { criteria: ScheduleSearchCriteria; ports: PortOption[]; compact?: boolean; errors: Partial<Record<keyof ScheduleSearchCriteria, string>>; isLoading: boolean; onChange: (criteria: ScheduleSearchCriteria) => void; onSubmit: () => void }) {
  const originLabel = criteria.originCoscoCity?.fullName || labelFor(ports, criteria.originPortId);
  const destinationLabel = criteria.destinationCoscoCity?.fullName || labelFor(ports, criteria.destinationPortId);
  const setPort = (key: "originPortId" | "destinationPortId", port: PortOption) => {
    const coscoKey = key === "originPortId" ? "originCoscoCity" : "destinationCoscoCity";
    onChange({ ...criteria, [key]: port.id, [coscoKey]: port.coscoCity });
  };
  const setInput = (key: "originPortId" | "destinationPortId", value: string) => {
    const coscoKey = key === "originPortId" ? "originCoscoCity" : "destinationCoscoCity";
    onChange({ ...criteria, [key]: value, [coscoKey]: undefined });
  };
  const swap = () => onChange({
    ...criteria,
    originPortId: criteria.destinationPortId,
    destinationPortId: criteria.originPortId,
    originCoscoCity: criteria.destinationCoscoCity,
    destinationCoscoCity: criteria.originCoscoCity,
  });

  return (
    <section className={`rounded-md border border-slate-200 bg-white shadow-card ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-700">Sailing Schedules / Find Schedule by City Pairs</span>
        <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
        <span>Origin City</span>
        <span>Destination City</span>
        <span>Earliest Departure Date</span>
      </div>
      <div className={compact ? "grid gap-3 lg:grid-cols-[minmax(170px,1fr)_auto_minmax(170px,1fr)_160px_96px_96px]" : "grid gap-4 lg:grid-cols-[minmax(190px,1fr)_auto_minmax(190px,1fr)_170px_104px_104px]"}>
        <PortAutocomplete label="起运港" value={originLabel} selectedId={criteria.originPortId} ports={ports} error={errors.originPortId} onInputChange={(value) => setInput("originPortId", value)} onSelect={(port) => setPort("originPortId", port)} />
        <div className="flex items-end justify-center pb-1"><button type="button" onClick={swap} className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-ocean-500 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100" aria-label="交换港口"><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /></button></div>
        <PortAutocomplete label="目的港" value={destinationLabel} selectedId={criteria.destinationPortId} ports={ports} error={errors.destinationPortId} onInputChange={(value) => setInput("destinationPortId", value)} onSelect={(port) => setPort("destinationPortId", port)} />
        <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">最早出发日期</span><input type="date" value={criteria.departureDate} onChange={(event) => onChange({ ...criteria, departureDate: event.target.value })} className={`h-10 w-full rounded border bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-ocean-100 ${errors.departureDate ? "border-rose-300" : "border-slate-300 focus:border-ocean-500"}`} />{errors.departureDate ? <p className="mt-1 text-xs font-medium text-rose-600">{errors.departureDate}</p> : null}</label>
        <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">前</span><select value={criteria.beforeDays} onChange={(event) => onChange({ ...criteria, beforeDays: event.target.value })} className="h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="0">0 天</option><option value="3">3 天</option><option value="7">7 天</option><option value="14">14 天</option></select></label><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">后</span><select value={criteria.afterDays} onChange={(event) => onChange({ ...criteria, afterDays: event.target.value })} className="h-10 w-full rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="7">7 天</option><option value="14">14 天</option><option value="28">28 天</option><option value="35">35 天</option></select></label>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={criteria.directOnly} onChange={(event) => onChange({ ...criteria, directOnly: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" />仅查看直达</label>
        <button type="button" onClick={onSubmit} disabled={isLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded bg-[#2f68a8] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#285b92] disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">{isLoading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}{isLoading ? "正在查询最新船期..." : "Search"}</button>
      </div>
    </section>
  );
}


