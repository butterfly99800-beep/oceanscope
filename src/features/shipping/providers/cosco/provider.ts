import type { Port } from "@prisma/client";
import { fetchCoscoSchedules, type ScraperMode } from "@/features/cosco-scraper/server/cosco-scraper-fetcher";
import { toCoscoPortValue } from "@/features/cosco-scraper/server/cosco-port-mapping";
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

async function resolveCoscoCity(port: CoscoProviderPort, mappingValue: string): Promise<CoscoCityOption | null> {
  const queries = [mappingValue, port.locode, port.name].filter(Boolean);
  for (const query of queries) {
    const options = await searchCoscoCityOptions(query);
    const exact = options.find((option) => option.locode?.toUpperCase() === port.locode.toUpperCase());
    if (exact) return exact;
    if (options[0]) return options[0];
  }
  return null;
}

export const COSCOProvider: ShippingProvider<CoscoProviderSearchInput, CoscoScrapeResult> = {
  code: "COSCO",
  async searchSchedule(input) {
    const [originMapping, destinationMapping] = await Promise.all([
      toCoscoPortValue(input.originPort),
      toCoscoPortValue(input.destinationPort),
    ]);
    const [originCity, destinationCity] = await Promise.all([
      input.originCityUuid ? null : resolveCoscoCity(input.originPort, originMapping),
      input.destinationCityUuid ? null : resolveCoscoCity(input.destinationPort, destinationMapping),
    ]);

    return fetchCoscoSchedules(
      {
        origin: input.originOverride || originCity?.fullName || originMapping,
        destination: input.destinationOverride || destinationCity?.fullName || destinationMapping,
        originCityUuid: input.originCityUuid || originCity?.uuid,
        destinationCityUuid: input.destinationCityUuid || destinationCity?.uuid,
        dateFrom: input.departureDate,
        dateTo: input.dateTo,
        forceRefresh: input.forceRefresh,
      },
      input.mode
    );
  },
};
