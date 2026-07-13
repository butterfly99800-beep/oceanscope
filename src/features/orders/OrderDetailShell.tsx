"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { getOrderById } from "@/features/orders/lib/orderStorage";
import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { BookingOrder } from "@/features/orders/types";

function containerSummary(order: BookingOrder) {
  return Object.entries(order.containerSelections).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · ") || "-";
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h2 className="mb-4 text-base font-semibold text-ink">{title}</h2>{children}</section>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-b-0"><span className="text-slate-500">{label}</span><b className="text-right text-slate-800">{value}</b></div>;
}

export function OrderDetailShell({ id }: { id: string }) {
  const [order, setOrder] = useState<BookingOrder | null | undefined>(undefined);
  useEffect(() => setOrder(getOrderById(id)), [id]);

  if (order === undefined) return <PageContainer><div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">正在读取订单...</div></PageContainer>;
  if (!order) return <PageContainer><div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"><h1 className="text-xl font-semibold text-ink">未找到该订单</h1><Link href="/orders" className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white">返回订单列表</Link></div></PageContainer>;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-ocean-700">Order Detail</p><h1 className="mt-2 text-3xl font-semibold text-ink">{order.bookingNumber}</h1><p className="mt-2 text-sm text-slate-500">创建时间：{new Date(order.createdAt).toLocaleString("zh-CN")}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">{order.status}</span><Link href="/orders" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700">返回订单列表</Link></div></div>
      <div className="grid gap-5 lg:grid-cols-2"><Card title="路线信息"><Row label="起运地" value={order.origin} /><Row label="目的地" value={order.destination} /><Row label="起运港代码" value={order.originPortCode} /><Row label="目的港代码" value={order.destinationPortCode} /><Row label="ETD" value={order.etd} /><Row label="ETA" value={order.eta} /><Row label="运输时长" value={`${order.transitDays} 天`} /><Row label="中转次数" value={`${order.stops} 次`} /></Card><Card title="运输方案"><Row label="承运商" value={order.carrier} /><Row label="Service" value={order.serviceName} /><Row label="船名" value={order.vesselName} /><Row label="航次" value={order.voyageNumber} /><Row label="运输方式" value={order.transportMode} /><Row label="报价有效期" value={order.quoteValidUntil} /></Card><Card title="货物信息"><Row label="货物类型" value={order.cargoType === "dangerous" ? "危险品" : "普通货物"} /><Row label="货好日期" value={order.readyDate} /><Row label="箱型与数量" value={containerSummary(order)} /></Card><Card title="附加服务"><Row label="已选择服务" value={order.selectedAdditionalServices.join("、") || "未选择"} /><Row label="保险方案" value={order.insuranceOption} /><Row label="额外免费天数" value={order.additionalFreeDays} /></Card></div>
      <Card title="费用明细"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2">费用名称</th><th>类别</th><th className="text-right">数量</th><th className="text-right">单价</th><th className="text-right">小计</th></tr></thead><tbody>{order.costLineItems.map((item) => <tr key={`${item.category}-${item.name}`} className="border-b border-slate-100"><td className="py-2 font-medium text-ink">{item.name}</td><td>{item.category}</td><td className="text-right">{item.quantity}</td><td className="text-right">{formatMoney(item.unitPrice, order.currency)}</td><td className="text-right font-semibold">{formatMoney(item.subtotal, order.currency)}</td></tr>)}</tbody></table></div><div className="mt-4 ml-auto max-w-sm space-y-2 text-sm"><Row label="小计" value={formatMoney(order.subtotal, order.currency)} /><Row label="税费" value={formatMoney(order.tax, order.currency)} /><Row label="总价" value={formatMoney(order.total, order.currency)} /></div></Card>
      <Card title="状态时间线"><div className="space-y-4">{order.timeline.map((item) => <div key={item.title} className="border-l-2 border-ocean-500 pl-4"><div className="font-semibold text-ink">{item.title}</div><div className="text-sm text-slate-500">{item.description}</div><div className="mt-1 text-xs text-slate-400">{new Date(item.timestamp).toLocaleString("zh-CN")}</div></div>)}</div></Card>
    </PageContainer>
  );
}
