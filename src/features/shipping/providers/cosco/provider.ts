import type { Port } from "@prisma/client";
import { fetchCoscoSchedules, type ScraperMode } from "@/features/cosco-scraper/server/cosco-scraper-fetcher";
import { getCarrierPortMapping } from "@/features/ports/server/port-normalizer";
import { searchCoscoCityOptions } from "@/features/cosco-scraper/server/cosco-schedule-scraper-api";
import type { CoscoCityOption, CoscoScrapeResult } from "@/features/cosco-scraper/types";
import type { ShippingProvider } from "@/features/shipping/providers/types";

type CoscoProviderPort = Pick<Port, "id" | "name" | "nameZh" | "locode" | "country">;

export type CoscoProviderSearchInput = {
  originPort: CoscoProviderPort;
  destinationPort: CoscoProviderPort;
  departureDate: string;
  dateTo?: string;
  mode?: ScraperMode;
  originOverride?: string;
  destinationOverride?: string;
  originCityUuid?: string;
  destinationCityUuid?: string;
  forceRefresh?: boolean;
};

async function resolveCoscoCity(port: CoscoProviderPort): Promise<CoscoCityOption | null> {
  const queries = [port.locode, port.name].filter(Boolean);
  for (const query of queries) {
    const options = await searchCoscoCityOptions(query);
    const exact = options.find((option) => option.locode?.toUpperCase() === port.locode.toUpperCase());
    if (exact) return exact;
  }
  return null;
}

// 有 CITY_UUID 映射时直接用真实城市 ID 构造，跳过地点搜索
async function resolveCity(port: CoscoProviderPort): Promise<{ uuid?: string; fullName?: string } | null> {
  const mapping = await getCarrierPortMapping("COSCO", port.id, "CITY_UUID");
  if (mapping?.mappingValue) {
    return { uuid: mapping.mappingValue, fullName: `${port.name},${port.locode}` };
  }
  return resolveCoscoCity(port);
}

export const COSCOProvider: ShippingProvider<CoscoProviderSearchInput, CoscoScrapeResult> = {
  code: "COSCO",
  async searchSchedule(input) {
    const [originCity, destinationCity] = await Promise.all([
      input.originCityUuid ? null : resolveCity(input.originPort),
      input.destinationCityUuid ? null : resolveCity(input.destinationPort),
    ]);

    const result = await fetchCoscoSchedules(
      {
        origin: input.originOverride || originCity?.fullName || input.originPort.locode,
        destination: input.destinationOverride || destinationCity?.fullName || input.destinationPort.locode,
        originCityUuid: input.originCityUuid || originCity?.uuid,
        destinationCityUuid: input.destinationCityUuid || destinationCity?.uuid,
        dateFrom: input.departureDate,
        dateTo: input.dateTo,
        forceRefresh: input.forceRefresh,
      },
      input.mode
    );
    // The public response describes ocean POL/POD plus inland facilities. Do not
    // relabel the ocean ETA as an inland delivery ETA when the latter is absent.
    if (result.schedules.some(item => /Rail/i.test(item.rawText) && item.destinationText.split(",")[0].trim().toLowerCase() !== input.destinationPort.name.split(",")[0].trim().toLowerCase())) {
      result.warnings.push("COSCO_INLAND_UNSUPPORTED: official ocean legs returned; final inland arrival is not provided as ETA");
    }
    return result;
  },
};
