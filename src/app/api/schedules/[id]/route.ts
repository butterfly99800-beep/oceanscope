import { prisma } from "@/lib/prisma";
import { jsonData, jsonError } from "@/features/admin/server/api-utils";
import { mapSchedule, scheduleInclude } from "@/features/schedules/server/schedule-mapper";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const schedule = await prisma.sailingSchedule.findUnique({ where: { id }, include: scheduleInclude });
    if (!schedule) return jsonError("SCHEDULE_NOT_FOUND", "未找到船期", 404);
    return jsonData(mapSchedule(schedule));
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.error(error);
    return jsonError("DATABASE_ERROR", "船期详情读取失败", 500);
  }
}
