"use client";

import { Anchor, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoscoCitySelection, PortOption } from "@/features/schedules/types";

export function PortAutocomplete({ label, value, selectedId, error, onInputChange, onSelect }: { label: string; value: string; selectedId: string; ports: PortOption[]; error?: string; onInputChange: (value: string) => void; onSelect: (port: PortOption) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coscoCities, setCoscoCities] = useState<CoscoCitySelection[]>([]);
  const [loadingCosco, setLoadingCosco] = useState(false);
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const coscoSuggestions = useMemo<PortOption[]>(() => coscoCities.map((city) => ({
    id: `cosco:${city.uuid}`,
    name: city.name,
    localName: city.fullName,
    country: city.country,
    city: city.name,
    code: city.locode || city.cityCode,
    aliases: [city.fullName, city.locode, city.cityCode].filter(Boolean),
    coscoCity: city,
  })), [coscoCities]);
  const suggestions = useMemo(() => coscoSuggestions.slice(0, 15), [coscoSuggestions]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (!open || query.length < 1) {
      setCoscoCities([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoadingCosco(true);
      fetch(`/api/cosco/cities/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<{ data: CoscoCitySelection[] }> : Promise.reject())
        .then((payload) => setCoscoCities(payload.data))
        .catch(() => {
          if (!controller.signal.aborted) setCoscoCities([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingCosco(false);
        });
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, value]);

  return (
    <label ref={rootRef} className="relative block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <div className={`flex h-11 items-center gap-2 rounded-md border bg-white px-3 shadow-sm ${error ? "border-rose-300" : "border-slate-300 focus-within:border-ocean-500 focus-within:ring-4 focus-within:ring-ocean-100"}`}>
        <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input value={value} onFocus={() => setOpen(true)} onChange={(event) => { onInputChange(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(0, suggestions.length - 1))); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && suggestions[activeIndex]) { event.preventDefault(); onSelect(suggestions[activeIndex]); setOpen(false); }
        }} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" placeholder="搜索港口、城市或代码" />
        {selectedId ? <Anchor className="h-4 w-4 text-ocean-600" aria-hidden="true" /> : null}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
      {open && value.trim() ? (
        <div className="absolute left-0 right-0 top-[74px] z-[1200] max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {loadingCosco ? <div className="px-3 py-2 text-xs font-medium text-slate-500">正在查询承运人城市候选...</div> : null}
          {suggestions.length ? suggestions.map((port, index) => (
            <button key={port.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(port); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${index === activeIndex ? "bg-ocean-50" : "hover:bg-slate-50"}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#eaf2fb] text-[#2f68a8]"><Anchor className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{port.coscoCity?.fullName}</span><span className="block truncate text-xs text-slate-500">{port.coscoCity?.locode || port.coscoCity?.cityCode || port.coscoCity?.name}</span></span>
            </button>
          )) : <div className="px-3 py-4 text-sm text-slate-500">未找到匹配城市</div>}
        </div>
      ) : null}
    </label>
  );
}
