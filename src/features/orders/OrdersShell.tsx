"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { OrderEmptyState } from "@/features/orders/components/OrderEmptyState";
import { OrderList } from "@/features/orders/components/OrderList";
import { getOrders } from "@/features/orders/lib/orderStorage";
import type { BookingOrder } from "@/features/orders/types";

export function OrdersShell() {
  const [orders, setOrders] = useState<BookingOrder[]>([]);
  useEffect(() => setOrders(getOrders()), []);
  return <PageContainer><PageHeader eyebrow="Orders" title="我的订单" description="查看和管理已提交的模拟预订" />{orders.length === 0 ? <OrderEmptyState /> : <OrderList orders={orders} />}</PageContainer>;
}
