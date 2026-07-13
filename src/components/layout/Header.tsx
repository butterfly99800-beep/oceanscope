"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Ship, X } from "lucide-react";
import { useState } from "react";
import { navItems } from "@/lib/navigation";

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const isActive = (href: string) => href !== "#help" && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink text-white shadow-lg shadow-slate-950/10">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink" onClick={() => setIsOpen(false)}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-ocean-500 to-violet-500"><Ship className="h-5 w-5" aria-hidden="true" /></span><span>OceanScope</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="主导航">
          {navItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${isActive(item.href) ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>{Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}{item.label}</Link>; })}
        </nav>
        <div className="hidden items-center gap-3 lg:flex"><button className="rounded-md px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink">登录</button><button className="rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink">开始使用</button></div>
        <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink lg:hidden" aria-label={isOpen ? "关闭导航" : "打开导航"} aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)}>{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {isOpen ? <div className="border-t border-white/10 bg-ink px-4 py-4 lg:hidden"><nav className="flex flex-col gap-2" aria-label="移动主导航">{navItems.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} onClick={() => setIsOpen(false)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${isActive(item.href) ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>{Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}{item.label}</Link>; })}</nav><div className="mt-4 grid grid-cols-2 gap-3"><button className="rounded-md border border-white/15 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500">登录</button><button className="rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500">开始使用</button></div></div> : null}
    </header>
  );
}
