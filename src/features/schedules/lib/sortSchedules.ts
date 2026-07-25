import type { SailingSchedule, ScheduleSortOption } from "@/features/schedules/types";

export function sortSchedules(schedules: SailingSchedule[], sort: ScheduleSortOption) {
  return [...schedules].sort((a, b) => {
    if (sort === "earliestDeparture") return a.etd.localeCompare(b.etd);
    if (sort === "earliestArrival") return a.eta.localeCompare(b.eta);
    if (sort === "shortestTransit") return a.transitDays - b.transitDays;
    if (sort === "fewestStops") return a.stopCount - b.stopCount || a.transitDays - b.transitDays;
    const aScore = Number(a.direct) * 2 - a.stopCount;
    const bScore = Number(b.direct) * 2 - b.stopCount;
    return bScore - aScore || a.etd.localeCompare(b.etd);
  });
}
