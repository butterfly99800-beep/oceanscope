import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { carrierSchema, handlePrismaError, jsonData, jsonList, parsePagination, statusToDb, statusToLabel, validationError } from "@/features/admin/server/api-utils";

const sortable = new Set(["name", "code", "country", "updatedAt", "createdAt"]);

function toCarrierRecord(carrier: Awaited<ReturnType<typeof prisma.carrier.findMany>>[number] & { _count?: { routes: number } }) {
  return {
    id: carrier.id,
    name: carrier.name,
    nameZh: carrier.nameZh ?? "",
    code: carrier.code,
    country: carrier.country,
    routeCount: carrier._count?.routes ?? 0,
    scheduleCount: 0,
    status: statusToLabel(carrier.status),
    updatedAt: carrier.updatedAt.toISOString().slice(0, 10),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = statusToDb(searchParams.get("status") ?? undefined);
    const country = searchParams.get("country")?.trim();
    const sortBy = searchParams.get("sortBy") ?? "updatedAt";
    const where: Prisma.CarrierWhereInput = {
      ...(status ? { status } : {}),
      ...(country && country !== "全部" ? { country } : {}),
      ...(search ? { OR: [
        { name: { contains: search } },
        { nameZh: { contains: search } },
        { code: { contains: search.toUpperCase() } },
        { country: { contains: search } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.carrier.findMany({ where, skip, take: pageSize, include: { _count: { select: { routes: true } } }, orderBy: { [sortable.has(sortBy) ? sortBy : "updatedAt"]: sortOrder } }),
      prisma.carrier.count({ where }),
    ]);
    return jsonList(items.map(toCarrierRecord), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = carrierSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const carrier = await prisma.carrier.create({ data: parsed.data });
    return jsonData(toCarrierRecord(carrier), { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}

