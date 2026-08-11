import type { Port } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type NormalizedPort = Pick<Port, "id" | "name" | "nameZh" | "locode" | "country" | "countryCode" | "region">;

function normalizeText(value: string) {
  return value.trim();
}

function aliasesOf(port: Port) {
  const aliases = port.aliases;
  return Array.isArray(aliases) ? aliases.filter((item): item is string => typeof item === "string") : [];
}

function toNormalizedPort(port: Port): NormalizedPort {
  return {
    id: port.id,
    name: port.name,
    nameZh: port.nameZh,
    locode: port.locode,
    country: port.country,
    countryCode: port.countryCode,
    region: port.region,
  };
}

export async function normalizePort(input: string): Promise<NormalizedPort | null> {
  const query = normalizeText(input);
  if (!query) return null;

  const upper = query.toUpperCase();
  if (/^[A-Z]{5}$/.test(upper)) {
    const byLocode = await prisma.port.findUnique({ where: { locode: upper } });
    if (byLocode) return toNormalizedPort(byLocode);
  }

  const candidates = await prisma.port.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { locode: { contains: upper } },
        { name: { contains: query } },
        { nameZh: { contains: query } },
      ],
    },
    take: 50,
  });

  const lower = query.toLowerCase();
  const aliasMatch = candidates.find((port) => aliasesOf(port).some((alias) => alias.toLowerCase() === lower));
  if (aliasMatch) return toNormalizedPort(aliasMatch);

  const exactName = candidates.find((port) => port.name.toLowerCase() === lower || port.nameZh === query || port.locode === upper);
  if (exactName) return toNormalizedPort(exactName);

  const fuzzy = candidates.find((port) =>
    port.name.toLowerCase().includes(lower) ||
    Boolean(port.nameZh?.includes(query)) ||
    aliasesOf(port).some((alias) => alias.toLowerCase().includes(lower))
  );
  return fuzzy ? toNormalizedPort(fuzzy) : null;
}

export async function getCarrierPortMapping(carrierCode: string, portId: string) {
  return prisma.carrierPortMapping.findFirst({
    where: {
      portId,
      carrier: { code: carrierCode.toUpperCase() },
    },
    select: { mappingValue: true },
  });
}
