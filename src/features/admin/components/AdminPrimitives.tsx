import type { AdminStatus } from "@/features/admin/types";

const styles: Record<AdminStatus, string> = {
  启用: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  停用: "bg-slate-100 text-slate-600 ring-slate-200",
  维护中: "bg-amber-50 text-amber-700 ring-amber-200",
  待确认: "bg-amber-50 text-amber-700 ring-amber-200",
  已确认: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  已取消: "bg-rose-50 text-rose-700 ring-rose-200",
  正常: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  预计延误: "bg-amber-50 text-amber-700 ring-amber-200",
  已延误: "bg-rose-50 text-rose-700 ring-rose-200",
  即将截关: "bg-violet-50 text-violet-700 ring-violet-200",
};

export function AdminStatusBadge({ status }: { status: AdminStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styles[status]}`}>{status}</span>;
}

export function AdminStatCard({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold text-ink">{value}</div></div>;
}

export function AdminEmptyState({ title = "暂无数据", description }: { title?: string; description?: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"><div>{title}</div>{description ? <p className="mt-2 text-sm">{description}</p> : null}</div>;
}

