import type { PortOption } from "@/features/schedules/types";

const codeGroups = [["CNSHA", "CNSGH"], ["CNNGB", "CNNBO"], ["CNTAO", "CNQIN"], ["USLAX", "USLSA"]];
function codeVariants(value: string) {
  return codeGroups.find(group => group.includes(value.toUpperCase())) || [value];
}
export function findHistoryPort(ports: PortOption[], value: string) {
  const key = value.trim().toLowerCase();
  return ports.find(port => port.id.toLowerCase() === key || codeVariants(value).some(code => port.code.toLowerCase() === code.toLowerCase())
    || port.name.toLowerCase().replace(/\s+/g, "-") === key
    || (port.aliases || []).some(alias => alias.toLowerCase() === key));
}

export async function resolveHistoryPort(ports: PortOption[], id: string, name?: string): Promise<PortOption | undefined> {
  const existing = findHistoryPort(ports, id);
  if (existing) return existing;
  for (const query of [...new Set([...codeVariants(id), name].filter((v): v is string => Boolean(v)))]) {
    const response = await fetch(`/api/ports/search?q=${encodeURIComponent(query)}&pageSize=100`);
    if (!response.ok) throw new Error("Location lookup failed");
    const { data } = await response.json() as { data: PortOption[] };
    const exact = findHistoryPort(data, id);
    if (exact) return exact;
    // Legacy carrier codes may no longer exist. Accept only one exact saved name,
    // never the first fuzzy search result or a neighbouring port.
    const named = data.filter(port => name && port.name.toLowerCase() === name.toLowerCase());
    if (query === name && named.length === 1) return named[0];
  }
}
