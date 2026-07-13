"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { BookingOrder, BookingStatus } from "@/features/orders/types";

const statuses: Array<"全部" | BookingStatus> = ["全部", "待确认", "已确认", "已取消"];
const sortOptions = ["最新创建", "最早创建", "金额最高", "金额最低"] as const;
type Sort = (typeof sortOptions)[number];

function containerSummary(order: BookingOrder) {
  return Object.entries(order.containerSelections).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · ") || "-";
}

export function OrderList({ orders }: { orders: BookingOrder[] }) {
  const [status, setStatus] = useState<"全部" | BookingStatus>("全部");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("最新创建");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((order) => status === "全部" || order.status === status)
      .filter((order) => !q || [order.bookingNumber, order.origin, order.destination, order.carrier].some((value) => value.toLowerCase().includes(q)))
      .sort((a, b) => {
        if (sort === "最早创建") return a.createdAt.localeCompare(b.createdAt);
        if (sort === "金额最高") return b.total - a.total;
        if (sort === "金额最低") return a.total - b.total;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [orders, query, sort, status]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索预订编号、起运地、目的地或承运商" className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100" />
          <select value={status} onChange={(event) => setStatus(event.target.value as "全部" | BookingStatus)} className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100">{statuses.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-10 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-ocean-500 focus:ring-4 focus:ring-ocean-100">{sortOptions.map((item) => <option key={item}>{item}</option>)}</select>
        </div>
      </div>
      {visible.map((order) => (
        <article key={order.orderId} className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold text-ink">{order.bookingNumber}</h2><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">{order.status}</span></div><p className="mt-1 text-sm text-slate-600">{order.origin} → {order.destination}</p><p className="mt-1 text-xs text-slate-500">{new Date(order.createdAt).toLocaleString("zh-CN")} · {order.carrier} · {containerSummary(order)}</p></div>
            <div className="grid gap-2 text-sm sm:grid-cols-4 lg:w-[520px]"><div><span className="block text-xs text-slate-400">ETD</span><b>{order.etd}</b></div><div><span className="block text-xs text-slate-400">ETA</span><b>{order.eta}</b></div><div><span className="block text-xs text-slate-400">总价</span><b>{formatMoney(order.total, order.currency)}</b></div><Link href={`/orders/${order.orderId}`} className="inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white">查看详情</Link></div>
          </div>
        </article>
      ))}
    </div>
  );
}
