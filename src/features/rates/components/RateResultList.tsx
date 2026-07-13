import { EmptyState } from "@/components/ui/EmptyState";
import { RateResultCard } from "@/features/rates/components/RateResultCard";
import { RateSort } from "@/features/rates/components/RateSort";
import { Ship } from "lucide-react";
import type { RateOption, RateSearchCriteria, SortOption } from "@/features/rates/types";

function containerSummary(criteria: RateSearchCriteria) {
  return Object.entries(criteria.containers).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · ");
}

export function RateResultList({ options, selectedId, criteria, isLoading, sort, onSortChange, onSelect }: { options: RateOption[]; selectedId: string | null; criteria: RateSearchCriteria; isLoading: boolean; sort: SortOption; onSortChange: (sort: SortOption) => void; onSelect: (option: RateOption) => void }) {
  if (isLoading) {
    return <div className="space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-52 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm" />)}</div>;
  }

  return (
    <section className="min-w-0 flex-1">
      <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-base font-semibold text-ink">{criteria.originId} → {criteria.destinationId}</h2><p className="mt-1 text-sm text-slate-500">货好日期 {criteria.cargoReadyDate} · {containerSummary(criteria)} · {options.length} 个方案 · 模拟数据</p></div><RateSort value={sort} onChange={onSortChange} /></div>
      </div>
      {options.length === 0 ? <EmptyState icon={Ship} title="没有匹配的运输方案" description="请调整筛选条件或重新查询其他路线。" /> : <div className="space-y-4">{options.map((option) => <RateResultCard key={option.id} option={option} isSelected={selectedId === option.id} onSelect={onSelect} />)}</div>}
    </section>
  );
}
