import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const prisma = new PrismaClient();

const ports = [
  ["Shanghai", "\u4e0a\u6d77", "CNSHA", "China", "CN", "East Asia", 31.2304, 121.4737],
  ["Ningbo", "\u5b81\u6ce2", "CNNGB", "China", "CN", "East Asia", 29.8746, 121.5503],
  ["Yantian", "\u76d0\u7530", "CNYTN", "China", "CN", "East Asia", 22.58, 114.27],
  ["Shekou", "\u86c7\u53e3", "CNSHK", "China", "CN", "East Asia", 22.484, 113.913],
  ["Qingdao", "\u9752\u5c9b", "CNTAO", "China", "CN", "East Asia", 36.0671, 120.3826],
  ["Xiamen", "\u53a6\u95e8", "CNXMN", "China", "CN", "East Asia", 24.4798, 118.0894],
  ["Singapore", "\u65b0\u52a0\u5761", "SGSIN", "Singapore", "SG", "Southeast Asia", 1.3521, 103.8198],
  ["Los Angeles", "\u6d1b\u6749\u77f6", "USLAX", "United States", "US", "North America West Coast", 34.0522, -118.2437],
  ["Long Beach", "\u957f\u6ee9", "USLGB", "United States", "US", "North America West Coast", 33.7701, -118.1937],
  ["Rotterdam", "\u9e7f\u7279\u4e39", "NLRTM", "Netherlands", "NL", "Europe", 51.9244, 4.4777],
  ["Hamburg", "\u6c49\u5821", "DEHAM", "Germany", "DE", "Europe", 53.5511, 9.9937],
  ["Busan", "\u91dc\u5c71", "KRPUS", "South Korea", "KR", "East Asia", 35.1796, 129.0756],
].map(([name, nameZh, locode, country, countryCode, region, latitude, longitude]) => ({ name: String(name), nameZh: String(nameZh), locode: String(locode), country: String(country), countryCode: String(countryCode), region: String(region), latitude: Number(latitude), longitude: Number(longitude) }));

const carriers = [
  ["OceanLink", "OceanLink CN", "OLK", "Singapore"],
  ["Pacific Star", "Pacific Star CN", "PST", "United States"],
  ["BlueWave Shipping", "BlueWave CN", "BWS", "Netherlands"],
  ["Global Horizon", "Global Horizon CN", "GHN", "Germany"],
  ["SeaBridge", "SeaBridge CN", "SBD", "China"],
  ["NorthStar Lines", "NorthStar CN", "NSL", "Canada"],
  ["Atlas Blue", "Atlas Blue CN", "ABL", "Singapore"],
  ["HarborOne", "HarborOne CN", "HBO", "South Korea"],
].map(([name, nameZh, code, country]) => ({ name: String(name), nameZh: String(nameZh), code: String(code), country: String(country) }));

const routes = [
  ["Yantian to Long Beach", "ZEX Express", "OLK", "CNYTN", "USLGB", true, 13, []],
  ["Shanghai to Los Angeles", "Pacific Arrow", "PST", "CNSHA", "USLAX", true, 14, []],
  ["Ningbo to Rotterdam", "Eurasia Loop", "BWS", "CNNGB", "NLRTM", false, 31, ["SGSIN"]],
  ["Shanghai to Hamburg", "North Europe Bridge", "GHN", "CNSHA", "DEHAM", false, 32, ["KRPUS"]],
  ["Qingdao to Los Angeles", "North China West Coast", "SBD", "CNTAO", "USLAX", false, 17, ["KRPUS"]],
  ["Qingdao to Hamburg", "North Europe Link", "GHN", "CNTAO", "DEHAM", false, 34, ["KRPUS", "SGSIN"]],
  ["Shanghai to Singapore", "Asia Shuttle", "SBD", "CNSHA", "SGSIN", true, 7, []],
  ["Singapore to Rotterdam", "Ocean Bridge", "BWS", "SGSIN", "NLRTM", true, 22, []],
  ["Xiamen to Los Angeles", "Pacific Vista", "NSL", "CNXMN", "USLAX", false, 18, ["KRPUS"]],
  ["Shekou to Long Beach", "Pearl River Express", "ABL", "CNSHK", "USLGB", true, 15, []],
  ["Ningbo to Hamburg", "Rhine Connect", "GHN", "CNNGB", "DEHAM", false, 32, ["SGSIN"]],
  ["Busan to Los Angeles", "Korea Pacific", "HBO", "KRPUS", "USLAX", true, 12, []],
];

