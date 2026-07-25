import { z } from "zod";
import { jsonData, handlePrismaError, validationError } from "@/features/admin/server/api-utils";
import { saveCoscoSchedules } from "@/features/cosco-scraper/server/save-cosco-schedules";
import { requireAdminForApi } from "@/lib/authorization";

export const runtime = "nodejs";

const scheduleSchema = z.object({
  id: z.string().min(1),
  carrierName: z.string().min(1),
  serviceName: z.string().nullable(),
  routeName: z.string().nullable(),
  vesselName: z.string().nullable(),
  voyageNumber: z.string().nullable(),
  originText: z.string().min(1),
  destinationText: z.string().min(1),
  originLocode: z.string().nullable(),
  destinationLocode: z.string().nullable(),
  etd: z.string().nullable(),
  eta: z.string().nullable(),
  transitDays: z.number().nullable(),
  direct: z.boolean().nullable(),
  stopCount: z.number().nullable(),
  transitPorts: z.array(z.string()),
  rawText: z.string(),
});

const commitSchema = z.object({
  mode: z.enum(["skipDuplicates", "updateDuplicates"]).default("skipDuplicates"),
  schedules: z.array(scheduleSchema).min(1).max(50),
});

export async function POST(request: Request) {
  const adminAuth = await requireAdminForApi();
  if (adminAuth.response) return adminAuth.response;
  const parsed = commitSchema.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  try {
    return jsonData(await saveCoscoSchedules(parsed.data.schedules, { mode: parsed.data.mode }));
  } catch (error) {
    return handlePrismaError(error);
  }
}
