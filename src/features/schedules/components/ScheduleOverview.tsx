"use client";
import { createScheduleWorkbook, scheduleGroups, departureWeekday, departureWeekdays } from "../schedule-export";
import { useState } from "react";
import type { SailingSchedule } from "@/features/schedules/types";

function date(value: string | null | undefined) { return value ? value.slice(0, 10) : ""; }

export function ScheduleOverview({ schedules }: { schedules: SailingSchedule[] }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const groups = [true, false, null].map(direct => ({
    label: direct === true ? "直航" : direct === false ? "中转" : "直达／中转待确认",
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
    <p className="mt-3 text-xs text-slate-500">按当前查询结果的计划离港日期汇总，不代表固定每周班期。航程仅展示船司已公布数据。</p>
    {groups.filter(group => group.rows.length).map(group => {
      const table = <div className="mt-3 overflow-x-auto rounded-lg border border-blue-100"><table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[#5b8fdf] text-white"><tr><th className="w-20 px-4 py-3">开航日</th><th className="px-4 py-3">船司 / 服务 · 航程</th><th className="w-56 px-4 py-3">计划离港日期</th></tr></thead>
        <tbody>{[0,1,2,3,4,5,6,-1].map(day => {
          const rows = group.rows.filter(row => departureWeekday(row.etd) === day);
          if (!rows.length) return null;
          const services = scheduleGroups(rows);
          return <tr key={day} className="border-t border-blue-100 even:bg-[#f5f8fe]">
            <th scope="row" className="px-4 py-4 align-top font-semibold text-blue-600">{departureWeekdays[day] || "待确认"}</th>
            <td className="px-4 py-3"><div className="flex flex-wrap gap-x-5 gap-y-3">{services.map(service => <div key={JSON.stringify([service.carrier,service.service])}>
              <span className="font-semibold text-slate-800">{service.carrier}</span>{service.service && <span className="ml-1 text-slate-500">({service.service})</span>}
              {service.minDays !== null && <span className="ml-2 text-blue-600">{service.minDays === service.maxDays ? service.minDays : service.minDays + "–" + service.maxDays} 天</span>}
            </div>)}</div></td>
            <td className="px-4 py-3"><div className="flex flex-wrap gap-2">{Array.from(new Set(rows.map(row => date(row.etd)))).sort().map(d => <span key={d} title={d} className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-medium text-orange-700">{d.slice(5)}</span>)}</div></td>
          </tr>;
        })}</tbody></table></div>;
      return group.label === "直达／中转待确认" ? <details key={group.label} open={group.rows.length === schedules.length ? true : undefined} className="mt-5 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-medium text-slate-600">{group.label} · {group.rows.length} 条</summary><p className="mt-2 text-xs text-slate-500">已取得船期，但来源尚未提供可核验的直达或中转信息；不影响查看船名和日期。</p>{table}</details>
        : <div key={group.label} className="mt-5"><h3 className="font-semibold text-slate-800">{group.label}<span className="ml-2 text-xs font-normal text-slate-500">{group.rows.length} 条船期</span></h3>{table}</div>;
    })}
  </section>;
}
