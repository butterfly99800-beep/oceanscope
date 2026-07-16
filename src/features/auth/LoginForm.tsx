"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    if (result?.error) {
      setError("???????");
      return;
    }
    router.push(result?.url || callbackUrl);
    router.refresh();
  }

  return (
    <PageContainer className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-12">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-ocean-700">OceanScope</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">??</h1>
        <p className="mt-2 text-sm text-slate-600">????????????????</p>
        {registered ? <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">?????????</div> : null}
        {error ? <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
        <label className="mt-6 block text-sm font-semibold text-ink">??</label>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100" required />
        <label className="mt-4 block text-sm font-semibold text-ink">??</label>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-ocean-500 focus:ring-2 focus:ring-ocean-100" required />
        <button disabled={loading} className="mt-6 h-11 w-full rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "???..." : "??"}</button>
        <p className="mt-5 text-center text-sm text-slate-600">?????? <Link className="font-semibold text-ocean-700 hover:text-ocean-800" href="/register">????</Link></p>
      </form>
    </PageContainer>
  );
}
