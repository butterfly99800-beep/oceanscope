"use client";

import { ArrowUpDown, MapPin, X } from "lucide-react";
import type { Port, RouteSearchState } from "@/features/atlas/types";

function PortInput({
  label,
  value,
  ports,
  onValueChange,
  onPortSelect,
}: {
  label: string;
  value: string;
  ports: Port[];
  onValueChange: (value: string) => void;
  onPortSelect: (port: Port) => void;
}) {
  const matches = value.trim().length > 0
    ? ports.filter((port) => [port.name, port.nameZh ?? "", port.locode, ...port.aliases].some((item) => item.toLowerCase().includes(value.toLowerCase()))).slice(0, 4)
    : [];

  return (
    <div className="relative">
      <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <div className="mt-1 flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-2 focus-within:border-ocean-500 focus-within:ring-4 focus-within:ring-ocean-100">
        <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <input value={value} onChange={(event) => onValueChange(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none" />
        <button type="button" onClick={() => onValueChange("")} className="text-slate-400 hover:text-ink" aria-label={`清空${label}`}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      {matches.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-card">
          {matches.map((port) => (
            <button key={port.id} type="button" onClick={() => onPortSelect(port)} className="block w-full px-3 py-2 text-left text-xs hover:bg-ocean-50">
              <span className="font-semibold text-ink">{port.name}</span>
              <span className="ml-2 text-slate-500">{port.locode}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RouteSearchForm({
  ports,
  routeSearch,
  originLabel,
  destinationLabel,
  onRouteSearchChange,
  onSubmit,
}: {
  ports: Port[];
  routeSearch: RouteSearchState;
  originLabel: string;
  destinationLabel: string;
  onRouteSearchChange: (state: RouteSearchState) => void;
  onSubmit: () => void;
}) {
  const setPort = (key: "originPortId" | "destinationPortId", port: Port) => {
    onRouteSearchChange({ ...routeSearch, [key]: port.id });
  };

  return (
    <section className="border-b border-slate-200 p-3">
      <div className="relative space-y-2">
        <PortInput label="起运港" value={originLabel} ports={ports} onValueChange={(value) => onRouteSearchChange({ ...routeSearch, originPortId: value })} onPortSelect={(port) => setPort("originPortId", port)} />
        <button
          type="button"
          onClick={() => onRouteSearchChange({ ...routeSearch, originPortId: routeSearch.destinationPortId, destinationPortId: routeSearch.originPortId })}
          className="absolute right-2 top-[42px] z-10 flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
          aria-label="交换起运港和目的港"
        >
          <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
        </button>
        <PortInput label="目的港" value={destinationLabel} ports={ports} onValueChange={(value) => onRouteSearchChange({ ...routeSearch, destinationPortId: value })} onPortSelect={(port) => setPort("destinationPortId", port)} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <label className="flex items-center justify-between rounded-md border border-slate-200 px-2 py-2 text-slate-600">
          直达优先
          <input type="checkbox" checked={routeSearch.directOnly} onChange={(event) => onRouteSearchChange({ ...routeSearch, directOnly: event.target.checked })} className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" />
        </label>
        <label className="rounded-md border border-slate-200 px-2 py-1 text-slate-600">
          <span className="block text-[10px]">最大中转</span>
          <select value={routeSearch.maxTransfers} onChange={(event) => onRouteSearchChange({ ...routeSearch, maxTransfers: Number(event.target.value) })} className="w-full bg-transparent font-semibold outline-none">
            <option value={0}>0 次</option>
            <option value={1}>1 次</option>
            <option value={2}>2 次</option>
          </select>
        </label>
        <input type="date" value={routeSearch.departureDate} onChange={(event) => onRouteSearchChange({ ...routeSearch, departureDate: event.target.value })} className="col-span-2 h-9 rounded-md border border-slate-300 px-2 text-xs outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" />
      </div>

      <button type="button" onClick={onSubmit} className="mt-3 h-9 w-full rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
        查询航线
      </button>
    </section>
  );
}
