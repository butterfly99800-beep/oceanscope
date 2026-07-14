"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { AdditionalServices } from "@/features/rates/components/AdditionalServices";
import { BookingConfirmation } from "@/features/rates/components/BookingConfirmation";
import { CostBreakdown } from "@/features/rates/components/CostBreakdown";
import { QuoteStepper } from "@/features/rates/components/QuoteStepper";
import type { BookingOrder } from "@/features/orders/types";
import { calculateQuote, formatMoney } from "@/features/rates/lib/calculateQuote";
import type { AdditionalServicesState, ContainerSelection, RateOption } from "@/features/rates/types";

export function QuoteDrawer({ isOpen, option, containers, isDangerous, readyDate, services, onServicesChange, onClose, onBackToResults, onOrderSaved }: { isOpen: boolean; option: RateOption | null; containers: ContainerSelection; isDangerous: boolean; readyDate: string; services: AdditionalServicesState; onServicesChange: (services: AdditionalServicesState) => void; onClose: () => void; onBackToResults: () => void; onOrderSaved: (order: BookingOrder) => void }) {
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<BookingOrder | null>(null);
  const [saveError, setSaveError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const calculation = useMemo(() => option ? calculateQuote({ option, containers, isDangerous, services }) : null, [containers, isDangerous, option, services]);

  if (!isOpen || !option || !calculation) return null;

  const submit = async () => {
    if (isSubmitting || !option.rateQuoteIds?.length || !option.carrierId || !option.originPortId || !option.destinationPortId) {
      setSaveError("Rate quote metadata is missing. Please search rates again.");
      return;
    }
    setIsSubmitting(true);
    setSaveError("");
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateOptionId: option.id,
          rateQuoteIds: option.rateQuoteIds,
          originPortId: option.originPortId,
          destinationPortId: option.destinationPortId,
          carrierId: option.carrierId,
          routeId: option.routeId,
          readyDate,
          cargoType: isDangerous ? "dangerous" : "general",
          containers: Object.entries(containers).filter(([, quantity]) => quantity > 0).map(([type, quantity]) => ({ type, quantity })),
          services,
          subtotal: calculation.subtotal,
          tax: calculation.tax,
          total: calculation.total,
          currency: calculation.currency,
        }),
      });
      const payload = await response.json() as { data?: BookingOrder; error?: { message: string } };
      if (!response.ok || !payload.data) {
        setSaveError(payload.error?.message ?? "Booking submission failed. Please retry.");
        return;
      }
      setOrder(payload.data);
      onOrderSaved(payload.data);
      setStep(3);
    } catch {
      setSaveError("Booking API is unavailable. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] bg-ink/40 backdrop-blur-sm">
      <aside className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        <header className="border-b border-slate-200 p-5"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-ink">完整报价配置</h2><p className="mt-1 text-sm text-slate-500">{option.carrier} · {option.serviceName} · {formatMoney(calculation.total)}</p></div><button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-ink"><X className="h-4 w-4" aria-hidden="true" /></button></div><div className="mt-4"><QuoteStepper step={step} /></div></header>
        <main className="min-h-0 flex-1 overflow-y-auto p-5">
          {saveError ? <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{saveError}</div> : null}
          {step === 0 ? <section className="rounded-lg border border-slate-200 p-4"><h3 className="text-base font-semibold text-ink">运输方案</h3><p className="mt-2 text-sm text-slate-600">{option.origin} → {option.destination}</p><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div>ETD <b>{option.etd}</b></div><div>ETA <b>{option.eta}</b></div><div>运输时长 <b>{option.transitDays} 天</b></div><div>船名航次 <b>{option.vesselName} {option.voyageNumber}</b></div></div></section> : null}
          {step === 1 ? <AdditionalServices value={services} onChange={onServicesChange} /> : null}
          {step === 2 ? <CostBreakdown calculation={calculation} /> : null}
          {step === 3 ? <BookingConfirmation order={order} option={option} containers={containers} calculation={calculation} onBack={() => { onBackToResults(); onClose(); }} /> : null}
        </main>
        {step < 3 ? <footer className="border-t border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><div><span className="text-sm text-slate-500">实时总价</span><div className="text-2xl font-semibold text-ink">{formatMoney(calculation.total)}</div></div><div className="flex gap-2"><button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-ocean-500 hover:text-ocean-700">上一步</button><button type="button" onClick={() => step === 2 ? void submit() : setStep((value) => value + 1)} disabled={isSubmitting} className="h-10 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white hover:brightness-110">{step === 2 ? "提交模拟预订" : "下一步"}</button></div></div></footer> : null}
      </aside>
    </div>
  );
}
