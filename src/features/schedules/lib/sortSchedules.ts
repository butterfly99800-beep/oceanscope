import type { SailingSchedule, ScheduleSortOption } from "@/features/schedules/types";

export function sortSchedules(schedules: SailingSchedule[], sort: ScheduleSortOption) {
  return [...schedules].sort((a, b) => {
    if (sort === "earliestDeparture") return a.etd.localeCompare(b.etd);
    if (sort === "earliestArrival") return a.eta.localeCompare(b.eta);
    if (sort === "shortestTransit") return (a.transitDays ?? Number.MAX_SAFE_INTEGER) - (b.transitDays ?? Number.MAX_SAFE_INTEGER);
    if (sort === "fewestStops") return (a.stopCount ?? Number.MAX_SAFE_INTEGER) - (b.stopCount ?? Number.MAX_SAFE_INTEGER) || (a.transitDays ?? Number.MAX_SAFE_INTEGER) - (b.transitDays ?? Number.MAX_SAFE_INTEGER);
    const aScore = a.direct === true ? 2 : a.direct === false ? -(a.stopCount ?? 0) : -100;
    const bScore = b.direct === true ? 2 : b.direct === false ? -(b.stopCount ?? 0) : -100;
    return bScore - aScore || a.etd.localeCompare(b.etd);
  });
}
