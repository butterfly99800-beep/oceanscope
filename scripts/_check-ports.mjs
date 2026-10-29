import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const ports = await prisma.port.findMany({
  where: { OR: [ { name: { contains: "Shanghai" } }, { name: { contains: "Los Angeles" } }, { locode: { in: ["CNSGH", "CNSHA", "USLAX", "USLSA"] } } ] },
  select: { id: true, name: true, locode: true, country: true },
  orderBy: { locode: "asc" },
});
console.log("命中行数:", ports.length);
for (const p of ports) console.log(`${p.locode} | id=${p.id} | ${p.name} | ${p.country}`);
console.log("--- 是否存在 CNSHA 或 USLSA ---");
console.log("CNSHA:", ports.filter((p) => p.locode === "CNSHA").length, "| CNSGH:", ports.filter((p) => p.locode === "CNSGH").length, "| USLSA:", ports.filter((p) => p.locode === "USLSA").length, "| USLAX:", ports.filter((p) => p.locode === "USLAX").length);
await prisma.$disconnect();
