import { Clock, Trash2 } from "lucide-react";
import type { LocationOption, RecentSearch } from "@/features/rates/types";

function nameOf(locations: LocationOption[], id: string) {
  return locations.find((location) => location.id === id)?.name ?? id;
}

export function RecentSearches({ searches, locations, onSelect, onClear }: { searches: RecentSearch[]; locations: LocationOption[]; onSelect: (search: RecentSearch) => void; onClear: () => void }) {
  if (searches.length === 0) return null;
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-semibold text-ink">最近搜索</h2><button type="button" onClick={onClear} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-ink"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />清除最近搜索</button></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {searches.map((search) => (
          <button key={search.id} type="button" onClick={() => onSelect(search)} className="rounded-lg border border-slate-200 p-3 text-left transition hover:border-ocean-300 hover:bg-ocean-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{search.date}</div>
            <div className="mt-2 text-sm font-semibold text-ink">{nameOf(locations, search.originId)} → {nameOf(locations, search.destinationId)}</div>
            <div className="mt-2 text-xs text-slate-500">{search.containerSummary} · {search.dangerous ? "危险品" : "普通货物"}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
