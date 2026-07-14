"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, RotateCcw } from "lucide-react";
import { AdminEmptyState, AdminStatusBadge } from "@/features/admin/components/AdminPrimitives";
import { formatMoney } from "@/features/rates/lib/calculateQuote";

type AdminOrder = { id: string; bookingNumber: string; createdAt: string; origin: string; destination: string; carrier: string; containers: string; quantity: number; total: number; currency: string; status: string };
type ListResponse = { data: AdminOrder[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } | { error: { message: string } };
const statuses = ["All", "PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "COMPLETED"];

function nextStatuses(status: string) {
  if (status === "PENDING_CONFIRMATION") return ["CONFIRMED", "CANCELLED"];
  if (status === "CONFIRMED") return ["COMPLETED", "CANCELLED"];
  return [];
}

export function AdminOrdersPage() {
  const [records, setRecords] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusTarget, setStatusTarget] = useState<{ id: string; status: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "8", sortOrder: "desc" });
    if (query) params.set("search", query);
    if (status !== "All") params.set("status", status);
    try {
      const response = await fetch(`/api/admin/orders?${params.toString()}`);
      const payload = await response.json() as ListResponse;
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Failed to load orders");
        setRecords([]);
      } else {
        setRecords(payload.data);
        setTotalPages(payload.pagination.totalPages);
      }
    } catch {
      setError("Admin order API is unavailable.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, query, status]);

  useEffect(() => { void loadData(); }, [loadData]);

  const updateStatus = async () => {
    if (!statusTarget) return;
    setNotice("");
    const response = await fetch(`/api/admin/orders/${statusTarget.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: statusTarget.status }) });
    const payload = await response.json() as { error?: { message: string } };
    if (!response.ok) {
      setNotice(payload.error?.message ?? "Status update failed");
    } else {
      setNotice("Status updated.");
      await loadData();
    }
    setStatusTarget(null);
  };

  return <div className="space-y-5"><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-semibold text-ink">Order Management</h2><p className="mt-1 text-sm text-slate-500">Manage database-backed simulated bookings.</p></div></div><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_220px_auto]"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search booking number, route or carrier" className="admin-input" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="admin-input">{statuses.map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => { setQuery(""); setStatus("All"); setPage(1); }} className="admin-secondary"><RotateCcw className="h-4 w-4" />Reset</button></div>{notice ? <div className="mt-4 rounded-md bg-ocean-50 px-3 py-2 text-sm text-ocean-700">{notice}</div> : null}</section><section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">{loading ? <div className="p-8 text-sm text-slate-500">Loading orders...</div> : error ? <div className="p-8"><p className="text-sm text-rose-700">{error}</p><button onClick={() => void loadData()} className="admin-primary mt-4">Retry</button></div> : records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Booking</th><th>Created</th><th>Route</th><th>Carrier</th><th>Containers</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-100 hover:bg-ocean-50/40"><td className="px-4 py-3 font-semibold text-ink">{record.bookingNumber}</td><td>{record.createdAt}</td><td>{record.origin} / {record.destination}</td><td>{record.carrier || "Not provided"}</td><td>{record.containers}</td><td>{formatMoney(Math.round(record.total * 100), record.currency)}</td><td><AdminStatusBadge status={record.status} /></td><td><div className="flex items-center gap-2"><a href={`/orders/${record.id}`} className="admin-icon"><Eye className="h-4 w-4" /></a>{nextStatuses(record.status).length ? <select className="admin-input h-9 w-36" defaultValue="" onChange={(event) => event.target.value && setStatusTarget({ id: record.id, status: event.target.value })}><option value="">Change</option>{nextStatuses(record.status).map((item) => <option key={item} value={item}>{item}</option>)}</select> : null}</div></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No orders" description="Orders created from /rates will appear here." />}</section><div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="admin-page">Previous</button><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="admin-page">Next</button></div></div>{statusTarget ? <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-ink/45 p-4"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-ink">Confirm status change</h3><p className="mt-2 text-sm text-slate-600">Change order status to {statusTarget.status}?</p><div className="mt-5 flex justify-end gap-2"><button onClick={() => setStatusTarget(null)} className="admin-secondary">Cancel</button><button onClick={() => void updateStatus()} className="admin-primary">Confirm</button></div></div></div> : null}</div>;
}
