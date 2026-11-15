import type { SailingSchedule, ScheduleSortOption } from "@/features/schedules/types";

export function sortSchedules(schedules: SailingSchedule[], sort: ScheduleSortOption) {
  return [...schedules].sort((a, b) => {
    const chronological = a.etd.localeCompare(b.etd) || (a.eta || "9999").localeCompare(b.eta || "9999") || a.carrierCode.localeCompare(b.carrierCode) || a.id.localeCompare(b.id);
    if (sort === "earliestDeparture") return chronological;
    if (sort === "earliestArrival") return (a.eta || "9999").localeCompare(b.eta || "9999") || chronological;
    if (sort === "shortestTransit") return (a.transitDays ?? Number.MAX_SAFE_INTEGER) - (b.transitDays ?? Number.MAX_SAFE_INTEGER) || chronological;
    if (sort === "fewestStops") return (a.stopCount ?? Number.MAX_SAFE_INTEGER) - (b.stopCount ?? Number.MAX_SAFE_INTEGER) || (a.transitDays ?? Number.MAX_SAFE_INTEGER) - (b.transitDays ?? Number.MAX_SAFE_INTEGER) || chronological;
    return chronological;
  });
}
