import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

export type SortOrder = "asc" | "desc";
export type ApiErrorCode =
  | "BAD_REQUEST"
  | "PORT_NOT_FOUND"
  | "CARRIER_NOT_FOUND"
  | "ROUTE_NOT_FOUND"
  | "SCHEDULE_NOT_FOUND"
  | "RATE_NOT_FOUND"
  | "ORDER_NOT_FOUND"
  | "CONFLICT"
  | "DELETE_BLOCKED"
  | "DATABASE_ERROR"
  | "UNKNOWN_ERROR";

export function jsonData<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function jsonList<T>(data: T[], pagination: { page: number; pageSize: number; total: number; totalPages: number }) {
  return NextResponse.json({ data, pagination });
}

export function jsonError(code: ApiErrorCode, message: string, status = 400) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20) || 20));
  const sortOrder: SortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  return { page, pageSize, skip: (page - 1) * pageSize, sortOrder };
}

export function statusToDb(status?: string) {
  if (!status || status === "全部") return undefined;
  if (status === "启用" || status === "ACTIVE") return "ACTIVE" as const;
  if (status === "停用" || status === "INACTIVE") return "INACTIVE" as const;
  return undefined;
}

export function statusToLabel(status: "ACTIVE" | "INACTIVE") {
  return status === "ACTIVE" ? "启用" : "停用";
}

export function handlePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return jsonError("CONFLICT", "唯一字段已存在，请检查代码或名称", 409);
    if (error.code === "P2003") return jsonError("CONFLICT", "关联数据不存在或仍被引用", 409);
    if (error.code === "P2025") return jsonError("BAD_REQUEST", "请求的数据不存在", 404);
  }

  if (process.env.NODE_ENV !== "production") {
    console.error(error);
  }
  return jsonError("UNKNOWN_ERROR", "服务端处理失败，请稍后重试", 500);
}

const optionalCoordinate = (min: number, max: number) => z.preprocess((value) => value === "" || value === null || value === undefined ? undefined : value, z.coerce.number().min(min).max(max).optional());

export const portSchema = z.object({
  name: z.string().trim().min(1, "港口名称必填"),
  nameZh: z.string().trim().optional().or(z.literal("")),
  locode: z.string().trim().min(1, "港口代码必填").transform((value) => value.toUpperCase()),
  country: z.string().trim().min(1, "国家必填"),
  countryCode: z.string().trim().optional().or(z.literal("")),
  region: z.string().trim().min(1, "地区必填"),
  latitude: optionalCoordinate(-90, 90),
  longitude: optionalCoordinate(-180, 180),
  status: z.string().optional().transform((value) => statusToDb(value) ?? "ACTIVE"),
});

export const carrierSchema = z.object({
  name: z.string().trim().min(1, "船公司名称必填"),
  nameZh: z.string().trim().optional().or(z.literal("")),
  code: z.string().trim().min(1, "公司代码必填").transform((value) => value.toUpperCase()),
  country: z.string().trim().min(1, "国家必填"),
  status: z.string().optional().transform((value) => statusToDb(value) ?? "ACTIVE"),
});

export const routeSchema = z.object({
  name: z.string().trim().min(1, "航线名称必填"),
  serviceName: z.string().trim().min(1, "Service 必填"),
  carrierId: z.string().trim().min(1, "船公司必填"),
  originPortId: z.string().trim().min(1, "起运港必填"),
  destinationPortId: z.string().trim().min(1, "目的港必填"),
  direct: z.coerce.boolean().default(false),
  averageTransitDays: z.coerce.number().int().positive("平均航程必须为正数"),
  status: z.string().optional().transform((value) => statusToDb(value) ?? "ACTIVE"),
  transitPortIds: z.array(z.string().trim().min(1)).default([]),
}).superRefine((value, context) => {
  if (value.originPortId === value.destinationPortId) {
    context.addIssue({ code: "custom", message: "起运港和目的港不能相同", path: ["destinationPortId"] });
  }
  const seen = new Set<string>();
  value.transitPortIds.forEach((portId, index) => {
    if (portId === value.originPortId || portId === value.destinationPortId) {
      context.addIssue({ code: "custom", message: "中转港不能与起运港或目的港重复", path: ["transitPortIds", index] });
    }
    if (seen.has(portId)) {
      context.addIssue({ code: "custom", message: "中转港不能重复", path: ["transitPortIds", index] });
    }
    seen.add(portId);
  });
});

export function validationError(error: z.ZodError) {
  return jsonError("BAD_REQUEST", error.issues[0]?.message ?? "参数格式错误", 400);
}



