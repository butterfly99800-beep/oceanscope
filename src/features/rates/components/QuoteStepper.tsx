const steps = ["运输方案", "附加服务", "费用明细", "确认预订"];

export function QuoteStepper({ step }: { step: number }) {
  return <div className="grid grid-cols-4 gap-2">{steps.map((label, index) => <div key={label} className={`rounded-md px-3 py-2 text-center text-xs font-semibold ${index <= step ? "bg-ocean-50 text-ocean-700" : "bg-slate-100 text-slate-500"}`}>{index + 1}. {label}</div>)}</div>;
}
