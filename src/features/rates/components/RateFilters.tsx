import type { RateFiltersState } from "@/features/rates/types";

export function RateFilters({ carriers, filters, resultCount, onChange, onClear }: { carriers: string[]; filters: RateFiltersState; resultCount: number; onChange: (filters: RateFiltersState) => void; onClear: () => void }) {
  const toggleCarrier = (carrier: string) => {
    const carriersNext = filters.carriers.includes(carrier) ? filters.carriers.filter((item) => item !== carrier) : [...filters.carriers, carrier];
    onChange({ ...filters, carriers: carriersNext });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-ink">筛选</h2><p className="mt-1 text-xs text-slate-500">当前 {resultCount} 个结果</p></div><button type="button" onClick={onClear} className="text-xs font-semibold text-ocean-700 hover:text-ocean-900">清除筛选</button></div>
      <div className="space-y-4">
        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">中转次数</span><select value={filters.stops} onChange={(event) => onChange({ ...filters, stops: event.target.value as RateFiltersState["stops"] })} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="all">全部</option><option value="direct">直达</option><option value="one">一次中转</option><option value="two">两次中转</option></select></label>
        <div><span className="mb-2 block text-xs font-semibold text-slate-600">承运商</span><div className="space-y-2">{carriers.map((carrier) => <label key={carrier} className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={filters.carriers.includes(carrier)} onChange={() => toggleCarrier(carrier)} className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" />{carrier}</label>)}</div></div>
        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">最高价格 ${filters.maxPrice}</span><input type="range" min="2400" max="9000" step="100" value={filters.maxPrice} onChange={(event) => onChange({ ...filters, maxPrice: Number(event.target.value) })} className="w-full" /></label>
        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">最长运输 {filters.maxTransitDays} 天</span><input type="range" min="10" max="35" value={filters.maxTransitDays} onChange={(event) => onChange({ ...filters, maxTransitDays: Number(event.target.value) })} className="w-full" /></label>
        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">最低免费天数</span><input type="number" min="0" max="20" value={filters.minFreeDays} onChange={(event) => onChange({ ...filters, minFreeDays: Number(event.target.value) })} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" /></label>
        <label className="block"><span className="mb-2 block text-xs font-semibold text-slate-600">最低可靠性 {filters.minReliability}%</span><input type="range" min="70" max="99" value={filters.minReliability} onChange={(event) => onChange({ ...filters, minReliability: Number(event.target.value) })} className="w-full" /></label>
      </div>
    </section>
  );
}
