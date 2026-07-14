import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ports = [
  ["Shanghai", "上海", "CNSHA", "China", "CN", "East Asia", 31.2304, 121.4737],
  ["Ningbo", "宁波", "CNNGB", "China", "CN", "East Asia", 29.8746, 121.5503],
  ["Yantian", "盐田", "CNYTN", "China", "CN", "East Asia", 22.58, 114.27],
  ["Shekou", "蛇口", "CNSHK", "China", "CN", "East Asia", 22.484, 113.913],
  ["Qingdao", "青岛", "CNTAO", "China", "CN", "East Asia", 36.0671, 120.3826],
  ["Xiamen", "厦门", "CNXMN", "China", "CN", "East Asia", 24.4798, 118.0894],
  ["Singapore", "新加坡", "SGSIN", "Singapore", "SG", "Southeast Asia", 1.3521, 103.8198],
  ["Los Angeles", "洛杉矶", "USLAX", "United States", "US", "North America West Coast", 34.0522, -118.2437],
  ["Long Beach", "长滩", "USLGB", "United States", "US", "North America West Coast", 33.7701, -118.1937],
  ["Rotterdam", "鹿特丹", "NLRTM", "Netherlands", "NL", "Europe", 51.9244, 4.4777],
  ["Hamburg", "汉堡", "DEHAM", "Germany", "DE", "Europe", 53.5511, 9.9937],
  ["Busan", "釜山", "KRPUS", "South Korea", "KR", "East Asia", 35.1796, 129.0756],
].map(([name, nameZh, locode, country, countryCode, region, latitude, longitude]) => ({ name: String(name), nameZh: String(nameZh), locode: String(locode), country: String(country), countryCode: String(countryCode), region: String(region), latitude: Number(latitude), longitude: Number(longitude) }));

const carriers = [
  ["OceanLink", "远链航运", "OLK", "Singapore"],
  ["Pacific Star", "太平洋星航", "PST", "United States"],
  ["BlueWave Shipping", "蓝浪航运", "BWS", "Netherlands"],
  ["Global Horizon", "环球地平线", "GHN", "Germany"],
  ["SeaBridge", "海桥航运", "SBD", "China"],
  ["NorthStar Lines", "北星航线", "NSL", "Canada"],
  ["Atlas Blue", "蓝图航运", "ABL", "Singapore"],
  ["HarborOne", "港壹航运", "HBO", "South Korea"],
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

const date = (value) => new Date(value);
const addHours = (value, hours) => new Date(date(value).getTime() + hours * 60 * 60 * 1000);
const addDays = (value, days) => new Date(date(value).getTime() + days * 24 * 60 * 60 * 1000);

async function main() {
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
      await prisma.scheduleTransitPort.create({ data: { scheduleId: schedule.id, portId: port.id, sequence: index + 1, arrivalTime: arrival, departureTime: departure, waitingHours: Math.round((departure.getTime() - arrival.getTime()) / 3600000), vesselName: String(vesselName), voyageNumber: String(voyageNumber), terminal: locode === "SGSIN" ? "Pasir Panjang" : locode === "KRPUS" ? "PNIT" : "RWG" } });
      await prisma.scheduleRouteNode.create({ data: { scheduleId: schedule.id, portId: port.id, sequence: index + 2, nodeType: "TRANSIT", arrivalTime: arrival, departureTime: departure, terminal: locode === "SGSIN" ? "Pasir Panjang" : locode === "KRPUS" ? "PNIT" : "RWG" } });
    }
    await prisma.scheduleRouteNode.create({ data: { scheduleId: schedule.id, portId: destinationPort.id, sequence: transitCodes.length + 2, nodeType: "DESTINATION", arrivalTime: etaDate, terminal: String(destinationTerminal) } });
  }
}

main().then(async () => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
