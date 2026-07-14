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
].map(([name, nameZh, locode, country, countryCode, region, latitude, longitude]) => ({
  name: String(name),
  nameZh: String(nameZh),
  locode: String(locode),
  country: String(country),
  countryCode: String(countryCode),
  region: String(region),
  latitude: Number(latitude),
  longitude: Number(longitude),
}));

const carriers = [
  ["OceanLink", "远链航运", "OLK", "Singapore"],
  ["Pacific Star", "太平洋星航", "PST", "United States"],
  ["BlueWave Shipping", "蓝浪航运", "BWS", "Netherlands"],
  ["Global Horizon", "环球地平线", "GHN", "Germany"],
  ["SeaBridge", "海桥航运", "SBD", "China"],
  ["NorthStar Lines", "北星航线", "NSL", "Canada"],
  ["Atlas Blue", "蓝图航运", "ABL", "Singapore"],
  ["HarborOne", "港壹航运", "HBO", "South Korea"],
].map(([name, nameZh, code, country]) => ({ name, nameZh, code, country }));

const routes = [
  ["Yantian to Long Beach", "ZEX Express", "OLK", "CNYTN", "USLGB", true, 13, []],
  ["Shanghai to Los Angeles", "Pacific Arrow", "PST", "CNSHA", "USLAX", true, 14, []],
  ["Ningbo to Rotterdam", "Eurasia Loop", "BWS", "CNNGB", "NLRTM", false, 31, ["SGSIN"]],
  ["Qingdao to Hamburg", "North Europe Link", "GHN", "CNTAO", "DEHAM", false, 34, ["KRPUS", "SGSIN"]],
  ["Shanghai to Singapore", "Asia Shuttle", "SBD", "CNSHA", "SGSIN", true, 7, []],
  ["Singapore to Rotterdam", "Ocean Bridge", "BWS", "SGSIN", "NLRTM", true, 22, []],
  ["Xiamen to Los Angeles", "Pacific Vista", "NSL", "CNXMN", "USLAX", false, 18, ["KRPUS"]],
  ["Shekou to Long Beach", "Pearl River Express", "ABL", "CNSHK", "USLGB", true, 15, []],
  ["Ningbo to Hamburg", "Rhine Connect", "GHN", "CNNGB", "DEHAM", false, 32, ["SGSIN"]],
  ["Busan to Los Angeles", "Korea Pacific", "HBO", "KRPUS", "USLAX", true, 12, []],
];

async function main() {
  for (const port of ports) {
    await prisma.port.upsert({
      where: { locode: port.locode },
      update: port,
      create: port,
    });
  }

  for (const carrier of carriers) {
    await prisma.carrier.upsert({
      where: { code: carrier.code },
      update: carrier,
      create: carrier,
    });
  }

  for (const [name, serviceName, carrierCode, originCode, destinationCode, direct, averageTransitDays, transitCodes] of routes) {
    const carrier = await prisma.carrier.findUniqueOrThrow({ where: { code: String(carrierCode) } });
    const originPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(originCode) } });
    const destinationPort = await prisma.port.findUniqueOrThrow({ where: { locode: String(destinationCode) } });
    const route = await prisma.route.upsert({
      where: { id: `${String(carrierCode).toLowerCase()}-${String(originCode).toLowerCase()}-${String(destinationCode).toLowerCase()}` },
      update: {
        name: String(name),
        serviceName: String(serviceName),
        carrierId: carrier.id,
        originPortId: originPort.id,
        destinationPortId: destinationPort.id,
        direct: Boolean(direct),
        averageTransitDays: Number(averageTransitDays),
      },
      create: {
        id: `${String(carrierCode).toLowerCase()}-${String(originCode).toLowerCase()}-${String(destinationCode).toLowerCase()}`,
        name: String(name),
        serviceName: String(serviceName),
        carrierId: carrier.id,
        originPortId: originPort.id,
        destinationPortId: destinationPort.id,
        direct: Boolean(direct),
        averageTransitDays: Number(averageTransitDays),
      },
    });

    await prisma.routeTransitPort.deleteMany({ where: { routeId: route.id } });
    for (const [index, locode] of transitCodes.entries()) {
      const port = await prisma.port.findUniqueOrThrow({ where: { locode: String(locode) } });
      await prisma.routeTransitPort.create({
        data: { routeId: route.id, portId: port.id, sequence: index + 1 },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

