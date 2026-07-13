export type AdminStatus = "启用" | "停用" | "维护中" | "待确认" | "已确认" | "已取消";
export type AdminFieldType = "text" | "number" | "select" | "date" | "datetime-local";
export type AdminCellValue = string | number;
export type AdminRecord = Record<string, AdminCellValue> & { id: string; status: AdminStatus; updatedAt?: string };
export type AdminColumn = { key: string; label: string; type?: "badge" | "money" };
export type AdminField = { key: string; label: string; type: AdminFieldType; required?: boolean; options?: string[]; min?: number; max?: number };
export type AdminResourceConfig = { title: string; description: string; addLabel: string; searchPlaceholder: string; categoryLabel: string; categoryKey: string; columns: AdminColumn[]; fields: AdminField[]; initialData: AdminRecord[] };
export type AdminMetric = { label: string; value: number; tone: "ocean" | "violet" | "emerald" | "amber" };
