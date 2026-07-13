import type { BookingOrder, BookingStatus } from "@/features/orders/types";

const STORAGE_KEY = "oceanscope.mockOrders";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse(value: string | null): BookingOrder[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as BookingOrder[]) : [];
  } catch {
    return [];
  }
}

export function getOrders(): BookingOrder[] {
  if (!isBrowser()) return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

export function getOrderById(id: string): BookingOrder | null {
  return getOrders().find((order) => order.orderId === id || order.bookingNumber === id) ?? null;
}

export function generateBookingNumber(existingOrders: BookingOrder[] = getOrders(), date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replaceAll("-", "");
  const count = existingOrders.filter((order) => order.bookingNumber.startsWith(`OCS-${stamp}`)).length + 1;
  return `OCS-${stamp}-${String(count).padStart(4, "0")}`;
}

export function saveOrder(order: BookingOrder): { ok: true; order: BookingOrder } | { ok: false; message: string } {
  if (!isBrowser()) return { ok: false, message: "当前环境不支持保存订单" };
  try {
    const orders = getOrders();
    const next = [order, ...orders.filter((item) => item.orderId !== order.orderId)];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return { ok: true, order };
  } catch {
    return { ok: false, message: "订单保存失败，请检查浏览器存储权限" };
  }
}

export function updateOrderStatus(orderId: string, status: BookingStatus) {
  const orders = getOrders();
  const next = orders.map((order) => (order.orderId === orderId ? { ...order, status } : order));
  if (isBrowser()) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
