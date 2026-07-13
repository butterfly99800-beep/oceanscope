"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminResourcePage } from "@/features/admin/components/AdminResourcePage";
import { fallbackOrders } from "@/features/admin/data/mock-admin-data";
import { getOrders, updateOrderStatus } from "@/features/orders/lib/orderStorage";
import type { AdminRecord, AdminResourceConfig } from "@/features/admin/types";

function summarizeContainers(value: Record<string, number>) { return Object.entries(value).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · ") || "-"; }

export function AdminOrdersPage() {
  const [records, setRecords] = useState<AdminRecord[]>(fallbackOrders);
  useEffect(() => { try { const orders = getOrders(); if (orders.length) setRecords(orders.map((order) => ({ id: order.orderId, bookingNumber: order.bookingNumber, createdAt: order.createdAt, origin: order.origin, destination: order.destination, carrier: order.carrier, containers: summarizeContainers(order.containerSelections), quantity: Object.values(order.containerSelections).reduce((sum, count) => sum + count, 0), total: order.total / 100, status: order.status, updatedAt: order.createdAt.slice(0, 10) }))); } catch { setRecords(fallbackOrders); } }, []);
  const config = useMemo<AdminResourceConfig>(() => ({ title: "订单管理", description: "查看模拟订单并在前端状态中调整订单状态。", addLabel: "新增订单", searchPlaceholder: "搜索预订编号、路线或承运商", categoryLabel: "路线", categoryKey: "destination", initialData: records, columns: [{ key: "bookingNumber", label: "预订编号" }, { key: "createdAt", label: "创建时间" }, { key: "origin", label: "起运地" }, { key: "destination", label: "目的地" }, { key: "carrier", label: "承运商" }, { key: "containers", label: "箱型" }, { key: "quantity", label: "数量" }, { key: "total", label: "总价", type: "money" }, { key: "status", label: "状态", type: "badge" }], fields: [{ key: "bookingNumber", label: "预订编号", type: "text", required: true }, { key: "origin", label: "起运地", type: "text" }, { key: "destination", label: "目的地", type: "text" }, { key: "carrier", label: "承运商", type: "text" }, { key: "containers", label: "箱型", type: "text" }, { key: "quantity", label: "数量", type: "number" }, { key: "total", label: "总价", type: "number" }, { key: "status", label: "状态", type: "select", options: ["待确认", "已确认", "已取消"] }] }), [records]);
  useEffect(() => { records.forEach((record) => { if (String(record.id).startsWith("o")) return; if (record.status === "待确认" || record.status === "已确认" || record.status === "已取消") updateOrderStatus(record.id, record.status); }); }, [records]);
  return <AdminResourcePage config={config} />;
}
