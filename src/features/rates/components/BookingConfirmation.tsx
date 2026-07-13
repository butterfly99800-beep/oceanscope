import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { formatMoney } from "@/features/rates/lib/calculateQuote";
import type { BookingOrder } from "@/features/orders/types";
import type { ContainerSelection, QuoteCalculation, RateOption } from "@/features/rates/types";

function containerSummary(containers: ContainerSelection | Record<string, number>) {
  return Object.entries(containers).filter(([, count]) => count > 0).map(([type, count]) => `${count} x ${type}`).join(" · ") || "未选择";
}

function selectedServices(order: BookingOrder) {
  const services = [...order.selectedAdditionalServices];
  if (order.insuranceOption !== "none") services.push(order.insuranceOption === "basic" ? "基础保险" : "综合保险");
  if (order.additionalFreeDays !== "standard") services.push(`额外免费天数：${order.additionalFreeDays}`);
  return services.join("、") || "未选择附加服务";
}

export function BookingConfirmation({ order, option, containers, calculation, onBack }: { order: BookingOrder | null; option: RateOption; containers: ContainerSelection; calculation: QuoteCalculation; onBack: () => void }) {
  if (order) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-700" aria-hidden="true" />
          <h3 className="mt-3 text-lg font-semibold text-ink">模拟预订已提交</h3>
          <p className="mt-1 text-sm text-slate-600">预订编号：<b>{order.bookingNumber}</b></p>
        </div>
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-ink">订单摘要</h4>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Item label="订单状态" value={order.status} />
            <Item label="创建时间" value={new Date(order.createdAt).toLocaleString("zh-CN")} />
            <Item label="路线" value={`${order.origin} → ${order.destination}`} />
            <Item label="承运商" value={`${order.carrier} · ${order.serviceName}`} />
            <Item label="船名 / 航次" value={`${order.vesselName} / ${order.voyageNumber}`} />
            <Item label="ETD / ETA" value={`${order.etd} / ${order.eta}`} />
            <Item label="运输时长" value={`${order.transitDays} 天`} />
            <Item label="箱型与数量" value={containerSummary(order.containerSelections)} />
            <Item label="货物类型" value={order.cargoType === "dangerous" ? "危险品" : "普通货物"} />
            <Item label="附加服务" value={selectedServices(order)} />
            <Item label="小计" value={formatMoney(order.subtotal, order.currency)} />
            <Item label="税费" value={formatMoney(order.tax, order.currency)} />
            <Item label="总价" value={formatMoney(order.total, order.currency)} />
            <Item label="币种" value={order.currency} />
          </dl>
          <p className="mt-4 text-xs text-slate-500">本页面当前使用模拟数据，不构成真实报价或订舱承诺。</p>
        </section>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href={`/orders/${order.orderId}`} className="inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white">查看订单详情</Link>
          <Link href="/orders" className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700">查看全部订单</Link>
          <button type="button" onClick={onBack} className="h-10 rounded-md bg-ink px-4 text-sm font-semibold text-white">返回方案列表</button>
        </div>
      </div>
    );
  }

  return <div className="rounded-lg border border-slate-200 p-4"><h3 className="text-base font-semibold text-ink">确认预订</h3><dl className="mt-4 space-y-2 text-sm"><div className="flex justify-between"><dt className="text-slate-500">路线</dt><dd className="font-semibold">{option.originPortCode} → {option.destinationPortCode}</dd></div><div className="flex justify-between"><dt className="text-slate-500">承运商</dt><dd className="font-semibold">{option.carrier}</dd></div><div className="flex justify-between"><dt className="text-slate-500">ETD / ETA</dt><dd className="font-semibold">{option.etd} / {option.eta}</dd></div><div className="flex justify-between"><dt className="text-slate-500">箱型</dt><dd className="font-semibold">{containerSummary(containers)}</dd></div><div className="flex justify-between"><dt className="text-slate-500">总价</dt><dd className="font-semibold">{formatMoney(calculation.total)}</dd></div></dl><p className="mt-4 text-xs text-slate-500">本页面当前使用模拟数据，不构成真实报价或订舱承诺。</p></div>;
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 text-sm font-semibold text-ink">{value}</dd></div>;
}