const schedules = [
  ["OLK", "CNYTN", "USLGB", "ZEX Express", "Transpacific Eastbound", "EVER GLORY", "EG512E", "2026-07-17T22:00:00Z", "2026-07-30T08:00:00Z", 13, true, "Weekly / Fri", "Yantian Intl Terminal", "LBCT", 94, "NORMAL", 0, []],
  ["PST", "CNSHA", "USLAX", "Pacific Arrow", "China US West Coast", "PACIFIC BRIDGE", "PB193E", "2026-07-18T18:30:00Z", "2026-08-01T06:00:00Z", 14, true, "Weekly / Sat", "Yangshan Phase IV", "West Basin", 89, "CUTOFF_SOON", 0, []],
  ["BWS", "CNNGB", "NLRTM", "Eurasia Loop", "Asia Europe Mainline", "BLUE HORIZON", "BH728W", "2026-07-19T15:00:00Z", "2026-08-18T13:00:00Z", 30, false, "Weekly / Sun", "Ningbo Beilun", "RWG", 91, "NORMAL", 0, ["SGSIN"]],
  ["GHN", "CNSHA", "DEHAM", "North Europe Bridge", "Shanghai Hamburg", "GLOBAL DAWN", "GD306W", "2026-07-20T20:00:00Z", "2026-08-21T10:00:00Z", 32, false, "Weekly / Mon", "Waigaoqiao", "CTA", 86, "EXPECTED_DELAY", 8, ["KRPUS"]],
  ["SBD", "CNTAO", "USLAX", "North China West Coast", "North China USWC", "SEA BRIDGE", "SB118E", "2026-07-18T23:00:00Z", "2026-08-04T07:00:00Z", 17, false, "Twice weekly", "QQCT", "TraPac", 82, "NORMAL", 0, ["KRPUS"]],
  ["ABL", "CNSHK", "USLGB", "Pearl River Express", "Shekou Long Beach", "NORTH STAR", "NS091E", "2026-07-21T21:00:00Z", "2026-08-03T09:00:00Z", 13, true, "Weekly / Tue", "SCT", "Pier T", 96, "NORMAL", 0, []],
  ["SBD", "CNSHA", "SGSIN", "Asia Shuttle", "Shanghai Singapore", "ASIA EXPRESS", "AX220S", "2026-07-16T16:00:00Z", "2026-07-22T06:00:00Z", 6, true, "Three weekly", "Yangshan", "Pasir Panjang", 93, "CUTOFF_SOON", 0, []],
  ["BWS", "SGSIN", "NLRTM", "Ocean Bridge", "Singapore Rotterdam", "OCEAN STAR", "OS420W", "2026-07-23T12:00:00Z", "2026-08-15T04:00:00Z", 23, true, "Weekly / Thu", "Pasir Panjang", "RWG", 90, "NORMAL", 0, []],
  ["PST", "CNXMN", "USLAX", "Pacific Vista", "Xiamen LA", "PACIFIC TRADER", "PT681E", "2026-07-19T21:00:00Z", "2026-08-05T13:00:00Z", 17, false, "Weekly / Sun", "XHICT", "West Basin", 78, "DELAYED", 18, ["CNYTN"]],
  ["SBD", "CNTAO", "DEHAM", "North Europe Link", "Qingdao Hamburg", "SEA VENTURE", "SV772W", "2026-07-21T11:00:00Z", "2026-08-24T09:00:00Z", 34, false, "Weekly / Tue", "QQCT", "CTA", 74, "NORMAL", 0, ["KRPUS", "NLRTM"]],
  ["GHN", "CNYTN", "USLAX", "South China Loop", "Yantian LA", "GLOBAL WIND", "GW881E", "2026-07-24T20:00:00Z", "2026-08-07T08:00:00Z", 14, true, "Weekly / Fri", "YICT", "TraPac", 88, "CANCELLED", 0, []],
  ["NSL", "CNNGB", "USLGB", "Ningbo West Coast", "Ningbo Long Beach", "NORTH HORIZON", "NH338E", "2026-07-22T19:00:00Z", "2026-08-05T07:00:00Z", 14, true, "Weekly / Wed", "Beilun", "Pier T", 92, "NORMAL", 0, []],
  ["PST", "CNSHA", "USLAX", "Pacific Arrow", "China US West Coast", "PACIFIC LIGHT", "PL228E", "2026-07-25T19:00:00Z", "2026-08-08T05:00:00Z", 14, true, "Weekly / Sat", "Yangshan", "West Basin", 87, "NORMAL", 0, []],
  ["BWS", "CNNGB", "NLRTM", "Eurasia Loop", "Asia Europe Mainline", "BLUE COMET", "BC902W", "2026-07-26T14:00:00Z", "2026-08-27T09:00:00Z", 32, false, "Weekly / Sun", "Beilun", "RWG", 85, "EXPECTED_DELAY", 6, ["SGSIN"]],
  ["GHN", "CNSHA", "DEHAM", "North Europe Bridge", "Shanghai Hamburg", "GLOBAL RIVER", "GR418W", "2026-07-27T18:00:00Z", "2026-08-29T11:00:00Z", 33, false, "Weekly / Mon", "Waigaoqiao", "CTA", 80, "NORMAL", 0, ["KRPUS", "NLRTM"]],
];

