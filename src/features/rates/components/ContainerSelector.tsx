import { Minus, Plus } from "lucide-react";
import { containerDescriptions } from "@/features/rates/data/mock-rate-data";
import type { ContainerSelection, ContainerType } from "@/features/rates/types";

const containerTypes: ContainerType[] = ["20GP", "40GP", "40HC", "45HC"];

export function ContainerSelector({ value, error, compact = false, onChange }: { value: ContainerSelection; error?: string; compact?: boolean; onChange: (value: ContainerSelection) => void }) {
  const update = (type: ContainerType, count: number) => {
    onChange({ ...value, [type]: Math.max(0, Math.min(20, Math.round(count))) });
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">箱型和数量</span>
        {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
      </div>
      <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
        {containerTypes.map((type) => (
          <div key={type} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-ink">{type}</div>
            <p className="mt-1 min-h-8 text-xs leading-4 text-slate-500">{containerDescriptions[type]}</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => update(type, value[type] - 1)} disabled={value[type] === 0} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-ocean-500 hover:text-ocean-700 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
                <Minus className="h-4 w-4" aria-hidden="true" />
              </button>
              <input value={value[type]} onChange={(event) => update(type, Number(event.target.value))} className="h-8 min-w-0 flex-1 rounded-md border border-slate-300 text-center text-sm font-semibold outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" />
              <button type="button" onClick={() => update(type, value[type] + 1)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-600 hover:border-ocean-500 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
                <Plus className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
