import { RouteResultCard } from "@/features/atlas/components/RouteResultCard";
import type { Port, RouteOption } from "@/features/atlas/types";

export function RouteResultList({ options, ports, selectedRouteOptionId, onSelect }: { options: RouteOption[]; ports: Port[]; selectedRouteOptionId: string | null; onSelect: (option: RouteOption) => void }) {
  const minDays = Math.min(...options.map((option) => option.transitDays));
  const maxDays = Math.max(...options.map((option) => option.transitDays));
  const first = options[0];
  const origin = ports.find((port) => port.id === first?.originPortId);
  const destination = ports.find((port) => port.id === first?.destinationPortId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 px-3 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">查询路线</p>
        <h2 className="mt-1 truncate text-sm font-semibold text-ink">{origin?.name ?? "Origin"} → {destination?.name ?? "Destination"}</h2>
        <p className="mt-1 text-xs text-slate-500">共 {options.length} 个方案 · {minDays}-{maxDays} 天</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {options.map((option) => <RouteResultCard key={option.id} option={option} ports={ports} isSelected={selectedRouteOptionId === option.id} onSelect={onSelect} />)}
      </div>
    </div>
  );
}
