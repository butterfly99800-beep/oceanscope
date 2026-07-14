"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderEmptyState } from "@/features/orders/components/OrderEmptyState";
import { OrderList } from "@/features/orders/components/OrderList";
import { getOrders } from "@/features/orders/lib/orderStorage";
import type { BookingOrder } from "@/features/orders/types";

type OrdersResponse = { data: BookingOrder[] } | { error: { message: string } };

export function OrdersShell() {
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [legacyNotice, setLegacyNotice] = useState(false);

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders?pageSize=100&sortOrder=desc");
      const payload = await response.json() as OrdersResponse;
      if (!response.ok || "error" in payload) {
        setError("error" in payload ? payload.error.message : "Failed to load orders");
        setOrders([]);
      } else setOrders(payload.data);
    } catch {
      setError("Order API is unavailable. Please retry.");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLegacyNotice(getOrders().length > 0);
    void loadOrders();
  }, []);

  return <PageContainer><PageHeader eyebrow="Orders" title="我的订单" description="查看和管理已提交的模拟预订" />{legacyNotice ? <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">Detected legacy local orders. Database orders are now the source of truth.</div> : null}{loading ? <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-card">Loading orders...</div> : error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700"><p>{error}</p><button onClick={() => void loadOrders()} className="mt-3 rounded-md bg-rose-600 px-4 py-2 font-semibold text-white">Retry</button></div> : orders.length === 0 ? <OrderEmptyState /> : <OrderList orders={orders} />}</PageContainer>;
}
