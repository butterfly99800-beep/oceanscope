import type { AdditionalServicesState, ContainerSelection, CostLineItem, QuoteCalculation, RateOption } from "@/features/rates/types";

const TAX_RATE_BASIS_POINTS = 850;

function roundCents(value: number) {
  return Math.round(value);
}

function containerUnits(containers: ContainerSelection) {
  return Object.values(containers).reduce((sum, count) => sum + count, 0);
}

function line(category: CostLineItem["category"], name: string, unitPrice: number, quantity: number): CostLineItem {
  return { category, name, unitPrice, quantity, subtotal: roundCents(unitPrice * quantity) };
}

export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export function calculateQuote({
  option,
  containers,
  isDangerous,
  services,
}: {
  option: RateOption;
  containers: ContainerSelection;
  isDangerous: boolean;
  services: AdditionalServicesState;
}): QuoteCalculation {
  const units = Math.max(1, containerUnits(containers));
  const items: CostLineItem[] = [
    line("基础费用", "Ocean Freight", option.baseFreight, units),
    line("基础费用", "Documentation Fee", 8500, 1),
    line("基础费用", "Terminal Handling Charge", 18500, units),
    line("基础费用", "Booking Fee", 6500, 1),
    line("起运地费用", "Origin Handling", 12500, units),
    line("目的地费用", "Destination Handling", 14500, units),
    line("其他费用", "Fuel Surcharge", Math.round(option.surcharges * 0.42), 1),
  ];

  if (services.exportCustoms) items.push(line("起运地费用", "Export Customs Clearance", 12000, 1));
  if (services.importCustoms) items.push(line("目的地费用", "Import Customs Clearance", 13500, 1));
  if (services.pickup) items.push(line("起运地费用", "Pickup Service", 38000, 1));
  if (services.delivery) items.push(line("目的地费用", "Delivery Service", 42000, 1));
  if (isDangerous) items.push(line("其他费用", "Dangerous Goods Surcharge", 56000, units));

  if (services.insurance === "basic") items.push(line("其他费用", "Insurance", 26000, 1));
  if (services.insurance === "premium") items.push(line("其他费用", "Insurance", 52000, 1));

  const freeDayCost = { standard: 0, plus5: 15000, plus10: 28000, plus15: 39000 }[services.freeDays];
  if (freeDayCost > 0) items.push(line("其他费用", "Additional Free Days", freeDayCost, units));

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const tax = roundCents((subtotal * TAX_RATE_BASIS_POINTS) / 10000);
  return { baseFreight: option.baseFreight * units, lineItems: items, subtotal, tax, total: subtotal + tax, currency: "USD" };
}
