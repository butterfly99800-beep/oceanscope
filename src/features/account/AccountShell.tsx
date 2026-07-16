"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";
import { LockKeyhole, LogOut, PackageCheck, UserRound } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

type AccountUser = { id: string; name: string; email: string; role: string; status: string; createdAt: string; lastLoginAt: string | null; orderCount: number };
type ApiResponse = { data: AccountUser } | { error: { message: string } };

function formatDate(value: string | null) {
  return value ? value.slice(0, 16).replace("T", " ") : "-";
}

export function AccountShell() {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/account");
      const payload = await response.json() as ApiResponse;
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Failed to load account");
      } else {
        setUser(payload.data);
        setName(payload.data.name || "");
      }
    } catch {
      setError("Account API is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadAccount(); }, [loadAccount]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/account/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) setError(payload.error?.message ?? "Failed to update profile");
      else { setNotice("Profile updated."); await loadAccount(); }
    } catch {
      setError("Profile API is unavailable.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setNotice("");
    setError("");
    try {
      const response = await fetch("/api/account/password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword, confirmPassword }) });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) { setError(payload.error?.message ?? "Failed to update password"); return; }
      setNotice("Password updated. Please sign in again.");
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => void signOut({ callbackUrl: "/login" }), 900);
    } catch {
      setError("Password API is unavailable.");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader eyebrow="ACCOUNT" title="个人中心" description="管理账号资料、安全设置和订单入口。" />
      {loading ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-card">Loading account...</div> : null}
      {error ? <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}
      {user ? <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">
          <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-lg bg-ocean-100 text-ocean-700"><UserRound className="h-6 w-6" /></span><div><h2 className="text-xl font-semibold text-ink">{user.name || user.email}</h2><p className="text-sm text-slate-500">{user.email}</p></div></div>
          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><span className="text-slate-500">Role</span><div className="font-semibold text-ink">{user.role}</div></div><div><span className="text-slate-500">Status</span><div className="font-semibold text-ink">{user.status}</div></div><div><span className="text-slate-500">Registered</span><div className="font-semibold text-ink">{formatDate(user.createdAt)}</div></div><div><span className="text-slate-500">Last login</span><div className="font-semibold text-ink">{formatDate(user.lastLoginAt)}</div></div></div>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/orders" className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white"><PackageCheck className="h-4 w-4" />我的订单</Link><button type="button" onClick={() => void signOut({ callbackUrl: "/" })} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700"><LogOut className="h-4 w-4" />退出登录</button></div>
        </section>
        <div className="space-y-5">
          <form onSubmit={saveProfile} className="rounded-lg border border-slate-200 bg-white p-6 shadow-card"><h3 className="text-lg font-semibold text-ink">修改资料</h3><label className="mt-4 block text-sm font-semibold text-slate-700">姓名</label><input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" /><p className="mt-2 text-xs text-slate-500">邮箱暂不支持修改。</p><button disabled={savingProfile} className="mt-4 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{savingProfile ? "Saving..." : "保存资料"}</button></form>
          <form onSubmit={savePassword} className="rounded-lg border border-slate-200 bg-white p-6 shadow-card"><div className="flex items-center gap-2"><LockKeyhole className="h-5 w-5 text-ocean-600" /><h3 className="text-lg font-semibold text-ink">修改密码</h3></div><label className="mt-4 block text-sm font-semibold text-slate-700">当前密码</label><input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" /><label className="mt-4 block text-sm font-semibold text-slate-700">新密码</label><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" /><label className="mt-4 block text-sm font-semibold text-slate-700">确认新密码</label><input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" /><button disabled={savingPassword} className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700 disabled:opacity-60">{savingPassword ? "Saving..." : "修改密码"}</button></form>
        </div>
      </div> : null}
    </PageContainer>
  );
}