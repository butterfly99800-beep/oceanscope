"use client";

import { ArrowLeftRight, Search } from "lucide-react";
import { ContainerSelector } from "@/features/rates/components/ContainerSelector";
import { LocationAutocomplete } from "@/features/rates/components/LocationAutocomplete";
import type { LocationOption, RateSearchCriteria, ValidationErrors } from "@/features/rates/types";

function labelFor(locations: LocationOption[], id: string) {
  return locations.find((location) => location.id === id)?.name ?? id;
}

export function RateSearchForm({ criteria, locations, errors, compact = false, isLoading, onChange, onSubmit }: { criteria: RateSearchCriteria; locations: LocationOption[]; errors: ValidationErrors; compact?: boolean; isLoading: boolean; onChange: (criteria: RateSearchCriteria) => void; onSubmit: () => void }) {
  const originLabel = labelFor(locations, criteria.originId);
  const destinationLabel = labelFor(locations, criteria.destinationId);
  const setLocation = (key: "originId" | "destinationId", location: LocationOption) => onChange({ ...criteria, [key]: location.id });
  const swap = () => onChange({ ...criteria, originId: criteria.destinationId, destinationId: criteria.originId });

  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-card ${compact ? "p-4" : "p-5 sm:p-6"}`}>
      <div className={compact ? "grid gap-4" : "grid gap-5 lg:grid-cols-[1fr_auto_1fr_180px]"}>
        <LocationAutocomplete label="起运地" value={originLabel} selectedId={criteria.originId} locations={locations} error={errors.originId} onInputChange={(value) => onChange({ ...criteria, originId: value })} onSelect={(location) => setLocation("originId", location)} />
        <div className={compact ? "flex justify-center" : "flex items-end justify-center pb-1"}>
          <button type="button" onClick={swap} className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 hover:border-ocean-500 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100" aria-label="交换起运地和目的地">
            <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <LocationAutocomplete label="目的地" value={destinationLabel} selectedId={criteria.destinationId} locations={locations} error={errors.destinationId} onInputChange={(value) => onChange({ ...criteria, destinationId: value })} onSelect={(location) => setLocation("destinationId", location)} />
        <DateField value={criteria.cargoReadyDate} error={errors.cargoReadyDate} onChange={(cargoReadyDate) => onChange({ ...criteria, cargoReadyDate })} />
      </div>
      <div className={compact ? "mt-5 grid gap-5" : "mt-6 grid gap-6 lg:grid-cols-[220px_1fr]"}>
        <TransportAndCargo criteria={criteria} onChange={onChange} />
        <ContainerSelector compact={compact} value={criteria.containers} error={errors.containers} onChange={(containers) => onChange({ ...criteria, containers })} />
      </div>
      <div className={compact ? "mt-5" : "mt-6 flex justify-end"}>
        <SubmitButton fullWidth={compact} isLoading={isLoading} onSubmit={onSubmit} />
      </div>
    </section>
  );
}

function DateField({ value, error, onChange }: { value: string; error?: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">货好日期</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className={`h-11 w-full rounded-md border bg-white px-3 text-sm text-ink shadow-sm outline-none transition focus:ring-4 focus:ring-ocean-100 ${error ? "border-rose-300" : "border-slate-300 focus:border-ocean-500"}`} />{error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}</label>;
}

function TransportAndCargo({ criteria, onChange }: { criteria: RateSearchCriteria; onChange: (criteria: RateSearchCriteria) => void }) {
  return <div className="space-y-5"><label className="block"><span className="mb-2 block text-sm font-semibold text-slate-700">运输方式</span><select value={criteria.transportMode} onChange={(event) => onChange({ ...criteria, transportMode: event.target.value as RateSearchCriteria["transportMode"] })} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option>整箱海运</option><option>海铁联运</option><option>卡车转运</option></select></label><div className="rounded-lg border border-slate-200 p-3"><div className="text-sm font-semibold text-slate-700">货物类型</div><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => onChange({ ...criteria, cargoType: "general" })} className={`rounded-md px-3 py-2 text-sm font-semibold ring-1 ${criteria.cargoType === "general" ? "bg-ocean-50 text-ocean-700 ring-ocean-200" : "text-slate-600 ring-slate-200"}`}>普通货物</button><button type="button" onClick={() => onChange({ ...criteria, cargoType: "dangerous" })} className={`rounded-md px-3 py-2 text-sm font-semibold ring-1 ${criteria.cargoType === "dangerous" ? "bg-amber-50 text-amber-700 ring-amber-200" : "text-slate-600 ring-slate-200"}`}>危险品</button></div>{criteria.cargoType === "dangerous" ? <p className="mt-2 text-xs leading-5 text-amber-700">危险品运输需要额外审核，模拟报价可能包含危险品附加费。</p> : null}</div></div>;
}

function SubmitButton({ fullWidth = false, isLoading, onSubmit }: { fullWidth?: boolean; isLoading: boolean; onSubmit: () => void }) {
  return <button type="button" onClick={onSubmit} disabled={isLoading} className={`inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 ${fullWidth ? "w-full" : ""}`}><Search className="h-4 w-4" aria-hidden="true" />{isLoading ? "查询中..." : "查询运价"}</button>;
}
