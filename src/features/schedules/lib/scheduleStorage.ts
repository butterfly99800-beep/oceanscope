import type { FavoriteSchedule, RecentScheduleSearch } from "@/features/schedules/types";

const RECENT_KEY = "oceanscope_schedule_recent";
const FAVORITE_KEY = "oceanscope_schedule_favorites";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function getRecentScheduleSearches(fallback: RecentScheduleSearch[]) {
  return readJson<RecentScheduleSearch[]>(RECENT_KEY, fallback);
}

export function saveRecentScheduleSearch(search: RecentScheduleSearch, fallback: RecentScheduleSearch[]) {
  const current = getRecentScheduleSearches(fallback);
  const next = [search, ...current.filter((item) => item.originPortId !== search.originPortId || item.destinationPortId !== search.destinationPortId)].slice(0, 8);
  writeJson(RECENT_KEY, next);
  return next;
}

export function getFavoriteScheduleIds() {
  return readJson<FavoriteSchedule[]>(FAVORITE_KEY, []).map((item) => item.scheduleId);
}

export function toggleFavoriteSchedule(scheduleId: string) {
  const current = readJson<FavoriteSchedule[]>(FAVORITE_KEY, []);
  const exists = current.some((item) => item.scheduleId === scheduleId);
  const next = exists ? current.filter((item) => item.scheduleId !== scheduleId) : [...current, { scheduleId, createdAt: new Date().toISOString() }];
  writeJson(FAVORITE_KEY, next);
  return next.map((item) => item.scheduleId);
}
