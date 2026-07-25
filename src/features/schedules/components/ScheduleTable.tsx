import { Anchor, CalendarDays, Ship, Truck } from "lucide-react";
import type { SailingSchedule } from "@/features/schedules/types";

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "" };
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toISOString().slice(11, 16),
  };
}

function serviceText(value: string) {
  return value?.trim() || "-";
}

function voyageLine(schedule: SailingSchedule) {
  const service = schedule.serviceName ? `/${schedule.serviceName}` : "";
  const voyage = schedule.voyageNumber ? `/${schedule.voyageNumber}` : "";
  return `${service}${voyage}` || "-";
}

export function ScheduleTable({ schedules, selectedId, onSelect }: { schedules: SailingSchedule[]; selectedId: string | null; onSelect: (schedule: SailingSchedule) => void }) {
  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        <p>说明：1. 在途时间指起运地到目的地的运输时间</p>
        <p className="mt-1 flex flex-wrap items-center gap-2">2. 内陆运输方式：<Truck className="h-4 w-4" />Truck <Ship className="h-4 w-4" />Feeder</p>
      </div>
      <div className="max-h-[720px] overflow-auto">
        <table className="w-full min-w-[1260px] border-separate border-spacing-0 text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[#3f78b6] text-white">
            <tr className="text-sm font-semibold">
              <th className="w-[92px] border-r border-blue-300 px-4 py-4">货物类型</th>
              <th className="w-[130px] border-r border-blue-300 px-4 py-4">截载时间</th>
              <th className="w-[220px] border-r border-blue-300 px-4 py-4">船名/航线/航次</th>
              <th className="min-w-[460px] border-r border-blue-300 px-4 py-4 text-center">航线信息</th>
              <th className="w-[132px] border-r border-blue-300 px-4 py-4">可提货时间</th>
              <th className="w-[130px] border-r border-blue-300 px-4 py-4">出发地服务</th>
              <th className="w-[130px] border-r border-blue-300 px-4 py-4">目的地服务</th>
              <th className="w-[110px] px-4 py-4">更多信息</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule, index) => {
              const cutOff = formatDateTime(schedule.cutOffTime);
              const etd = formatDateTime(schedule.etd);
              const eta = formatDateTime(schedule.eta);
              const available = schedule.availableTime ? formatDateTime(schedule.availableTime) : null;
              return (
                <tr key={schedule.id} onClick={() => onSelect(schedule)} className={`cursor-pointer align-middle transition hover:bg-blue-100/70 ${selectedId === schedule.id ? "bg-ocean-50 ring-2 ring-inset ring-ocean-400" : index % 2 ? "bg-[#eaf3ff]" : "bg-white"}`}>
                  <td className="px-4 py-8 text-slate-800">{serviceText(schedule.frequency)}</td>
                  <td className="px-4 py-8 text-slate-800">
                    <div>{cutOff.date}</div>
                    <div className="mt-1 text-xs text-slate-500">{cutOff.time}</div>
                  </td>
                  <td className="px-4 py-8 text-slate-800">
                    <div className="font-medium">{serviceText(schedule.vesselName)}</div>
                    <div className="mt-2 leading-6 text-slate-700">{voyageLine(schedule)}</div>
                  </td>
                  <td className="px-4 py-8">
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
                      <div className="text-center">
                        <div className="font-semibold text-slate-800">{etd.date}</div>
                        <div className="mt-1 text-slate-700">{etd.time}</div>
                        <div className="mt-5 text-slate-700">{schedule.originPort}</div>
                        <div className="mt-1 flex justify-center text-slate-500"><Anchor className="h-4 w-4" /></div>
                      </div>
                      <div className="min-w-[190px] pt-12">
                        <div className="flex items-center justify-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white" />
                          <span className="h-px w-12 border-t border-dashed border-slate-400" />
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">{schedule.direct ? "直达" : `${schedule.stopCount} 次中转`}</span>
                          <span className="h-px w-12 border-t border-dashed border-slate-400" />
                          <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white" />
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-1 text-slate-700">
                          <CalendarDays className="h-4 w-4" />
                          <span>{schedule.transitDays > 0 ? `在途 ${schedule.transitDays} 天` : "-"}</span>
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-slate-800">{eta.date}</div>
                        <div className="mt-1 text-slate-700">{eta.time}</div>
                        <div className="mt-5 text-slate-700">{schedule.destinationPort}</div>
                        <div className="mt-1 flex justify-center text-slate-500"><Anchor className="h-4 w-4" /></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-8 text-slate-800">
                    <div>{available?.date ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{available?.time ?? ""}</div>
                  </td>
                  <td className="px-4 py-8 text-slate-800">{serviceText(schedule.terminal)}</td>
                  <td className="px-4 py-8 text-slate-800">{serviceText(schedule.destinationTerminal)}</td>
                  <td className="px-4 py-8">
                    <button type="button" className="font-semibold text-blue-600 hover:text-blue-800">更多信息</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