const containerRateFactors = { TWENTY_GP: 0.72, FORTY_GP: 1, FORTY_HC: 1.12, FORTY_FIVE_HC: 1.28 };
const rateGroups = [
  ["PST", "CNSHA", "USLAX", "Pacific Arrow", "PACIFIC BRIDGE", "PB193E", "2026-07-18T18:30:00Z", 14, true, 0, 94, "ACTIVE", "2026-07-01T00:00:00Z", "2026-08-15T23:59:59Z", 2780],
  ["OLK", "CNYTN", "USLGB", "ZEX Express", "EVER GLORY", "EG512E", "2026-07-17T22:00:00Z", 13, true, 0, 92, "ACTIVE", "2026-07-01T00:00:00Z", "2026-08-12T23:59:59Z", 2650],
  ["BWS", "CNNGB", "NLRTM", "Eurasia Loop", "BLUE HORIZON", "BH728W", "2026-07-19T15:00:00Z", 31, false, 1, 91, "ACTIVE", "2026-07-01T00:00:00Z", "2026-08-20T23:59:59Z", 3920],
  ["GHN", "CNSHA", "DEHAM", "North Europe Bridge", "GLOBAL DAWN", "GD306W", "2026-07-20T20:00:00Z", 32, false, 1, 86, "ACTIVE", "2026-07-01T00:00:00Z", "2026-07-19T23:59:59Z", 4080],
  ["SBD", "CNTAO", "USLAX", "North China West Coast", "SEA BRIDGE", "SB118E", "2026-07-18T23:00:00Z", 17, false, 1, 82, "ACTIVE", "2026-07-01T00:00:00Z", "2026-08-18T23:59:59Z", 3020],
  ["BWS", "SGSIN", "NLRTM", "Ocean Bridge", "OCEAN STAR", "OS420W", "2026-07-23T12:00:00Z", 23, true, 0, 90, "EXPIRED", "2026-06-01T00:00:00Z", "2026-07-10T23:59:59Z", 3440],
];

const date = (value) => new Date(value);
const addHours = (value, hours) => new Date(date(value).getTime() + hours * 60 * 60 * 1000);
const addDays = (value, days) => new Date(date(value).getTime() + days * 24 * 60 * 60 * 1000);
const money = (value) => Number(value.toFixed(2));

