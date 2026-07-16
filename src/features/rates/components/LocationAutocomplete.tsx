"use client";

import { Anchor, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import type { LocationOption } from "@/features/rates/types";

const text = {
  placeholder: "\u57ce\u5e02 / \u6e2f\u53e3 / \u5730\u5740 / \u90ae\u7f16 / UN LOCODE",
  portType: "\u6e2f\u53e3",
  empty: "\u672a\u627e\u5230\u5339\u914d\u5730\u70b9",
};

function normalizeSearchValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeAliases(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function matches(location: LocationOption, query: string) {
  const q = normalizeSearchValue(query);
  if (!q) return false;
  const values = [
    location.name,
    location.nameZh,
    location.country,
    location.countryCode,
    location.region,
    location.locode,
    location.type,
    location.city,
    location.address,
    location.postalCode,
    ...safeAliases(location.aliases),
  ];
  return values.some((value) => normalizeSearchValue(value).includes(q));
}

function displayText(value: unknown, fallback = "-") {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
}

export function LocationAutocomplete({ label, value, selectedId, locations, error, onInputChange, onSelect }: { label: string; value: string; selectedId: string; locations?: LocationOption[]; error?: string; onInputChange: (value: string) => void; onSelect: (location: LocationOption) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeLocations = useMemo(() => Array.isArray(locations) ? locations.filter((location) => typeof location.id === "string" && typeof location.name === "string") : [], [locations]);
  const suggestions = useMemo(() => safeLocations.filter((location) => matches(location, value)).slice(0, 6), [safeLocations, value]);

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
          onChange={(event) => { onInputChange(event.target.value); setIsOpen(event.target.value.trim().length > 0); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(Math.max(0, suggestions.length - 1), index + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
            if (event.key === "Enter" && suggestions[activeIndex]) { event.preventDefault(); choose(suggestions[activeIndex]); }
            if (event.key === "Escape") setIsOpen(false);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-slate-400"
          placeholder={text.placeholder}
        />
        {selectedId ? <Anchor className="h-4 w-4 text-ocean-600" aria-hidden="true" /> : null}
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null}
      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-[1200] mt-2 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-2xl">
          {suggestions.length > 0 ? suggestions.map((location, index) => (
            <button key={location.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => choose(location)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition ${activeIndex === index ? "bg-ocean-50" : "hover:bg-slate-50"}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-ocean-100 text-ocean-700"><MapPin className="h-4 w-4" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{displayText(location.name, displayText(location.nameZh, displayText(location.locode)))}</span><span className="block truncate text-xs text-slate-500">{displayText(location.type, text.portType)} / {displayText(location.country)} / {displayText(location.locode)}</span></span>
            </button>
          )) : <div className="px-3 py-4 text-sm text-slate-500">{text.empty}</div>}
        </div>
      ) : null}
    </label>
  );
}
