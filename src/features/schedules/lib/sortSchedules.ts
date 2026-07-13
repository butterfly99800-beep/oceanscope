import type { SailingSchedule, ScheduleSortOption } from "@/features/schedules/types";

export function sortSchedules(schedules: SailingSchedule[], sort: ScheduleSortOption) {
  return [...schedules].sort((a, b) => {
    if (sort === "earliestDeparture") return a.etd.localeCompare(b.etd);
    if (sort === "earliestArrival") return a.eta.localeCompare(b.eta);
    if (sort === "shortestTransit") return a.transitDays - b.transitDays;
    if (sort === "highestReliability") return b.departureReliability - a.departureReliability;
    if (sort === "fewestStops") return a.stopCount - b.stopCount || a.transitDays - b.transitDays;
    const aScore = Number(a.tags.includes("推荐")) * 3 + Number(a.direct) + a.departureReliability / 100;
    const bScore = Number(b.tags.includes("推荐")) * 3 + Number(b.direct) + b.departureReliability / 100;
    return bScore - aScore || a.etd.localeCompare(b.etd);
  });
}
