import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { jsonList, parsePagination } from "@/features/admin/server/api-utils";
import { mapPortOption } from "@/features/schedules/server/schedule-mapper";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  const { page, pageSize, skip } = parsePagination(searchParams);
  const where: Prisma.PortWhereInput = q ? {
    OR: [
      { id: q },
      { name: q.length < 3 ? { startsWith: q } : { contains: q } },
      { nameZh: { contains: q } },
      ...(q.length >= 3 ? [{ locode: { contains: q.toUpperCase() } }] : []),
    ],
  } : {};
  const [ports, total] = await Promise.all([
    prisma.port.findMany({ where, skip, take: pageSize, orderBy: { name: "asc" } }),
    prisma.port.count({ where }),
  ]);
  return jsonList(ports.map(mapPortOption), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
}
