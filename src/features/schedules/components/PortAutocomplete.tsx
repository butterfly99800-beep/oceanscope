"use client";

import { locationMatchScore } from "../lib/locationMatch";
import { Anchor, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CoscoCitySelection, PortOption } from "@/features/schedules/types";

export function PortAutocomplete({ label, value, selectedId, ports, error, onInputChange, onSelect }: { label: string; value: string; selectedId: string; ports: PortOption[]; error?: string; onInputChange: (value: string) => void; onSelect: (port: PortOption) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [coscoCities, setCoscoCities] = useState<CoscoCitySelection[]>([]);
  const [matchedPorts, setMatchedPorts] = useState<PortOption[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [loadingCosco, setLoadingCosco] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
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
  const suggestions = useMemo(() => {
    const candidates = [...(resultQuery === value.trim() ? coscoSuggestions : []), ...(resultQuery === value.trim() ? matchedPorts : []), ...ports];
    const seen = new Set<string>();
    return candidates.map(port => ({port, score: locationMatchScore(value, [port.name, (port.localName || "").split(",")[0], [port.name, port.country].filter(Boolean).join(", ")], [port.code || ""])}))
      .filter(x => x.score > 0).sort((a,b) => b.score-a.score || a.port.name.localeCompare(b.port.name))
      .filter(({port}) => { const key = (port.code || port.id).toUpperCase(); if(seen.has(key)) return false; seen.add(key); return true; })
      .slice(0,15).map(x => x.port);
  }, [coscoSuggestions, matchedPorts, ports, resultQuery, value]);

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
      setLoadingCosco(false);
      return;
    }

    const controller = new AbortController();
    setLoadingCosco(true);
    setActiveIndex(0);
    const timer = window.setTimeout(() => {
      setLoadingCosco(true);
      let pending = 2;
      const finish = () => { pending--; if (!controller.signal.aborted && pending === 0) setLoadingCosco(false); };
      setCoscoCities([]); setMatchedPorts([]); setResultQuery(query);
      fetch(`/api/cosco/cities/search?q=${encodeURIComponent(query)}`, {signal: controller.signal})
        .then(r => r.ok ? r.json() : {data: []}).then(payload => { if (!controller.signal.aborted) setCoscoCities(payload.data || []); }).catch(() => {}).finally(finish);
      fetch(`/api/ports/search?q=${encodeURIComponent(query)}&pageSize=100`, {signal: controller.signal})
        .then(r => r.ok ? r.json() : {data: []}).then(payload => { if (!controller.signal.aborted) setMatchedPorts(payload.data || []); }).catch(() => {}).finally(finish);
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, value]);

  return (
    <div ref={rootRef} className="relative block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>
      <div className={`flex h-11 items-center gap-2 rounded-md border bg-white px-3 shadow-sm ${error ? "border-rose-300" : "border-slate-300 focus-within:border-ocean-500 focus-within:ring-4 focus-within:ring-ocean-100"}`}>
        <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input aria-label={label} value={value} onClick={() => setOpen(true)} onFocus={() => setOpen(true)} onChange={(event) => { onInputChange(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, Math.max(0, suggestions.length - 1))); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && open && suggestions[activeIndex]) { event.preventDefault(); onSelect(suggestions[activeIndex]); setOpen(false); }
        }} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" placeholder="搜索港口、城市或代码" />
        {value && <button type="button" aria-label={`清空${label}`} onMouseDown={event => event.preventDefault()} onClick={() => { onInputChange(""); setOpen(false); setActiveIndex(0); }} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X className="h-4 w-4" /></button>}
        {selectedId ? <Anchor className="h-4 w-4 text-ocean-600" aria-hidden="true" /> : null}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
      {open && value.trim() ? (
        <div className="absolute left-0 right-0 top-[74px] z-[1200] max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {loadingCosco ? <div className="px-3 py-2 text-xs font-medium text-slate-500">正在查找地点...</div> : null}
          {suggestions.length ? suggestions.map((port, index) => (
            <button key={port.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(port); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${index === activeIndex ? "bg-ocean-50" : "hover:bg-slate-50"}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#eaf2fb] text-[#2f68a8]"><Anchor className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{[port.name, port.country].filter(Boolean).join(", ")}</span><span className="block truncate text-xs text-slate-500">{[port.code, port.coscoCity?.fullName || port.localName].filter(Boolean).join(" · ")}</span></span>
            </button>
          )) : !loadingCosco ? <div className="px-3 py-4 text-sm text-slate-500">未找到匹配城市</div> : null}
        </div>
      ) : null}
    </div>
  );
}
