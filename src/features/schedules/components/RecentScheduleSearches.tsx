import { Clock } from "lucide-react";
import type { PortOption, RecentScheduleSearch } from "@/features/schedules/types";

function portName(ports: PortOption[], id: string) {
  const port = ports.find((item) => item.id === id);
  return port ? `${port.name} ${port.code}` : id;
}

export function RecentScheduleSearches({ searches, ports, onSelect }: { searches: RecentScheduleSearch[]; ports: PortOption[]; onSelect: (search: RecentScheduleSearch) => void }) {
  return <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">最近查询</h2><span className="text-xs font-semibold text-slate-400">本地模拟记录</span></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{searches.map((search) => <button key={search.id} type="button" onClick={() => onSelect(search)} className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-ocean-300 hover:shadow-card"><div className="text-sm font-semibold text-ink">{portName(ports, search.originPortId)} → {portName(ports, search.destinationPortId)}</div><div className="mt-2 flex items-center gap-2 text-xs text-slate-500"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{search.departureDate} · {search.directOnly ? "直达" : "全部"}</div></button>)}</div></section>;
}
