import { prisma } from "@/lib/prisma";
import { searchCoscoCityOptions } from "@/features/cosco-scraper/server/cosco-schedule-scraper-api";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return Response.json({ data: [] });
  }

  try {
    let data = await searchCoscoCityOptions(q);
    if (!data.length) {
      const port = await prisma.port.findFirst({
        where: {
          OR: [
            { name: { contains: q } },
            { nameZh: { contains: q } },
            { locode: { contains: q.toUpperCase() } },
          ],
        },
      });
      if (port) {
        data = await searchCoscoCityOptions(port.name);
        if (!data.length) data = await searchCoscoCityOptions(port.locode);
      }
    }
    return Response.json({ data });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return Response.json({ error: { code: "COSCO_CITY_SEARCH_FAILED", message: "城市查询暂时不可用" } }, { status: 502 });
  }
}
