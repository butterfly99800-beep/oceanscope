import type { PortOption, RecentScheduleSearch } from "@/features/schedules/types";

function portName(ports: PortOption[], id: string, savedName?: string) {
  if (savedName && !/[\u3400-\u9fff]/.test(savedName)) return savedName;
  const key = (id || "").toLowerCase();
  const port = ports.find((item) => item.id.toLowerCase() === key || item.code.toLowerCase() === key);
  return port ? port.name : /^[A-Z]{5}$|^cosco:|^c[a-z0-9]{20,}$/i.test(id) || /[\u3400-\u9fff]/.test(id) ? "Location name unavailable" : id;
}

export function RecentScheduleSearches({ searches, ports, onSelect, disabled }: { disabled?: boolean; searches: RecentScheduleSearch[]; ports: PortOption[]; onSelect: (search: RecentScheduleSearch) => void }) {
  if (!searches.length) return null;
  return <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-card">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">最近查询</h2><span className="text-xs font-semibold text-slate-400">保存在本机</span></div>
    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{searches.map((search) => <button key={search.id} type="button" disabled={disabled} onClick={() => onSelect(search)} className="rounded-lg border border-slate-200 bg-white p-3 text-left transition hover:border-ocean-300 hover:shadow-card">
      <div className="text-sm font-semibold text-ink">{portName(ports, search.originPortId, search.originName)} → {portName(ports, search.destinationPortId, search.destinationName)}</div>
    </button>)}</div>
  </section>;
}
