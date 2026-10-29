export function liveDateWindow(from: string, to?: string, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const start = from.slice(0, 10);
  return { from: start < today ? today : start, adjusted: start < today, expired: Boolean(to && to.slice(0, 10) < today) };
}