function seedPassword(envName) {
  const value = process.env[envName];
  if (value) return value;
  console.warn(envName + ' is not set. Generated a one-time seed password. Set this env var before relying on demo login.');
  return randomBytes(12).toString('base64url');
}

async function seedUsers() {
  const adminEmail = 'admin@oceanscope.local'.trim().toLowerCase();
  const customerEmail = 'customer@oceanscope.local'.trim().toLowerCase();
  const adminHash = await bcrypt.hash(seedPassword('SEED_ADMIN_PASSWORD'), 12);
  const customerHash = await bcrypt.hash(seedPassword('SEED_CUSTOMER_PASSWORD'), 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: 'OceanScope Admin', email: adminEmail, passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE' },
    create: { name: 'OceanScope Admin', email: adminEmail, passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE' },
  });
  const customer = await prisma.user.upsert({
    where: { email: customerEmail },
    update: { name: 'Demo Customer', email: customerEmail, passwordHash: customerHash, role: 'CUSTOMER', status: 'ACTIVE' },
    create: { name: 'Demo Customer', email: customerEmail, passwordHash: customerHash, role: 'CUSTOMER', status: 'ACTIVE' },
  });
  await prisma.bookingOrder.updateMany({ where: { userId: null }, data: { userId: customer.id } });
  return { admin, customer };
}

async function seedCore() {
  for (const port of ports) await prisma.port.upsert({ where: { locode: port.locode }, update: port, create: port });
  for (const carrier of carriers) await prisma.carrier.upsert({ where: { code: carrier.code }, update: carrier, create: carrier });
  for (const [name, serviceName, carrierCode, originCode, destinationCode, direct, averageTransitDays, transitCodes] of routes) {
    const carrier = await prisma.carrier.findUniqueOrThrow({ where: { code: String(carrierCode) } });
    const originPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(originCode) } });
    const destinationPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(destinationCode) } });
    const id = `${String(carrierCode).toLowerCase()}-${String(originCode).toLowerCase()}-${String(destinationCode).toLowerCase()}`;
    const route = await prisma.route.upsert({ where: { id }, update: { name: String(name), serviceName: String(serviceName), carrierId: carrier.id, originPortId: originPort.id, destinationPortId: destinationPort.id, direct: Boolean(direct), averageTransitDays: Number(averageTransitDays) }, create: { id, name: String(name), serviceName: String(serviceName), carrierId: carrier.id, originPortId: originPort.id, destinationPortId: destinationPort.id, direct: Boolean(direct), averageTransitDays: Number(averageTransitDays) } });
    await prisma.routeTransitPort.deleteMany({ where: { routeId: route.id } });
    for (const [index, locode] of transitCodes.entries()) {
      const port = await prisma.port.findUniqueOrThrow({ where: { locode: String(locode) } });
      await prisma.routeTransitPort.create({ data: { routeId: route.id, portId: port.id, sequence: index + 1 } });
    }
  }
}

