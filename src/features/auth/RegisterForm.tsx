"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("??????????"); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const payload = await response.json() as { error?: { message: string } };
      if (!response.ok) { setError(payload.error?.message ?? "????"); return; }
      router.push("/login?registered=1");
    } catch {
      setError("??????????????");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-ocean-700">OceanScope</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">??</h1>
        <p className="mt-2 text-sm text-slate-600">????????????????????????</p>
        {error ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        <label className="mt-6 block text-sm font-semibold text-ink">??</label>
        <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100" />
        <label className="mt-4 block text-sm font-semibold text-ink">??</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100" required />
        <label className="mt-4 block text-sm font-semibold text-ink">??</label>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100" required />
        <p className="mt-1 text-xs text-slate-500">?? 8 ???????????</p>
        <label className="mt-4 block text-sm font-semibold text-ink">????</label>
        <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100" required />
        <button disabled={loading} className="mt-6 h-11 w-full rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "???..." : "??"}</button>
        <p className="mt-5 text-center text-sm text-slate-600">????? <Link className="font-semibold text-ocean-700 hover:text-ocean-800" href="/login">????</Link></p>
      </form>
    </PageContainer>
  );
}
