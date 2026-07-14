import { CalendarClock, CheckCircle2, Ship, Timer } from "lucide-react";
import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { RateOption } from "@/features/rates/types";

export function RateResultCard({ option, isSelected, onSelect }: { option: RateOption; isSelected: boolean; onSelect: (option: RateOption) => void }) {
  return (
    <article className={`rounded-lg border bg-white p-4 transition ${option.expired ? "opacity-70" : "hover:shadow-card"} ${isSelected ? "border-ocean-500 bg-ocean-50/40" : "border-slate-200"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-ink">{option.carrier}</h3><span className="text-sm font-medium text-slate-500">{option.serviceName}</span>{option.tags.map((tag) => <span key={tag} className="rounded-full bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">{tag}</span>)}{option.expired ? <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100">报价已过期</span> : null}</div><p className="mt-1 text-xs text-slate-500">有效期至 {option.validUntil} · {option.direct ? "直达" : `${option.stops} 次中转`}</p></div>
        <div className="text-right"><div className="text-2xl font-semibold text-ink">{formatMoney(option.totalPrice)}</div><p className="text-xs text-slate-500">模拟总价起</p></div>
      </div>
      <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div><div className="text-xs text-slate-500">{option.originPortCode}</div><div className="text-sm font-semibold text-ink">ETD {option.etd}</div></div>
        <div className="flex items-center gap-2 text-xs font-semibold text-ocean-700"><span className="h-2 w-2 rounded-full bg-ocean-500" /><span className="h-px w-20 bg-ocean-200" /><Ship className="h-4 w-4" /><span className="h-px w-20 bg-ocean-200" /><span className="h-2 w-2 rounded-full bg-violet-500" /></div>
        <div className="text-right"><div className="text-xs text-slate-500">{option.destinationPortCode}</div><div className="text-sm font-semibold text-ink">ETA {option.eta}</div></div>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-slate-600 sm:grid-cols-5"><div className="flex items-center gap-1"><Timer className="h-3.5 w-3.5" />{option.transitDays} 天</div><div>{option.stops} 次中转</div><div>{option.vesselName} / {option.voyageNumber}</div><div className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />截关 {option.cutOffDate}</div><div className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />可靠性 {option.reliability}%</div></div>
      <div className="mt-4 flex items-center justify-between"><span className="text-xs font-medium text-slate-500">免费用箱 {option.freeDays} 天</span><button type="button" onClick={() => onSelect(option)} disabled={option.expired} className={`h-9 rounded-md px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 ${isSelected ? "bg-ink text-white" : "bg-gradient-to-r from-ocean-500 to-violet-500 text-white hover:brightness-110"}`}>{option.expired ? "报价已过期" : isSelected ? "已选择" : "选择方案"}</button></div>
    </article>
  );
}