async function seedSchedules() {
  for (const item of schedules) {
    const [carrierCode, originCode, destinationCode, serviceName, routeName, vesselName, voyageNumber, etd, eta, transitDays, direct, frequency, originTerminal, destinationTerminal, reliability, status, delayHours, transitCodes] = item;
    const carrier = await prisma.carrier.findUniqueOrThrow({ where: { code: String(carrierCode) } });
    const originPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(originCode) } });
    const destinationPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(destinationCode) } });
    const route = await prisma.route.findFirst({ where: { carrierId: carrier.id, originPortId: originPort.id, destinationPortId: destinationPort.id } });
    const etdDate = date(etd);
    const etaDate = date(eta);
    const schedule = await prisma.sailingSchedule.upsert({
      where: { carrierId_vesselName_voyageNumber_originPortId_destinationPortId_etd: { carrierId: carrier.id, vesselName: String(vesselName), voyageNumber: String(voyageNumber), originPortId: originPort.id, destinationPortId: destinationPort.id, etd: etdDate } },
      update: { routeId: route?.id, serviceName: String(serviceName), routeName: String(routeName), eta: etaDate, transitDays: Number(transitDays), direct: Boolean(direct), stopCount: transitCodes.length, frequency: String(frequency), originTerminal: String(originTerminal), destinationTerminal: String(destinationTerminal), cyOpenTime: addDays(etd, -5), siCutOffTime: addDays(etd, -2), vgmCutOffTime: addDays(etd, -1), customsCutOffTime: addDays(etd, -1), estimatedBerthingTime: addHours(etd, -8), departureReliability: Number(reliability), status: String(status), delayHours: Number(delayHours), originalEtd: Number(delayHours) ? addHours(etd, -Number(delayHours)) : null, originalEta: Number(delayHours) ? addHours(eta, -Number(delayHours)) : null, lastUpdatedAt: new Date() },
      create: { carrierId: carrier.id, routeId: route?.id, serviceName: String(serviceName), routeName: String(routeName), vesselName: String(vesselName), voyageNumber: String(voyageNumber), originPortId: originPort.id, destinationPortId: destinationPort.id, etd: etdDate, eta: etaDate, transitDays: Number(transitDays), direct: Boolean(direct), stopCount: transitCodes.length, frequency: String(frequency), originTerminal: String(originTerminal), destinationTerminal: String(destinationTerminal), cyOpenTime: addDays(etd, -5), siCutOffTime: addDays(etd, -2), vgmCutOffTime: addDays(etd, -1), customsCutOffTime: addDays(etd, -1), estimatedBerthingTime: addHours(etd, -8), departureReliability: Number(reliability), status: String(status), delayHours: Number(delayHours), originalEtd: Number(delayHours) ? addHours(etd, -Number(delayHours)) : null, originalEta: Number(delayHours) ? addHours(eta, -Number(delayHours)) : null, lastUpdatedAt: new Date() },
    });
    await prisma.scheduleTransitPort.deleteMany({ where: { scheduleId: schedule.id } });
    await prisma.scheduleRouteNode.deleteMany({ where: { scheduleId: schedule.id } });
    await prisma.scheduleRouteNode.create({ data: { scheduleId: schedule.id, portId: originPort.id, sequence: 1, nodeType: "ORIGIN", departureTime: etdDate, terminal: String(originTerminal) } });
    for (const [index, locode] of transitCodes.entries()) {
      const port = await prisma.port.findUniqueOrThrow({ where: { locode: String(locode) } });
      const arrival = addDays(etd, Math.max(2, Math.round(Number(transitDays) * ((index + 1) / (transitCodes.length + 1)))));
      const departure = addHours(arrival, 30 + index * 6);
      await prisma.scheduleTransitPort.create({ data: { scheduleId: schedule.id, portId: port.id, sequence: index + 1, arrivalTime: arrival, departureTime: departure, waitingHours: Math.round((departure.getTime() - arrival.getTime()) / 3600000), vesselName: String(vesselName), voyageNumber: String(voyageNumber), terminal: String(locode) } });
      await prisma.scheduleRouteNode.create({ data: { scheduleId: schedule.id, portId: port.id, sequence: index + 2, nodeType: "TRANSIT", arrivalTime: arrival, departureTime: departure, terminal: String(locode) } });
    }
    await prisma.scheduleRouteNode.create({ data: { scheduleId: schedule.id, portId: destinationPort.id, sequence: transitCodes.length + 2, nodeType: "DESTINATION", arrivalTime: etaDate, terminal: String(destinationTerminal) } });
  }
}

