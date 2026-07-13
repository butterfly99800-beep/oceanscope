import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { QuoteCalculation } from "@/features/rates/types";

const categories = ["基础费用", "起运地费用", "目的地费用", "其他费用"] as const;

export function CostBreakdown({ calculation }: { calculation: QuoteCalculation }) {
  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const items = calculation.lineItems.filter((item) => item.category === category);
        if (items.length === 0) return null;
        return <section key={category} className="rounded-lg border border-slate-200 p-4"><h3 className="mb-3 text-sm font-semibold text-ink">{category}</h3><div className="space-y-2">{items.map((item) => <div key={`${category}-${item.name}`} className="grid grid-cols-[1fr_90px_60px_100px] gap-2 text-sm"><span className="text-slate-600">{item.name}</span><span className="text-right text-slate-500">{formatMoney(item.unitPrice)}</span><span className="text-right text-slate-500">x {item.quantity}</span><span className="text-right font-semibold text-ink">{formatMoney(item.subtotal)}</span></div>)}</div></section>;
      })}
      <section className="rounded-lg bg-slate-50 p-4"><div className="flex justify-between text-sm"><span>小计</span><b>{formatMoney(calculation.subtotal)}</b></div><div className="mt-2 flex justify-between text-sm"><span>税费</span><b>{formatMoney(calculation.tax)}</b></div><div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-lg"><span className="font-semibold text-ink">总计</span><b className="text-ink">{formatMoney(calculation.total)}</b></div></section>
    </div>
  );
}
