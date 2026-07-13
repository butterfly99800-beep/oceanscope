import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { ContainerSelection, QuoteCalculation, RateOption } from "@/features/rates/types";

function containerSummary(containers: ContainerSelection) {
  return Object.entries(containers).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · ");
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-slate-800">{value}</span></div>;
}

export function RateSummaryPanel({ option, containers, calculation, onOpenQuote }: { option: RateOption | null; containers: ContainerSelection; calculation: QuoteCalculation | null; onOpenQuote: () => void }) {
  if (!option || !calculation) {
    return <aside className="hidden w-[360px] shrink-0 rounded-lg border border-slate-200 bg-white p-5 shadow-card xl:block"><div className="text-sm font-semibold text-ink">选择一个方案</div><p className="mt-2 text-sm text-slate-500">选择报价后将在这里显示摘要和费用。</p></aside>;
  }

  return (
    <aside className="hidden w-[360px] shrink-0 flex-col rounded-lg border border-slate-200 bg-white shadow-card xl:flex">
      <div className="border-b border-slate-200 p-5"><h2 className="text-base font-semibold text-ink">当前方案摘要</h2><p className="mt-1 text-sm text-slate-500">{option.carrier} · {option.serviceName}</p></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5"><Row label="起运港" value={option.originPortCode} /><Row label="目的港" value={option.destinationPortCode} /><Row label="ETD" value={option.etd} /><Row label="ETA" value={option.eta} /><Row label="运输时长" value={`${option.transitDays} 天`} /><Row label="中转次数" value={`${option.stops} 次`} /><Row label="箱型数量" value={containerSummary(containers)} /><Row label="基础运费" value={formatMoney(calculation.baseFreight)} /><Row label="附加费" value={formatMoney(calculation.subtotal - calculation.baseFreight)} /></div>
      <div className="border-t border-slate-200 p-5"><div className="mb-4 flex items-end justify-between"><span className="text-sm text-slate-500">当前总价</span><span className="text-2xl font-semibold text-ink">{formatMoney(calculation.total)}</span></div><button type="button" onClick={onOpenQuote} className="h-11 w-full rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">查看完整报价</button></div>
    </aside>
  );
}
