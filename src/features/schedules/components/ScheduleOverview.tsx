"use client";
import { createScheduleWorkbook } from "../schedule-export";
import { useState } from "react";
import type { SailingSchedule } from "@/features/schedules/types";

function date(value: string | null | undefined) { return value ? value.slice(0, 10) : ""; }

export function ScheduleOverview({ schedules }: { schedules: SailingSchedule[] }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const groups = [true, false, null].map(direct => ({
    label: direct === true ? "直航" : direct === false ? "中转" : "运输方式未公布",
    rows: schedules.filter(row => row.direct === direct),
  }));
  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const book = await createScheduleWorkbook(schedules);
      const buffer = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(new Blob([buffer as ArrayBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "OceanScope-schedules.xlsx";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError("导出失败，请重试"); }
    finally { setExporting(false); }
  }
  if (!schedules.length) return null;
  return <section className="rounded-lg border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between"><h2 className="font-semibold">航线汇总</h2>
      <button type="button" disabled={exporting} onClick={() => void exportExcel()} className="rounded bg-ocean-600 px-4 py-2 text-white disabled:opacity-50">{exporting ? "正在导出…" : `导出 Excel（${schedules.length} 条）`}</button></div>
    {schedules.some(row => row.carrierCode === "ZIM") && <p className="mt-2 text-xs text-slate-500">ZIM 为官网已发布的上海/盐田至洛杉矶船期表，未覆盖全部点到点方案。</p>}
    {error && <p role="alert">{error}</p>}
    {groups.filter(group => group.rows.length).map(group => <div key={group.label} className="mt-4">
      <h3 className="font-semibold">{group.label} · {group.rows.length} 条</h3>
      <div className="overflow-x-auto"><table className="mt-2 w-full text-left text-sm"><thead className="bg-blue-50"><tr><th>船司</th><th>服务</th><th>已公布开航日期</th><th>已公布航程</th></tr></thead>
        <tbody>{Array.from(new Set(group.rows.map(row => JSON.stringify([row.carrier, row.serviceName])))).map(key => {
          const [carrier, service] = JSON.parse(key);
          const rows = group.rows.filter(row => row.carrier === carrier && row.serviceName === service);
          const days = rows.map(row => row.transitDays).filter((v): v is number => v !== null);
          const range = days.length ? (Math.min(...days) === Math.max(...days) ? Math.min(...days) : `${Math.min(...days)}–${Math.max(...days)}`) + " 天" : "";
          return <tr key={key} className="border-b border-slate-100"><td className="py-2">{carrier}</td><td>{service}</td><td>{Array.from(new Set(rows.map(row => date(row.etd)))).sort().join("、")}</td><td>{range}</td></tr>;
        })}</tbody></table></div>
    </div>)}
  </section>;
}
