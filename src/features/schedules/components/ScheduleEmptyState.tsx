import type { ReactNode } from "react";

export function ScheduleEmptyState({ title = "未找到符合条件的船期", description = "可以尝试扩大日期范围、允许中转、清除筛选或更换港口。", action }: { title?: string; description?: string; action?: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"><h3 className="text-lg font-semibold text-ink">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}
