"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Database, Home, Menu, Search, Ship, X } from "lucide-react";
import { useState } from "react";

const nav = [
  ["/admin", "数据总览"], ["/admin/ports", "港口管理"], ["/admin/carriers", "船公司管理"], ["/admin/routes", "航线管理"], ["/admin/schedules", "船期管理"], ["/admin/rates", "运价管理"], ["/admin/orders", "订单管理"],
] as const;

function titleFor(pathname: string) {
  return nav.find(([href]) => pathname === href)?.[1] ?? "后台管理";
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const sidebar = <aside className="flex h-full w-72 flex-col bg-ink text-white"><div className="flex h-16 items-center gap-3 border-b border-white/10 px-5"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-ocean-500 to-violet-500"><Ship className="h-5 w-5" /></span><div><div className="font-semibold">OceanScope Admin</div><div className="text-xs text-slate-400">模拟管理后台</div></div></div><nav className="flex-1 space-y-1 p-3">{nav.map(([href, label]) => { const active = pathname === href; return <Link key={href} href={href} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition ${active ? "bg-white text-ink" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Database className="h-4 w-4" />{label}</Link>; })}</nav><Link href="/" className="m-3 flex items-center gap-3 rounded-md border border-white/10 px-3 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/10"><Home className="h-4 w-4" />返回前台</Link></aside>;
  return <div className="min-h-screen bg-ocean-50"><div className="hidden fixed inset-y-0 left-0 z-40 lg:block">{sidebar}</div>{open ? <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="关闭菜单" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />{sidebar}</div> : null}<div className="lg:pl-72"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6"><div className="flex items-center gap-3"><button type="button" onClick={() => setOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 lg:hidden"><Menu className="h-5 w-5" /></button><div><h1 className="text-lg font-semibold text-ink">{titleFor(pathname)}</h1><p className="text-xs text-slate-500">Admin / {titleFor(pathname)}</p></div></div><div className="flex items-center gap-3"><Search className="h-5 w-5 text-slate-400" /><Bell className="h-5 w-5 text-slate-400" /><div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-ocean-500 to-violet-500 text-xs font-bold text-white">A</span><span className="text-sm font-semibold text-slate-700">Admin</span></div></div></header><main className="p-4 sm:p-6">{children}</main></div></div>;
}

export function CloseIcon() { return <X className="h-4 w-4" />; }
