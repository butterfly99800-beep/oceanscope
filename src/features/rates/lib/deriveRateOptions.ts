import type { RateOption, RateSearchCriteria } from "@/features/rates/types";
import { mockRateOptions, rateLocations } from "@/features/rates/data/mock-rate-data";

export function getLocationName(id: string) {
  return rateLocations.find((location) => location.id === id)?.name ?? id;
}

export function getLocationCode(id: string) {
  return rateLocations.find((location) => location.id === id)?.locode ?? id.toUpperCase().slice(0, 5);
}

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return base.toISOString().slice(0, 10);
}

export function createRateOptionsForCriteria(criteria: RateSearchCriteria): RateOption[] {
  const origin = getLocationName(criteria.originId);
  const destination = getLocationName(criteria.destinationId);
  const originCode = getLocationCode(criteria.originId);
  const destinationCode = getLocationCode(criteria.destinationId);
  const readyDate = criteria.cargoReadyDate || new Date().toISOString().slice(0, 10);

  return mockRateOptions.map((option, index) => {
    const etd = addDays(readyDate, 2 + index);
    const eta = addDays(etd, option.transitDays);
    return {
      ...option,
      origin,
      destination,
      originPortCode: originCode,
      destinationPortCode: destinationCode,
      etd,
      eta,
      cutOffDate: addDays(etd, -2),
      validUntil: addDays(readyDate, 1 + Math.min(index, 4)),
    };
  });
}
