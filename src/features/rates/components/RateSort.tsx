import type { SortOption } from "@/features/rates/types";

const sorts: Array<{ value: SortOption; label: string }> = [
  { value: "recommended", label: "推荐排序" },
  { value: "price", label: "价格最低" },
  { value: "fastest", label: "运输最快" },
  { value: "earliestDeparture", label: "最早出发" },
  { value: "earliestArrival", label: "最早到达" },
];

export function RateSort({ value, onChange }: { value: SortOption; onChange: (value: SortOption) => void }) {
  return <select value={value} onChange={(event) => onChange(event.target.value as SortOption)} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100">{sorts.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}</select>;
}