async function replaceRateItems(rateQuoteId, quote) {
  await prisma.rateLineItem.deleteMany({ where: { rateQuoteId } });
  const items = [["BASE", "OCEAN_FREIGHT", "Ocean Freight", "PER_CONTAINER", quote.baseFreight], ["SURCHARGE", "FUEL", "Fuel Surcharge", "PER_SHIPMENT", quote.fuelSurcharge], ["ORIGIN", "THC", "Terminal Handling Charge", "PER_CONTAINER", quote.terminalHandlingCharge], ["BASE", "DOC", "Documentation Fee", "PER_SHIPMENT", quote.documentationFee], ["BASE", "BOOKING", "Booking Fee", "PER_SHIPMENT", quote.bookingFee], ["SURCHARGE", "DG", "Dangerous Goods Surcharge", "PER_CONTAINER", quote.dangerousGoodsSurcharge], ["SURCHARGE", "OTHER", "Other Surcharge", "PER_SHIPMENT", quote.otherSurcharge]];
  await prisma.rateLineItem.createMany({ data: items.filter(([, , , , amount]) => amount > 0).map(([category, code, name, unit, unitPrice]) => ({ rateQuoteId, category, code, name, unit, unitPrice, currency: quote.currency, required: true })) });
}

async function seedRateQuotes() {
  for (const group of rateGroups) {
    const [carrierCode, originCode, destinationCode, serviceName, vesselName, voyageNumber, etd, transitDays, direct, stopCount, reliability, status, effectiveFrom, validUntil, basePrice] = group;
    const carrier = await prisma.carrier.findUniqueOrThrow({ where: { code: String(carrierCode) } });
    const originPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(originCode) } });
    const destinationPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(destinationCode) } });
    const route = await prisma.route.findFirst({ where: { carrierId: carrier.id, originPortId: originPort.id, destinationPortId: destinationPort.id } });
    for (const [containerType, factor] of Object.entries(containerRateFactors)) {
      const baseFreight = money(Number(basePrice) * Number(factor));
      const fuelSurcharge = money(baseFreight * 0.12);
      const terminalHandlingCharge = money(180 + Number(factor) * 45);
      const documentationFee = 85;
      const bookingFee = 65;
      const dangerousGoodsSurcharge = money(420 * Number(factor));
      const otherSurcharge = direct ? 35 : 95;
      const totalBasePrice = money(baseFreight + fuelSurcharge + terminalHandlingCharge + documentationFee + bookingFee + otherSurcharge);
      const quoteData = { carrierId: carrier.id, routeId: route?.id, originPortId: originPort.id, destinationPortId: destinationPort.id, serviceName: String(serviceName), transportMode: "FCL", containerType, currency: "USD", baseFreight, fuelSurcharge, terminalHandlingCharge, documentationFee, bookingFee, dangerousGoodsSurcharge, otherSurcharge, totalBasePrice, effectiveFrom: date(effectiveFrom), validUntil: date(validUntil), transitDays: Number(transitDays), direct: Boolean(direct), stopCount: Number(stopCount), vesselName: String(vesselName), voyageNumber: String(voyageNumber), etd: date(etd), eta: addDays(etd, Number(transitDays)), cutOffDate: addDays(etd, -2), freeDays: direct ? 7 : 10, reliability: Number(reliability), status: String(status) };
      const quote = await prisma.rateQuote.upsert({ where: { carrierId_originPortId_destinationPortId_serviceName_containerType_effectiveFrom_validUntil: { carrierId: carrier.id, originPortId: originPort.id, destinationPortId: destinationPort.id, serviceName: String(serviceName), containerType, effectiveFrom: quoteData.effectiveFrom, validUntil: quoteData.validUntil } }, update: quoteData, create: quoteData });
      await replaceRateItems(quote.id, quoteData);
    }
  }
}


