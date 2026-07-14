import type { ContainerType } from "@prisma/client";
import type { RateQuoteWithRelations } from "@/features/rates/server/rate-mapper";
import type { AdditionalServicesState, ContainerSelection, CostLineItem } from "@/features/rates/types";

const TAX_RATE_BASIS_POINTS = 850;

type CalculationInput = {
  quotes: RateQuoteWithRelations[];
  containers: ContainerSelection;
  cargoType: "general" | "dangerous";
  services: AdditionalServicesState;
};

export type ServerBookingCalculation = {
  containerItems: Array<{ containerType: ContainerType; quantity: number; unitPrice: number; subtotal: number }>;
  serviceItems: Array<{ code: string; name: string; description?: string; quantity: number; unitPrice: number; subtotal: number }>;
  costItems: Array<CostLineItem & { code: string }>;
  subtotal: number;
  tax: number;
  total: number;
};

function cents(value: number | string) {
  return Math.round(Number(value) * 100);
}

function line(category: string, code: string, name: string, unitPrice: number, quantity: number): CostLineItem & { code: string } {
  return { category, code, name, unitPrice, quantity, subtotal: Math.round(unitPrice * quantity) };
}

function addOptionalServices(items: Array<CostLineItem & { code: string }>, services: AdditionalServicesState) {
  if (services.exportCustoms) items.push(line("Origin", "EXPORT_CUSTOMS", "Export Customs Clearance", 12000, 1));
  if (services.importCustoms) items.push(line("Destination", "IMPORT_CUSTOMS", "Import Customs Clearance", 13500, 1));
  if (services.pickup) items.push(line("Origin", "PICKUP", "Pickup Service", 38000, 1));
  if (services.delivery) items.push(line("Destination", "DELIVERY", "Delivery Service", 42000, 1));
  if (services.insurance === "basic") items.push(line("Other", "INSURANCE_BASIC", "Insurance", 26000, 1));
  if (services.insurance === "premium") items.push(line("Other", "INSURANCE_PREMIUM", "Insurance", 52000, 1));
  const freeDayCost = { standard: 0, plus5: 15000, plus10: 28000, plus15: 39000 }[services.freeDays];
  if (freeDayCost > 0) items.push(line("Other", `FREE_DAYS_${services.freeDays.toUpperCase()}`, "Additional Free Days", freeDayCost, 1));
}

export function calculateBookingTotal({ quotes, containers, cargoType, services }: CalculationInput): ServerBookingCalculation {
  const selected = Object.entries(containers).filter(([, quantity]) => quantity > 0);
  const costItems: Array<CostLineItem & { code: string }> = [];
  const containerItems: ServerBookingCalculation["containerItems"] = [];
  for (const [type, quantity] of selected) {
    const quote = quotes.find((item) => item.containerType === type || (type === "20GP" && item.containerType === "TWENTY_GP") || (type === "40GP" && item.containerType === "FORTY_GP") || (type === "40HC" && item.containerType === "FORTY_HC") || (type === "45HC" && item.containerType === "FORTY_FIVE_HC"));
    if (!quote) throw new Error(`Missing quote for ${type}`);
    const unitPrice = cents(quote.totalBasePrice.toString());
    containerItems.push({ containerType: quote.containerType, quantity, unitPrice, subtotal: unitPrice * quantity });
    for (const item of quote.lineItems) {
      if (item.code === "DG" && cargoType !== "dangerous") continue;
      const itemQuantity = item.unit === "PER_SHIPMENT" ? 1 : quantity;
      costItems.push(line(item.category, item.code, item.name, cents(item.unitPrice.toString()), itemQuantity));
    }
  }
  addOptionalServices(costItems, services);
  const serviceCodes = new Set(["EXPORT_CUSTOMS", "IMPORT_CUSTOMS", "PICKUP", "DELIVERY", "INSURANCE_BASIC", "INSURANCE_PREMIUM", "FREE_DAYS_PLUS5", "FREE_DAYS_PLUS10", "FREE_DAYS_PLUS15"]);
  const serviceItems = costItems.filter((item) => serviceCodes.has(item.code)).map((item) => ({ code: item.code, name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, subtotal: item.subtotal }));
  const subtotal = costItems.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = Math.round((subtotal * TAX_RATE_BASIS_POINTS) / 10000);
  return { containerItems, serviceItems, costItems, subtotal, tax, total: subtotal + tax };
}

export function centsToDecimal(centsValue: number) {
  return Number((centsValue / 100).toFixed(2));
}
