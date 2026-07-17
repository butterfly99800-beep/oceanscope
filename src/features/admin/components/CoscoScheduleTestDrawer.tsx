"use client";

import { RefreshCcw, Ship, X } from "lucide-react";
import { useState } from "react";
import type { CoscoCommitResult, CoscoSchedulePreview, CoscoScrapeResult } from "@/features/cosco-scraper/types";

type ApiError = { error: { code: string; message: string } };

type Props = {
  open: boolean;
  onClose: () => void;
  onCommitted?: () => void;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function parseJson<T>(response: Response): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  const payload = (await response.json().catch(() => null)) as { data?: T } | ApiError | null;
  if (!response.ok) {
    const error = payload && "error" in payload ? payload.error : { code: "REQUEST_FAILED", message: "Request failed" };
    return { ok: false, code: error.code, message: error.message };
  }
  if (payload && "data" in payload && payload.data) return { ok: true, data: payload.data };
  return { ok: false, code: "EMPTY_RESPONSE", message: "Empty response" };
}

function SchedulePreviewTable({ schedules }: { schedules: CoscoSchedulePreview[] }) {
  if (!schedules.length) return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500">No parsed COSCO schedule rows yet. If the result page changed, update the adapter selectors.</div>;
  return <div className="overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[860px] text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">Vessel</th><th className="px-3 py-2">Voyage</th><th className="px-3 py-2">Service</th><th className="px-3 py-2">Origin</th><th className="px-3 py-2">Destination</th><th className="px-3 py-2">ETD</th><th className="px-3 py-2">ETA</th><th className="px-3 py-2">Days</th></tr></thead><tbody>{schedules.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2 font-semibold text-ink">{item.vesselName ?? "-"}</td><td className="px-3 py-2">{item.voyageNumber ?? "-"}</td><td className="px-3 py-2">{item.serviceName ?? "-"}</td><td className="px-3 py-2">{item.originLocode ?? item.originText}</td><td className="px-3 py-2">{item.destinationLocode ?? item.destinationText}</td><td className="px-3 py-2">{item.etd?.slice(0, 10) ?? "-"}</td><td className="px-3 py-2">{item.eta?.slice(0, 10) ?? "-"}</td><td className="px-3 py-2">{item.transitDays ?? "-"}</td></tr>)}</tbody></table></div>;
}

export function CoscoScheduleTestDrawer({ open, onClose, onCommitted }: Props) {
  const [origin, setOrigin] = useState("Shanghai");
  const [destination, setDestination] = useState("Los Angeles");
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState("");
  const [debug, setDebug] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [preview, setPreview] = useState<CoscoScrapeResult | null>(null);
  const [commitResult, setCommitResult] = useState<CoscoCommitResult | null>(null);

  if (!open) return null;

  const runPreview = async () => {
    setLoading(true);
    setError(null);
    setCommitResult(null);
    const response = await fetch("/api/admin/integrations/cosco/schedules/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination, dateFrom, dateTo, debug, forceRefresh }),
    });
    const result = await parseJson<CoscoScrapeResult>(response);
    if (result.ok) setPreview(result.data);
    else setError({ code: result.code, message: result.message });
    setLoading(false);
  };

  const commit = async () => {
    if (!preview?.schedules.length) return;
    setCommitting(true);
    setError(null);
    const response = await fetch("/api/admin/integrations/cosco/schedules/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "skipDuplicates", schedules: preview.schedules }),
    });
    const result = await parseJson<CoscoCommitResult>(response);
    if (result.ok) {
      setCommitResult(result.data);
      onCommitted?.();
    } else {
      setError({ code: result.code, message: result.message });
    }
    setCommitting(false);
  };

  return <div className="fixed inset-0 z-[2400] bg-ink/45"><aside className="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-5"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ocean-700"><Ship className="h-4 w-4" />COSCO live schedule query</div><h3 className="mt-2 text-2xl font-semibold text-ink">COSCO Sailing Schedule Preview</h3><p className="mt-1 text-sm text-slate-500">This feature visits the public COSCO official schedule page in real time. Results are preview only until you confirm writing to MySQL.</p></div><button onClick={onClose} className="admin-icon"><X className="h-4 w-4" /></button></header><div className="grid flex-1 overflow-hidden lg:grid-cols-[320px_1fr]"><section className="space-y-4 overflow-y-auto border-r border-slate-200 p-5"><label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">Origin city</span><input value={origin} onChange={(event) => setOrigin(event.target.value)} className="admin-input" /></label><label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">Destination city</span><input value={destination} onChange={(event) => setDestination(event.target.value)} className="admin-input" /></label><label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">Earliest departure</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="admin-input" /></label><label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">Latest arrival (optional)</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="admin-input" /></label><label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} />Save debug screenshot</label><label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 text-sm text-slate-700"><input type="checkbox" checked={forceRefresh} onChange={(event) => setForceRefresh(event.target.checked)} />Force refresh cache</label><button onClick={() => void runPreview()} disabled={loading || !origin || !destination || !dateFrom} className="admin-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"><RefreshCcw className="h-4 w-4" />{loading ? "Running..." : "Run preview"}</button><p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-800">This tool accesses COSCO official public schedule pages in real time. Captcha, login, 403 or 429 responses stop the test and no seed/mock data is returned.</p></section><section className="space-y-4 overflow-y-auto p-5">{error ? <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><div className="font-semibold">{error.code}</div><p className="mt-1">{error.message}</p></div> : null}{preview ? <div className="space-y-4"><div className="grid gap-3 md:grid-cols-4"><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Data source</div><div className="font-semibold text-ink">{preview.source === "COSCO_LIVE" ? "COSCO live query" : preview.source}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Rows</div><div className="font-semibold text-ink">{preview.schedules.length}</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Duration</div><div className="font-semibold text-ink">{preview.durationMs} ms</div></div><div className="rounded-lg bg-slate-50 p-3"><div className="text-xs text-slate-500">Cache</div><div className="font-semibold text-ink">{preview.fromCache ? "cached" : "live"}</div></div></div><div className="rounded-lg bg-slate-50 p-3 text-sm"><div className="text-xs text-slate-500">Final URL</div><div className="break-all font-semibold text-ink">{preview.finalUrl}</div></div>{preview.warnings.map((warning) => <div key={warning} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{warning}</div>)}<SchedulePreviewTable schedules={preview.schedules} /><details className="rounded-lg border border-slate-200 p-4 text-xs text-slate-600"><summary className="cursor-pointer font-semibold text-ink">Diagnostics</summary><div className="mt-3 space-y-3"><div><div className="font-semibold">Controls</div><ul className="mt-1 list-disc pl-5">{preview.debug.controls.filter((item) => item.visible).slice(0, 12).map((item) => <li key={`${item.name}-${item.selector}`}>{item.name} - {item.selector}</li>)}</ul></div><div><div className="font-semibold">JSON/XHR endpoints</div><ul className="mt-1 list-disc pl-5">{preview.debug.jsonEndpoints.slice(0, 12).map((item) => <li key={item} className="break-all">{item}</li>)}</ul></div>{preview.debug.screenshotPath ? <div>Debug screenshot: {preview.debug.screenshotPath}</div> : null}</div></details>{commitResult ? <div className="rounded-lg border border-ocean-200 bg-ocean-50 p-4 text-sm text-ocean-800">Created {commitResult.created}, updated {commitResult.updated}, skipped {commitResult.skipped}.{commitResult.skippedItems.length ? <ul className="mt-2 list-disc pl-5">{commitResult.skippedItems.slice(0, 8).map((item) => <li key={`${item.id}-${item.reason}`}>{item.id}: {item.reason}</li>)}</ul> : null}</div> : null}</div> : <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-sm text-slate-500">Run a COSCO live preview. Failed queries never return seed or mock schedule data.</div>}</section></div><footer className="flex justify-end gap-2 border-t border-slate-200 p-5"><button onClick={onClose} className="admin-secondary">Close</button><button onClick={() => void commit()} disabled={committing || !preview?.schedules.length} className="admin-primary disabled:cursor-not-allowed disabled:opacity-50">{committing ? "Committing..." : "Commit matched schedules"}</button></footer></aside></div>;
}
