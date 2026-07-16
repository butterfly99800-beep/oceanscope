"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

const text = {
  title: "欢迎回来",
  description: "登录后查看您的订单并继续管理运输方案",
  email: "邮箱",
  password: "密码",
  emailPlaceholder: "请输入邮箱地址",
  passwordPlaceholder: "请输入密码",
  submit: "登录",
  loading: "正在登录……",
  invalid: "邮箱或密码错误",
  disabled: "账号已被禁用",
  failed: "登录失败，请稍后重试",
  registered: "注册成功，请登录",
  noAccount: "还没有账号？",
  registerNow: "立即注册",
  demo: "演示环境，请使用管理员或普通用户测试账号登录。",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
};

function messageFor(error: string | null | undefined) {
  if (error === "USER_DISABLED") return text.disabled;
  if (error === "CredentialsSignin") return text.invalid;
  if (error) return text.failed;
  return "";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const registered = searchParams.get("registered") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false, callbackUrl });
    setLoading(false);
    const nextError = messageFor(result?.error);
    if (nextError) {
      setError(nextError);
      return;
    }
    router.push(result?.url || callbackUrl);
    router.refresh();
  }

  return (
    <PageContainer className="flex min-h-[calc(100vh-4rem)] items-center justify-center py-10 sm:py-14">
      <div className="w-full max-w-[500px]">
        <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-wide text-ocean-700">OceanScope</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-ink">{text.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{text.description}</p>
          </div>
          {registered ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{text.registered}</div> : null}
          {error ? <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          <label className="block text-sm font-semibold text-ink" htmlFor="login-email">{text.email}</label>
          <input id="login-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder={text.emailPlaceholder} className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" required />
          <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="login-password">{text.password}</label>
          <div className="mt-2 flex h-12 items-center rounded-md border border-slate-300 px-3 transition focus-within:border-ocean-500 focus-within:ring-4 focus-within:ring-ocean-100">
            <input id="login-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder={text.passwordPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-ink" aria-label={showPassword ? text.hidePassword : text.showPassword}>
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <button disabled={loading} className="mt-6 h-12 w-full rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 disabled:cursor-not-allowed disabled:opacity-60">{loading ? text.loading : text.submit}</button>
          <p className="mt-5 text-center text-sm text-slate-600">{text.noAccount} <Link className="font-semibold text-ocean-700 hover:text-ocean-800" href="/register">{text.registerNow}</Link></p>
        </form>
        <p className="mt-4 rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-center text-xs text-slate-500 shadow-sm">{text.demo}</p>
      </div>
    </PageContainer>
  );
}
