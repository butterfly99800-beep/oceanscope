// Schedule views display ISO components verbatim. Store the carrier's port-local
// calendar and clock in those components; the original offset remains in rawSourceData.
export function portClock(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2})(\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(value.trim());
  if (!match) return null;
  const timeKnown = Boolean(match[2]);
  const wall = `${match[1]}T${match[2] || "12:00"}:${match[3] || "00"}`;
  const date = new Date(wall + (match[4] || "") + "Z");
  if (Number.isNaN(date.getTime()) || !date.toISOString().startsWith(wall)) return null;
  return { iso: date.toISOString(), timeKnown };
}

export function cmaSiDeadline(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  return portClock(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute}:${second || "00"}`)?.iso ?? null;
}
