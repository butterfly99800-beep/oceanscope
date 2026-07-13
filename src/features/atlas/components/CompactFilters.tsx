"use client";

import { SlidersHorizontal, X } from "lucide-react";
import type { AtlasFilters, PortRegion, VesselStatus, VesselType } from "@/features/atlas/types";

const vesselTypes: Array<"全部" | VesselType> = ["全部", "集装箱船", "散货船", "油轮"];
const statuses: Array<"全部" | VesselStatus> = ["全部", "航行中", "锚泊中", "靠港中"];
const regions: Array<"全球" | PortRegion> = ["全球", "东亚", "东南亚", "北美西岸", "欧洲"];
const updates: AtlasFilters["updatedWithin"][] = ["全部", "15 分钟内", "1 小时内", "24 小时内"];

function activeCount(filters: AtlasFilters) {
  return [filters.vesselType !== "全部", filters.status !== "全部", filters.region !== "全球", filters.updatedWithin !== "全部"].filter(Boolean).length;
}

function ChipGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (value: T) => void }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold text-slate-500">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 transition ${value === option ? "bg-ocean-50 text-ocean-700 ring-ocean-200" : "bg-white text-slate-600 ring-slate-200 hover:ring-ocean-200"}`}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CompactFilters({ filters, isOpen, onToggle, onChange, onClear }: { filters: AtlasFilters; isOpen: boolean; onToggle: () => void; onChange: (filters: AtlasFilters) => void; onClear: () => void }) {
  const count = activeCount(filters);
  const activeLabels = [filters.vesselType !== "全部" ? filters.vesselType : null, filters.status !== "全部" ? filters.status : null, filters.region !== "全球" ? filters.region : null, filters.updatedWithin !== "全部" ? filters.updatedWithin : null].filter(Boolean);

  return (
    <section className="border-b border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={onToggle} className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          全部筛选{count > 0 ? ` · ${count}` : ""}
        </button>
        {count > 0 ? (
          <button type="button" onClick={onClear} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-ink">
            <X className="h-3.5 w-3.5" aria-hidden="true" />清除
          </button>
        ) : null}
      </div>
      {activeLabels.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{activeLabels.map((label) => <span key={label} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">{label}</span>)}</div> : null}
      {isOpen ? (
        <div className="mt-3 space-y-3 rounded-lg bg-slate-50 p-3">
          <ChipGroup label="船舶类型" value={filters.vesselType} options={vesselTypes} onChange={(vesselType) => onChange({ ...filters, vesselType })} />
          <ChipGroup label="航行状态" value={filters.status} options={statuses} onChange={(status) => onChange({ ...filters, status })} />
          <ChipGroup label="港口区域" value={filters.region} options={regions} onChange={(region) => onChange({ ...filters, region })} />
          <ChipGroup label="更新时间" value={filters.updatedWithin} options={updates} onChange={(updatedWithin) => onChange({ ...filters, updatedWithin })} />
        </div>
      ) : null}
    </section>
  );
}
