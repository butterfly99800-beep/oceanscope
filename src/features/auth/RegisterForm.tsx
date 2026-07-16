"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";

const text = {
  title: "创建账号",
  description: "注册 OceanScope 账号，查询运输方案并管理您的订单",
  name: "姓名",
  email: "邮箱",
  password: "密码",
  confirmPassword: "确认密码",
  namePlaceholder: "请输入姓名",
  emailPlaceholder: "请输入邮箱地址",
  passwordPlaceholder: "至少 8 位，且包含字母和数字",
  confirmPlaceholder: "请再次输入密码",
  submit: "注册账号",
  loading: "正在注册……",
  mismatch: "两次输入的密码不一致",
  exists: "该邮箱已经注册",
  failed: "注册失败，请稍后重试",
  success: "注册成功，正在前往登录页面",
  hasAccount: "已有账号？",
  loginNow: "立即登录",
  demo: "演示环境，请使用管理员或普通用户测试账号登录。",
  showPassword: "显示密码",
  hidePassword: "隐藏密码",
};

function errorMessage(message: string | undefined) {
  if (message === "Email is already registered" || message === "EMAIL_ALREADY_EXISTS") return text.exists;
  return message || text.failed;
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) { setError(text.mismatch); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
      const payload = await response.json() as { error?: { code?: string; message?: string } };
      if (!response.ok) { setError(errorMessage(payload.error?.code ?? payload.error?.message)); return; }
      setSuccess(text.success);
      router.push("/login?registered=1");
    } catch {
      setError(text.failed);
    } finally {
      setLoading(false);
    }
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
          {success ? <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}
          {error ? <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
          <label className="block text-sm font-semibold text-ink" htmlFor="register-name">{text.name}</label>
          <input id="register-name" value={name} onChange={(event) => setName(event.target.value)} placeholder={text.namePlaceholder} className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" />
          <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="register-email">{text.email}</label>
          <input id="register-email" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder={text.emailPlaceholder} className="mt-2 h-12 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" required />
          <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="register-password">{text.password}</label>
          <div className="mt-2 flex h-12 items-center rounded-md border border-slate-300 px-3 transition focus-within:border-ocean-500 focus-within:ring-4 focus-within:ring-ocean-100">
            <input id="register-password" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder={text.passwordPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" required />
            <button type="button" onClick={() => setShowPassword((value) => !value)} className="ml-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-ink" aria-label={showPassword ? text.hidePassword : text.showPassword}>
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <label className="mt-5 block text-sm font-semibold text-ink" htmlFor="register-confirm-password">{text.confirmPassword}</label>
          <div className="mt-2 flex h-12 items-center rounded-md border border-slate-300 px-3 transition focus-within:border-ocean-500 focus-within:ring-4 focus-within:ring-ocean-100">
            <input id="register-confirm-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" placeholder={text.confirmPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" required />
            <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="ml-2 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-ink" aria-label={showConfirmPassword ? text.hidePassword : text.showPassword}>
              {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
          <button disabled={loading} className="mt-6 h-12 w-full rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 disabled:cursor-not-allowed disabled:opacity-60">{loading ? text.loading : text.submit}</button>
          <p className="mt-5 text-center text-sm text-slate-600">{text.hasAccount} <Link className="font-semibold text-ocean-700 hover:text-ocean-800" href="/login">{text.loginNow}</Link></p>
        </form>
        <p className="mt-4 rounded-lg border border-slate-200 bg-white/70 px-4 py-3 text-center text-xs text-slate-500 shadow-sm">{text.demo}</p>
      </div>
    </PageContainer>
  );
}
