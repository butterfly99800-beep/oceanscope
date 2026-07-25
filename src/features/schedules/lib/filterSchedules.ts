import type { SailingSchedule, ScheduleFilterState } from "@/features/schedules/types";

function inTransitRange(days: number, range: ScheduleFilterState["transitDays"]) {
  if (range === "0-15") return days <= 15;
  if (range === "16-25") return days >= 16 && days <= 25;
  if (range === "26-35") return days >= 26 && days <= 35;
  if (range === "35+") return days > 35;
  return true;
}

export function filterSchedules(schedules: SailingSchedule[], filters: ScheduleFilterState, favoriteIds: string[], favoritesOnly: boolean) {
  return schedules.filter((schedule) => {
    const carrierMatch = filters.carriers.length === 0 || filters.carriers.includes(schedule.carrier);
    const directMatch = filters.direct === "all" || (filters.direct === "direct" && schedule.direct) || (filters.direct === "transit" && !schedule.direct);
    const stopMatch = filters.stopCount === "all" || (filters.stopCount === "direct" && schedule.stopCount === 0) || (filters.stopCount === "one" && schedule.stopCount === 1) || (filters.stopCount === "twoPlus" && schedule.stopCount >= 2);
    const statusMatch = filters.statuses.length === 0 || filters.statuses.includes(schedule.scheduleStatus);
    const departureMatch = !filters.departureFrom || schedule.etd.slice(0, 10) >= filters.departureFrom;
    const transitMatch = inTransitRange(schedule.transitDays, filters.transitDays);
    const serviceMatch = !filters.serviceName || schedule.serviceName.toLowerCase().includes(filters.serviceName.toLowerCase());
    const vesselMatch = !filters.vesselName || schedule.vesselName.toLowerCase().includes(filters.vesselName.toLowerCase());
    const terminalText = `${schedule.terminal} ${schedule.destinationTerminal} ${schedule.transitPorts.map((port) => port.terminal ?? "").join(" ")}`.toLowerCase();
    const terminalMatch = !filters.terminal || terminalText.includes(filters.terminal.toLowerCase());
    const favoriteMatch = !favoritesOnly || favoriteIds.includes(schedule.id);
    return carrierMatch && directMatch && stopMatch && statusMatch && departureMatch && transitMatch && serviceMatch && vesselMatch && terminalMatch && favoriteMatch;
  });
}

export function countActiveFilters(filters: ScheduleFilterState, favoritesOnly: boolean) {
  let count = favoritesOnly ? 1 : 0;
  if (filters.carriers.length) count += 1;
  if (filters.direct !== "all") count += 1;
  if (filters.stopCount !== "all") count += 1;
  if (filters.statuses.length) count += 1;
  if (filters.departureFrom) count += 1;
  if (filters.transitDays !== "all") count += 1;
  if (filters.serviceName) count += 1;
  if (filters.vesselName) count += 1;
  if (filters.terminal) count += 1;
  return count;
}
