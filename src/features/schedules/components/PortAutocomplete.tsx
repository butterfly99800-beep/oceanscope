"use client";

import { Anchor, MapPin } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PortOption } from "@/features/schedules/types";

function matches(port: PortOption, query: string) {
  const value = query.trim().toLowerCase();
  const haystack = [port.name, port.localName, port.country, port.city, port.code, ...port.aliases].join(" ").toLowerCase();
  return haystack.includes(value);
}

export function PortAutocomplete({ label, value, selectedId, ports, error, onInputChange, onSelect }: { label: string; value: string; selectedId: string; ports: PortOption[]; error?: string; onInputChange: (value: string) => void; onSelect: (port: PortOption) => void }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLLabelElement | null>(null);
  const suggestions = useMemo(() => value.trim() ? ports.filter((port) => matches(port, value)).slice(0, 8) : [], [ports, value]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
        <div className="absolute left-0 right-0 top-[74px] z-[1200] max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {suggestions.length ? suggestions.map((port, index) => (
            <button key={port.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(port); setOpen(false); }} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left ${index === activeIndex ? "bg-ocean-50" : "hover:bg-slate-50"}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-ocean-700"><Anchor className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{port.name} · {port.localName}</span><span className="block truncate text-xs text-slate-500">{port.city}, {port.country} · {port.code}</span></span>
            </button>
          )) : <div className="px-3 py-4 text-sm text-slate-500">未找到匹配港口</div>}
        </div>
      ) : null}
    </label>
  );
}
