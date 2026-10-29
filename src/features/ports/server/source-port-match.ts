import type { Port } from "@prisma/client";

type SourcePort = Pick<Port, "name" | "nameZh" | "locode">;
// Explicit carrier spelling, not a fuzzy city match (e.g. Shenzhen != Yantian).
const officialNames: Record<string, string[]> = { CNYTN: ["Yantian"], CNSHK: ["Shekou"] };

export function matchesSourcePort(value: string | undefined, port: SourcePort) {
  if (!value) return false;
  const normalized = value.split(/[,;(]/)[0].trim().toLowerCase();
  return [port.name, port.nameZh, port.locode, canonicalPortCode(port.locode), ...(officialNames[port.locode] || [])]
    .some((name) => name?.trim().toLowerCase() === normalized);
}

// Legacy project code CNNBO and official carrier code CNNGB both identify Ningbo.
export function samePortCode(left: string, right: string) {
  return canonicalPortCode(left) === canonicalPortCode(right);
}

export function canonicalPortCode(code: string) {
  return ({ CNNBO: "CNNGB", CNQIN: "CNTAO" } as Record<string, string>)[code] || code;
}
