"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { BookingOrder } from "@/features/orders/types";

type OrderResponse = { data: BookingOrder } | { error: { message: string } };

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
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    fetch(`/api/orders/${id}`).then((response) => response.json().then((payload: OrderResponse) => ({ response, payload }))).then(({ response, payload }) => {
      if (!active) return;
      if (!response.ok || "error" in payload) {
        setOrder(null);
        setError("error" in payload ? payload.error.message : "Order not found");
      } else setOrder(payload.data);
    }).catch(() => {
      if (active) {
        setOrder(null);
        setError("Failed to load order");
      }
    });
    return () => { active = false; };
  }, [id]);

  if (order === undefined) return <PageContainer><div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">Loading order...</div></PageContainer>;
  if (!order) return <PageContainer><div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"><h1 className="text-xl font-semibold text-ink">Order not found</h1><p className="mt-2 text-sm text-slate-500">{error}</p><Link href="/orders" className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white">Back to orders</Link></div></PageContainer>;

  return (
    <PageContainer>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-ocean-700">Order Detail</p><h1 className="mt-2 text-3xl font-semibold text-ink">{order.bookingNumber}</h1><p className="mt-2 text-sm text-slate-500">Created: {new Date(order.createdAt).toLocaleString()}</p></div><div className="flex items-center gap-3"><span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700 ring-1 ring-amber-200">{order.status}</span><Link href="/orders" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700">Back to orders</Link></div></div>
      <div className="grid gap-5 lg:grid-cols-2"><Card title="Route"><Row label="Origin" value={order.origin} /><Row label="Destination" value={order.destination} /><Row label="Origin code" value={order.originPortCode} /><Row label="Destination code" value={order.destinationPortCode} /><Row label="ETD" value={order.etd} /><Row label="ETA" value={order.eta} /><Row label="Transit" value={`${order.transitDays} days`} /><Row label="Stops" value={`${order.stops}`} /></Card><Card title="Transport"><Row label="Carrier" value={order.carrier} /><Row label="Service" value={order.serviceName} /><Row label="Vessel" value={order.vesselName} /><Row label="Voyage" value={order.voyageNumber} /><Row label="Mode" value={order.transportMode} /><Row label="Quote valid until" value={order.quoteValidUntil} /></Card><Card title="Cargo"><Row label="Cargo type" value={order.cargoType} /><Row label="Ready date" value={order.readyDate} /><Row label="Containers" value={containerSummary(order)} /></Card><Card title="Services"><Row label="Selected services" value={order.selectedAdditionalServices.join(" / ") || "None"} /><Row label="Insurance" value={order.insuranceOption} /><Row label="Free days" value={order.additionalFreeDays} /></Card></div>
      <Card title="Cost breakdown"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b border-slate-200 text-left text-slate-500"><th className="py-2">Name</th><th>Category</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Subtotal</th></tr></thead><tbody>{order.costLineItems.map((item) => <tr key={`${item.category}-${item.name}-${item.subtotal}`} className="border-b border-slate-100"><td className="py-2 font-medium text-ink">{item.name}</td><td>{item.category}</td><td className="text-right">{item.quantity}</td><td className="text-right">{formatMoney(item.unitPrice, order.currency)}</td><td className="text-right font-semibold">{formatMoney(item.subtotal, order.currency)}</td></tr>)}</tbody></table></div><div className="mt-4 ml-auto max-w-sm space-y-2 text-sm"><Row label="Subtotal" value={formatMoney(order.subtotal, order.currency)} /><Row label="Tax" value={formatMoney(order.tax, order.currency)} /><Row label="Total" value={formatMoney(order.total, order.currency)} /></div></Card>
      <Card title="Timeline"><div className="space-y-4">{order.timeline.map((item) => <div key={`${item.title}-${item.timestamp}`} className="border-l-2 border-ocean-500 pl-4"><div className="font-semibold text-ink">{item.title}</div><div className="text-sm text-slate-500">{item.description}</div><div className="mt-1 text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</div>{item.actorName ? <div className="mt-1 text-xs font-medium text-ocean-700">Operator: {item.actorName} ({item.actorRole ?? "USER"})</div> : null}</div>)}</div></Card>
    </PageContainer>
  );
}