async function seedBookingOrders(customerUserId) {
  const quotes = await prisma.rateQuote.findMany({ include: { lineItems: true, carrier: true, originPort: true, destinationPort: true, route: true }, orderBy: { createdAt: "asc" } });
  const usable = quotes.filter((quote) => quote.status === "ACTIVE").slice(0, 8);
  const statuses = ["PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "COMPLETED", "PENDING_CONFIRMATION", "CONFIRMED", "CANCELLED", "COMPLETED"];
  for (const [index, quote] of usable.entries()) {
    const bookingNumber = 'OCS-20260714-' + String(index + 1).padStart(4, '0');
    const quantity = (index % 2) + 1;
    const subtotal = money(Number(quote.totalBasePrice) * quantity + 85 + (index % 3) * 120);
    const tax = money(subtotal * 0.085);
    const total = money(subtotal + tax);
    const order = await prisma.bookingOrder.upsert({
      where: { bookingNumber },
      update: { userId: customerUserId, status: statuses[index], subtotal, tax, total, updatedAt: new Date() },
      create: { bookingNumber, status: statuses[index], userId: customerUserId, originPortId: quote.originPortId, destinationPortId: quote.destinationPortId, carrierId: quote.carrierId, routeId: quote.routeId, rateQuoteId: quote.id, serviceName: quote.serviceName, transportMode: quote.transportMode, cargoType: index % 3 === 0 ? 'dangerous' : 'general', readyDate: date('2026-07-14T00:00:00Z'), vesselName: quote.vesselName, voyageNumber: quote.voyageNumber, etd: quote.etd, eta: quote.eta, transitDays: quote.transitDays, stopCount: quote.stopCount, currency: quote.currency, subtotal, tax, total, quoteValidUntil: quote.validUntil, confirmedAt: statuses[index] === 'CONFIRMED' || statuses[index] === 'COMPLETED' ? new Date() : null, cancelledAt: statuses[index] === 'CANCELLED' ? new Date() : null },
    });
    await prisma.bookingContainer.deleteMany({ where: { orderId: order.id } });
    await prisma.bookingService.deleteMany({ where: { orderId: order.id } });
    await prisma.bookingCostItem.deleteMany({ where: { orderId: order.id } });
    await prisma.bookingTimeline.deleteMany({ where: { orderId: order.id } });
    await prisma.bookingContainer.create({ data: { orderId: order.id, containerType: quote.containerType, quantity, unitPrice: quote.totalBasePrice, subtotal: money(Number(quote.totalBasePrice) * quantity) } });
    await prisma.bookingService.createMany({ data: [
      { orderId: order.id, code: 'EXPORT_CUSTOMS', name: 'Export Customs Clearance', quantity: 1, unitPrice: 120, subtotal: 120 },
      ...(index % 2 === 0 ? [{ orderId: order.id, code: 'INSURANCE_BASIC', name: 'Insurance', quantity: 1, unitPrice: 260, subtotal: 260 }] : []),
    ] });
    await prisma.bookingCostItem.createMany({ data: [
      { orderId: order.id, category: 'Base', code: 'OCEAN_FREIGHT', name: 'Ocean Freight', quantity, unitPrice: quote.baseFreight, subtotal: money(Number(quote.baseFreight) * quantity), currency: quote.currency },
      { orderId: order.id, category: 'Surcharge', code: 'FUEL', name: 'Fuel Surcharge', quantity: 1, unitPrice: quote.fuelSurcharge, subtotal: quote.fuelSurcharge, currency: quote.currency },
      { orderId: order.id, category: 'Origin', code: 'EXPORT_CUSTOMS', name: 'Export Customs Clearance', quantity: 1, unitPrice: 120, subtotal: 120, currency: quote.currency },
      { orderId: order.id, category: 'Other', code: 'TAX_SNAPSHOT', name: 'Tax Snapshot', quantity: 1, unitPrice: tax, subtotal: tax, currency: quote.currency },
    ] });
    const now = new Date();
    await prisma.bookingTimeline.createMany({ data: [
      { orderId: order.id, status: 'PENDING_CONFIRMATION', title: 'Booking submitted', description: 'Seed booking was submitted.', occurredAt: now },
      { orderId: order.id, status: statuses[index], title: 'Current status: ' + statuses[index], description: 'Seed status snapshot.', occurredAt: now },
    ] });
  }
}

async function main() {
  const users = await seedUsers();
  await seedCore();
  await seedSchedules();
  await seedRateQuotes();
  await seedBookingOrders(users.customer.id);
}

main().then(async () => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
