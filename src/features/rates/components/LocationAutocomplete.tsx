"use client";

import { Anchor, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import type { LocationOption } from "@/features/rates/types";

function matches(location: LocationOption, query: string) {
  const q = query.trim().toLowerCase();
  return q.length > 0 && [location.name, location.country, location.region, location.locode, location.type, ...location.aliases].some((value) => value.toLowerCase().includes(q));
}

export function LocationAutocomplete({ label, value, selectedId, locations, error, onInputChange, onSelect }: { label: string; value: string; selectedId: string; locations: LocationOption[]; error?: string; onInputChange: (value: string) => void; onSelect: (location: LocationOption) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const suggestions = useMemo(() => locations.filter((location) => matches(location, value)).slice(0, 6), [locations, value]);

  const choose = (location: LocationOption) => {
    onSelect(location);
    setIsOpen(false);
    setActiveIndex(0);
  };

  return (
    <label className="relative block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <div className={`flex h-11 items-center gap-2 rounded-md border bg-white px-3 shadow-sm transition focus-within:ring-4 focus-within:ring-ocean-100 ${error ? "border-rose-300" : "border-slate-300 focus-within:border-ocean-500"}`}>
        <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <input
          value={value}
          onFocus={() => setIsOpen(value.trim().length > 0)}
          onChange={(event) => { onInputChange(event.target.value); setIsOpen(event.target.value.trim().length > 0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(suggestions.length - 1, index + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
            if (event.key === "Enter" && suggestions[activeIndex]) { event.preventDefault(); choose(suggestions[activeIndex]); }
            if (event.key === "Escape") setIsOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          placeholder="城市 / 港口 / 地址 / 邮编 / UN LOCODE"
        />
        {selectedId ? <Anchor className="h-4 w-4 text-ocean-600" aria-hidden="true" /> : null}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-2xl">
          {suggestions.length > 0 ? suggestions.map((location, index) => (
            <button key={location.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(location)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition ${activeIndex === index ? "bg-ocean-50" : "hover:bg-slate-50"}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ocean-100 text-ocean-700"><MapPin className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{location.name}</span><span className="block truncate text-xs text-slate-500">{location.type} · {location.country} · {location.locode}</span></span>
            </button>
          )) : <div className="px-3 py-4 text-sm text-slate-500">未找到匹配地点</div>}
        </div>
      ) : null}
    </label>
  );
}
