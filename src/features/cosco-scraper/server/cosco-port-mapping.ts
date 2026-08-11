import type { Port } from "@prisma/client";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";

export type CoscoPortInput = Pick<Port, "id" | "name" | "nameZh" | "locode" | "country">;

export async function toCoscoPortValue(port: CoscoPortInput) {
  const mapping = await getCarrierPortMapping("COSCO", port.id);
  if (mapping?.mappingValue) return mapping.mappingValue;
  return `${port.name},${port.country}`;
}
