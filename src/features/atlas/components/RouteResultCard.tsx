import type { Port, RouteOption } from "@/features/atlas/types";

function portLabel(ports: Port[], id: string) {
  const port = ports.find((item) => item.id === id);
  return port?.locode ?? id.toUpperCase();
}

export function RouteResultCard({ option, ports, isSelected, onSelect }: { option: RouteOption; ports: Port[]; isSelected: boolean; onSelect: (option: RouteOption) => void }) {
  const transit = option.transitPortIds.map((id) => ports.find((port) => port.id === id)?.name).filter(Boolean).join(" / ");

  return (
    <button type="button" onClick={() => onSelect(option)} className={`w-full rounded-lg border p-3 text-left transition active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 ${isSelected ? "border-ocean-500 bg-ocean-50 shadow-sm" : "border-slate-200 bg-white hover:border-ocean-300 hover:bg-slate-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div><span className="text-xs text-slate-500">Est. transit time</span><div className="text-lg font-semibold text-ink">{option.transitDays} 天</div></div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">{option.direct ? "直达" : `${option.transferCount} 次中转`}</span>
      </div>
      <div className="mt-2 text-sm font-bold text-ink">{portLabel(ports, option.originPortId)} → {portLabel(ports, option.destinationPortId)}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
        <div><span className="text-slate-400">Service</span> <b>{option.service}</b></div>
        <div><span className="text-slate-400">Carrier</span> <b>{option.carrier}</b></div>
        <div><span className="text-slate-400">ETD</span> <b>{option.etd}</b></div>
        <div><span className="text-slate-400">ETA</span> <b>{option.eta}</b></div>
      </div>
      {transit ? <div className="mt-2 truncate text-xs text-slate-500">中转：{transit}</div> : null}
    </button>
  );
}
