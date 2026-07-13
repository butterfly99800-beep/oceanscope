import type { AdditionalServicesState, FreeDaysOption, InsuranceOption } from "@/features/rates/types";

export function AdditionalServices({ value, onChange }: { value: AdditionalServicesState; onChange: (value: AdditionalServicesState) => void }) {
  const toggle = (key: keyof Pick<AdditionalServicesState, "exportCustoms" | "importCustoms" | "pickup" | "delivery">) => onChange({ ...value, [key]: !value[key] });
  const services = [
    ["exportCustoms", "出口报关", "代理出口申报与文件处理", "$120.00"],
    ["importCustoms", "进口清关", "目的国进口清关协助", "$135.00"],
    ["pickup", "拖车提货", "起运地拖车提货服务", "$380.00"],
    ["delivery", "目的港配送", "目的地拖车配送服务", "$420.00"],
  ] as const;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">{services.map(([key, title, desc, price]) => <label key={key} className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-4"><span><span className="block text-sm font-semibold text-ink">{title}</span><span className="mt-1 block text-xs text-slate-500">{desc}</span><span className="mt-2 block text-xs font-semibold text-ocean-700">{price}</span></span><input type="checkbox" checked={value[key]} onChange={() => toggle(key)} className="h-4 w-4 rounded border-slate-300 text-ocean-600 focus:ring-ocean-500" /></label>)}</div>
      <label className="block rounded-lg border border-slate-200 p-4"><span className="text-sm font-semibold text-ink">货运保险</span><select value={value.insurance} onChange={(event) => onChange({ ...value, insurance: event.target.value as InsuranceOption })} className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="none">不购买保险</option><option value="basic">基础保险 · $260.00</option><option value="premium">综合保险 · $520.00</option></select></label>
      <label className="block rounded-lg border border-slate-200 p-4"><span className="text-sm font-semibold text-ink">额外免费用箱天数</span><select value={value.freeDays} onChange={(event) => onChange({ ...value, freeDays: event.target.value as FreeDaysOption })} className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100"><option value="standard">标准免费天数</option><option value="plus5">增加 5 天</option><option value="plus10">增加 10 天</option><option value="plus15">增加 15 天</option></select></label>
    </div>
  );
}
