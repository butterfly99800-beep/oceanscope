import { Navigation } from "lucide-react";
import { getStatusClassName } from "@/features/atlas/components/statusStyles";
import type { Vessel } from "@/features/atlas/types";

export function VesselListItem({ vessel, isSelected, onSelect }: { vessel: Vessel; isSelected: boolean; onSelect: (vessel: Vessel) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(vessel)}
      className={`w-full rounded-lg border p-3 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 ${
        isSelected ? "border-ocean-500 bg-ocean-50 shadow-sm" : "border-slate-200 bg-white hover:border-ocean-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Navigation className={`h-4 w-4 ${isSelected ? "text-violet-600" : "text-slate-400"}`} aria-hidden="true" />
            <h3 className="truncate text-sm font-semibold text-ink">{vessel.name}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">{vessel.type} · {vessel.area}</p>
        </div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ring-1 ${getStatusClassName(vessel.status)}`}>{vessel.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div><span className="block text-slate-400">目的港</span><span className="font-semibold text-slate-700">{vessel.nextPort}</span></div>
        <div><span className="block text-slate-400">ETA</span><span className="font-semibold text-slate-700">{vessel.eta}</span></div>
        <div><span className="block text-slate-400">更新</span><span className="font-semibold text-slate-700">{vessel.lastUpdated}</span></div>
      </div>
    </button>
  );
}
