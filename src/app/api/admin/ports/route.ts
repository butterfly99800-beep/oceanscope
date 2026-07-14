import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handlePrismaError, jsonData, jsonList, parsePagination, portSchema, statusToDb, statusToLabel, validationError } from "@/features/admin/server/api-utils";

const sortable = new Set(["name", "locode", "country", "region", "updatedAt", "createdAt"]);

function toPortRecord(port: Awaited<ReturnType<typeof prisma.port.findMany>>[number]) {
  return {
    id: port.id,
    name: port.name,
    nameZh: port.nameZh ?? "",
    locode: port.locode,
    country: port.country,
    countryCode: port.countryCode ?? "",
    region: port.region,
    latitude: port.latitude ?? "",
    longitude: port.longitude ?? "",
    status: statusToLabel(port.status),
    updatedAt: port.updatedAt.toISOString().slice(0, 10),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { page, pageSize, skip, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get("search")?.trim();
    const status = statusToDb(searchParams.get("status") ?? undefined);
    const country = searchParams.get("country")?.trim();
    const region = searchParams.get("region")?.trim();
    const sortBy = searchParams.get("sortBy") ?? "updatedAt";
    const where: Prisma.PortWhereInput = {
      ...(status ? { status } : {}),
      ...(country && country !== "全部" ? { country } : {}),
      ...(region && region !== "全部" ? { region } : {}),
      ...(search ? { OR: [
        { name: { contains: search } },
        { nameZh: { contains: search } },
        { locode: { contains: search.toUpperCase() } },
        { country: { contains: search } },
      ] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.port.findMany({ where, skip, take: pageSize, orderBy: { [sortable.has(sortBy) ? sortBy : "updatedAt"]: sortOrder } }),
      prisma.port.count({ where }),
    ]);
    return jsonList(items.map(toPortRecord), { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (error) {
    return handlePrismaError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = portSchema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const port = await prisma.port.create({ data: parsed.data });
    return jsonData(toPortRecord(port), { status: 201 });
  } catch (error) {
    return handlePrismaError(error);
  }
}


