import { Anchor, CalendarDays, Ship, Truck } from "lucide-react";
import type { SailingSchedule } from "@/features/schedules/types";

function formatDateTime(value: string | null | undefined, timeKnown = true) {
  if (!value) return { date: "-", time: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "-", time: "" };
  return {
    date: date.toISOString().slice(0, 10),
    time: timeKnown ? date.toISOString().slice(11, 16) : "",
  };
}

function serviceText(value: string | null | undefined) {
  return value?.trim() || "-";
}

function voyageLine(schedule: SailingSchedule) {
  const service = schedule.serviceName ? `/${schedule.serviceName}` : "";
  const voyage = schedule.voyageNumber ? `/${schedule.voyageNumber}` : "";
  return `${service}${voyage}` || "-";
}

function routingText(schedule: SailingSchedule) {
  if (schedule.direct === true) return "直达";
  if (schedule.direct === false && schedule.stopCount !== null) return `${schedule.stopCount} 次中转`;
  if (schedule.direct === false) return "中转";
  return "未提供中转信息";
}

export function ScheduleTable({ schedules, selectedId, onSelect }: { schedules: SailingSchedule[]; selectedId: string | null; onSelect: (schedule: SailingSchedule) => void }) {
  const showCargoNature = schedules.some((schedule) => Boolean(schedule.cargoNature));
  const showCutOff = schedules.some((schedule) => Boolean(schedule.cutOffTime));
  const showAvailable = schedules.some((schedule) => Boolean(schedule.availableTime));
  const showOriginTerminal = schedules.some((schedule) => Boolean(schedule.terminal));
  const showDestinationTerminal = schedules.some((schedule) => Boolean(schedule.destinationTerminal));
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
              <th className="w-[120px] border-r border-blue-300 px-4 py-4">承运人</th>
              {showCargoNature ? <th className="w-[92px] border-r border-blue-300 px-4 py-4">货物类型</th> : null}
              {showCutOff ? <th className="w-[130px] border-r border-blue-300 px-4 py-4">截载时间</th> : null}
              <th className="w-[220px] border-r border-blue-300 px-4 py-4">船名/航线/航次</th>
              <th className="min-w-[460px] border-r border-blue-300 px-4 py-4 text-center">航线信息</th>
              {showAvailable ? <th className="w-[132px] border-r border-blue-300 px-4 py-4">可提货时间</th> : null}
              {showOriginTerminal ? <th className="w-[130px] border-r border-blue-300 px-4 py-4">出发地码头</th> : null}
              {showDestinationTerminal ? <th className="w-[130px] border-r border-blue-300 px-4 py-4">目的地码头</th> : null}
              <th className="w-[110px] px-4 py-4">更多信息</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule, index) => {
              const cutOff = formatDateTime(schedule.cutOffTime, schedule.source !== "OOCL_LIVE_QUERY");
              const etd = formatDateTime(schedule.etd, schedule.etdTimeKnown !== false);
              const eta = formatDateTime(schedule.eta, schedule.etaTimeKnown !== false);
              const available = schedule.availableTime ? formatDateTime(schedule.availableTime) : null;
              return (
                <tr key={schedule.id} onClick={() => onSelect(schedule)} className={`cursor-pointer align-middle transition hover:bg-blue-100/70 ${selectedId === schedule.id ? "bg-ocean-50 ring-2 ring-inset ring-ocean-400" : index % 2 ? "bg-[#eaf3ff]" : "bg-white"}`}>
                  <td className="px-4 py-8">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-ink px-2 py-1 text-xs font-bold text-white">{schedule.carrierCode || "-"}</span>
                      <span className="text-sm text-slate-800">{schedule.carrier || "-"}</span>
                    </div>
                  </td>
                  {showCargoNature ? <td className="px-4 py-8 text-slate-800">{serviceText(schedule.cargoNature ?? "")}</td> : null}
                  {showCutOff ? <td className="px-4 py-8 text-slate-800">
                    <div>{cutOff.date}</div>
                    <div className="mt-1 text-xs text-slate-500">{cutOff.time}</div>
                  </td> : null}
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
                          <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700">{routingText(schedule)}</span>
                          <span className="h-px w-12 border-t border-dashed border-slate-400" />
                          <span className="h-2.5 w-2.5 rounded-full border border-slate-400 bg-white" />
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-1 text-slate-700">
                          <CalendarDays className="h-4 w-4" />
                          <span>{schedule.transitDays !== null ? `${schedule.transitDaysBasis ? "表定" : "在途"} ${schedule.transitDays} 天` : "航程未提供"}</span>
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
                  {showAvailable ? <td className="px-4 py-8 text-slate-800">
                    <div>{available?.date ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">{available?.time ?? ""}</div>
                  </td> : null}
                  {showOriginTerminal ? <td className="px-4 py-8 text-slate-800">{serviceText(schedule.terminal ?? "")}</td> : null}
                  {showDestinationTerminal ? <td className="px-4 py-8 text-slate-800">{serviceText(schedule.destinationTerminal ?? "")}</td> : null}
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
