import type { AdminStatus } from "@/features/admin/types";

const styles: Record<string, string> = {
  Active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Inactive: "bg-slate-100 text-slate-600 ring-slate-200",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
  Expired: "bg-slate-100 text-slate-600 ring-slate-200",
  EXPIRED: "bg-slate-100 text-slate-600 ring-slate-200",
  NORMAL: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  EXPECTED_DELAY: "bg-amber-50 text-amber-700 ring-amber-200",
  DELAYED: "bg-rose-50 text-rose-700 ring-rose-200",
  CUTOFF_SOON: "bg-violet-50 text-violet-700 ring-violet-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
};

function styleFor(status: AdminStatus) {
  if (status.includes("停用")) return styles.INACTIVE;
  if (status.includes("过期")) return styles.EXPIRED;
  if (status.includes("取消")) return styles.CANCELLED;
  if (status.includes("延误")) return styles.DELAYED;
  if (status.includes("截关")) return styles.CUTOFF_SOON;
  if (status.includes("正常") || status.includes("启用")) return styles.ACTIVE;
  return styles[String(status)] ?? "bg-slate-100 text-slate-600 ring-slate-200";
}

export function AdminStatusBadge({ status }: { status: AdminStatus }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${styleFor(status)}`}>{status}</span>;
}

export function AdminStatCard({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold text-ink">{value}</div></div>;
}

export function AdminEmptyState({ title = "No data", description }: { title?: string; description?: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500"><div>{title}</div>{description ? <p className="mt-2 text-sm">{description}</p> : null}</div>;
}
