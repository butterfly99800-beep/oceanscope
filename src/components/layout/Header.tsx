"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Ship, UserCircle, X } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { navItems } from "@/lib/navigation";

function AuthActions({ onNavigate }: { onNavigate?: () => void }) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  if (status === "loading") return <div className="h-9 w-28 rounded-md bg-white/10" />;
  if (!session?.user) {
    return (
      <>
        <Link href="/login" onClick={onNavigate} className="rounded-md px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink">??</Link>
        <Link href="/register" onClick={onNavigate} className="rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink">??</Link>
      </>
    );
  }
  const label = session.user.name || session.user.email || "User";
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink">
        <UserCircle className="h-4 w-4" aria-hidden="true" />
        <span className="max-w-36 truncate">{label}</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[1200] mt-2 w-48 rounded-lg border border-slate-200 bg-white p-2 text-ink shadow-xl">
          <Link href="/orders" onClick={() => { setOpen(false); onNavigate?.(); }} className="block rounded-md px-3 py-2 text-sm font-semibold hover:bg-ocean-50">????</Link>
          <button type="button" disabled className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-400">????</button>
          <button type="button" onClick={() => void signOut({ callbackUrl: "/" })} className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-rose-600 hover:bg-rose-50">????</button>
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  if (pathname.startsWith("/admin")) return null;
  const isActive = (href: string) => href !== "#help" && (pathname === href || pathname.startsWith(href + "/"));
  const close = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-ink text-white shadow-lg shadow-slate-950/10">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-md text-lg font-semibold tracking-normal outline-none transition focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink" onClick={close}>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-ocean-500 to-violet-500"><Ship className="h-5 w-5" aria-hidden="true" /></span>
          <span>OceanScope</span>
        </Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${isActive(item.href) ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>
                {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden items-center gap-3 lg:flex"><AuthActions /></div>
        <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink lg:hidden" aria-label={isOpen ? "close navigation" : "open navigation"} aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)}>{isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
      </div>
      {isOpen ? (
        <div className="border-t border-white/10 bg-ink px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-2" aria-label="mobile navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} onClick={close} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ocean-500 focus-visible:ring-offset-2 focus-visible:ring-offset-ink ${isActive(item.href) ? "bg-white text-ink" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>
                  {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-4 flex flex-wrap gap-3"><AuthActions onNavigate={close} /></div>
        </div>
      ) : null}
    </header>
  );
}
