"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RotateCcw, ShieldCheck, UserCog } from "lucide-react";
import { AdminEmptyState, AdminStatCard, AdminStatusBadge } from "@/features/admin/components/AdminPrimitives";

type Role = "CUSTOMER" | "ADMIN";
type Status = "ACTIVE" | "DISABLED";
type AdminUser = { id: string; name: string; email: string; role: Role; status: Status; orderCount: number; createdAt: string; lastLoginAt: string | null };
type ListResponse = { data: AdminUser[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } } | { error: { message: string } };
type Action = { kind: "role"; user: AdminUser; role: Role } | { kind: "status"; user: AdminUser; status: Status } | { kind: "password"; user: AdminUser };

const roleOptions = ["All", "CUSTOMER", "ADMIN"] as const;
const statusOptions = ["All", "ACTIVE", "DISABLED"] as const;

function formatDate(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

export function AdminUsersPage() {
  const [records, setRecords] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<(typeof roleOptions)[number]>("All");
  const [status, setStatus] = useState<(typeof statusOptions)[number]>("All");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [action, setAction] = useState<Action | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const activeAdmins = useMemo(() => records.filter((item) => item.role === "ADMIN" && item.status === "ACTIVE").length, [records]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "10", sortOrder: "desc" });
    if (query) params.set("search", query);
    if (role !== "All") params.set("role", role);
    if (status !== "All") params.set("status", status);
    try {
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = await response.json() as ListResponse;
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Failed to load users");
        setRecords([]);
      } else {
        setRecords(payload.data);
        setTotal(payload.pagination.total);
        setTotalPages(payload.pagination.totalPages);
      }
    } catch {
      setError("User API is unavailable.");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, query, role, status]);

  useEffect(() => { void loadData(); }, [loadData]);

  async function runAction() {
    if (!action) return;
    setNotice("");
    let response: Response;
    if (action.kind === "role") response = await fetch(`/api/admin/users/${action.user.id}/role`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: action.role }) });
    else if (action.kind === "status") response = await fetch(`/api/admin/users/${action.user.id}/status`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: action.status }) });
    else response = await fetch(`/api/admin/users/${action.user.id}/password`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: tempPassword }) });
    const payload = await response.json() as { error?: { message: string } };
    if (!response.ok) {
      setNotice(payload.error?.message ?? "Operation failed");
      return;
    }
    setNotice(action.kind === "password" ? "Password reset. Share the temporary password securely with the user." : "User updated.");
    setAction(null);
    setTempPassword("");
    await loadData();
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard label="Users" value={total} />
        <AdminStatCard label="Active admins on page" value={activeAdmins} />
        <AdminStatCard label="Current page" value={`${page} / ${totalPages}`} />
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-semibold text-ink">User Management</h2><p className="mt-1 text-sm text-slate-500">Manage login users, roles, status and temporary password reset.</p></div><UserCog className="h-8 w-8 text-ocean-600" /></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
          <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name or email" className="admin-input" />
          <select value={role} onChange={(event) => { setRole(event.target.value as (typeof roleOptions)[number]); setPage(1); }} className="admin-input">{roleOptions.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={status} onChange={(event) => { setStatus(event.target.value as (typeof statusOptions)[number]); setPage(1); }} className="admin-input">{statusOptions.map((item) => <option key={item}>{item}</option>)}</select>
          <button onClick={() => { setQuery(""); setRole("All"); setStatus("All"); setPage(1); }} className="admin-secondary"><RotateCcw className="h-4 w-4" />Reset</button>
        </div>
        {notice ? <div className="mt-4 rounded-md bg-ocean-50 px-3 py-2 text-sm text-ocean-700">{notice}</div> : null}
      </section>
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
        {loading ? <div className="p-8 text-sm text-slate-500">Loading users...</div> : error ? <div className="p-8"><p className="text-sm text-rose-700">{error}</p><button onClick={() => void loadData()} className="admin-primary mt-4">Retry</button></div> : records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">User</th><th>Role</th><th>Status</th><th>Orders</th><th>Registered</th><th>Last login</th><th>Actions</th></tr></thead><tbody>{records.map((user) => <tr key={user.id} className="border-t border-slate-100 hover:bg-ocean-50/40"><td className="px-4 py-3"><div className="font-semibold text-ink">{user.name || user.email}</div><div className="text-xs text-slate-500">{user.email}</div></td><td><AdminStatusBadge status={user.role} /></td><td><AdminStatusBadge status={user.status} /></td><td>{user.orderCount}</td><td>{formatDate(user.createdAt)}</td><td>{formatDate(user.lastLoginAt)}</td><td><div className="flex flex-wrap gap-2"><button className="admin-secondary h-9" onClick={() => setAction({ kind: "role", user, role: user.role === "ADMIN" ? "CUSTOMER" : "ADMIN" })}>{user.role === "ADMIN" ? "Set customer" : "Set admin"}</button><button className="admin-secondary h-9" onClick={() => setAction({ kind: "status", user, status: user.status === "ACTIVE" ? "DISABLED" : "ACTIVE" })}>{user.status === "ACTIVE" ? "Disable" : "Enable"}</button><button className="admin-primary h-9" onClick={() => setAction({ kind: "password", user })}>Reset password</button></div></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No users" description="Registered users will appear here." />}
      </section>
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><span>Page {page} of {totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="admin-page">Previous</button><button disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="admin-page">Next</button></div></div>
      {action ? <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-ink/45 p-4"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-ocean-600" /><h3 className="text-lg font-semibold text-ink">Confirm action</h3></div><p className="mt-2 text-sm text-slate-600">{action.kind === "role" ? `Change ${action.user.email} role to ${action.role}?` : action.kind === "status" ? `Change ${action.user.email} status to ${action.status}?` : `Set a temporary password for ${action.user.email}.`}</p>{action.kind === "password" ? <input value={tempPassword} onChange={(event) => setTempPassword(event.target.value)} type="password" placeholder="Temporary password" className="admin-input mt-4" /> : null}<div className="mt-5 flex justify-end gap-2"><button onClick={() => { setAction(null); setTempPassword(""); }} className="admin-secondary">Cancel</button><button onClick={() => void runAction()} className="admin-primary">Confirm</button></div></div></div> : null}
    </div>
  );
}