"use client";

import { Download, Eye, FileUp, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminEmptyState, AdminStatusBadge } from "@/features/admin/components/AdminPrimitives";
import type { AdminStatus } from "@/features/admin/types";

type DbValue = string | number | boolean | string[];
type DbRecord = { id: string; status: string; [key: string]: DbValue | undefined };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type Option = { label: string; value: string };
type Field = { key: string; label: string; type: "text" | "number" | "select" | "boolean" | "multi-select"; required?: boolean; options?: Option[]; min?: number; max?: number };
type Column = { key: string; label: string; type?: "badge" };
type ResourceKind = "ports" | "carriers" | "routes";
type ApiListResponse = { data: DbRecord[]; pagination: Pagination };
type ApiItemResponse = { data: DbRecord };
type ApiErrorResponse = { error: { code: string; message: string } };

type ResourceConfig = {
  title: string;
  description: string;
  addLabel: string;
  endpoint: string;
  searchPlaceholder: string;
  categoryLabel: string;
  categoryKey?: string;
  columns: Column[];
  fields: Field[];
};

const statusOptions: Option[] = [
  { label: "启用", value: "启用" },
  { label: "停用", value: "停用" },
];

function statusLabel(value: DbValue | undefined): AdminStatus {
  const label = text(value);
  return label === "停用" ? "停用" : "启用";
}

function text(value: DbValue | undefined) {
  if (Array.isArray(value)) return value.join(",");
  if (value === undefined) return "";
  return String(value);
}

function normalizeRecord(record: DbRecord, fields: Field[]) {
  const next: DbRecord = { ...record };
  fields.forEach((field) => {
    if (field.type === "multi-select" && !Array.isArray(next[field.key])) {
      next[field.key] = text(next[field.key]).split(",").map((item) => item.trim()).filter(Boolean);
    }
  });
  return next;
}

function buildConfig(kind: ResourceKind, carrierOptions: Option[], portOptions: Option[]): ResourceConfig {
  if (kind === "ports") return {
    title: "港口管理",
    description: "维护港口基础资料、UN/LOCODE、国家地区与经纬度。",
    addLabel: "新增港口",
    endpoint: "/api/admin/ports",
    searchPlaceholder: "搜索港口名称、中文名、代码或国家",
    categoryLabel: "国家筛选",
    categoryKey: "country",
    columns: [
      { key: "name", label: "港口名称" }, { key: "nameZh", label: "中文名称" }, { key: "locode", label: "UN/LOCODE" },
      { key: "country", label: "国家" }, { key: "region", label: "地区" }, { key: "latitude", label: "纬度" },
      { key: "longitude", label: "经度" }, { key: "status", label: "状态", type: "badge" }, { key: "updatedAt", label: "更新时间" },
    ],
    fields: [
      { key: "name", label: "港口名称", type: "text", required: true },
      { key: "nameZh", label: "中文名称", type: "text" },
      { key: "locode", label: "UN/LOCODE", type: "text", required: true },
      { key: "country", label: "国家", type: "text", required: true },
      { key: "countryCode", label: "国家代码", type: "text" },
      { key: "region", label: "地区", type: "text", required: true },
      { key: "latitude", label: "纬度", type: "number", min: -90, max: 90 },
      { key: "longitude", label: "经度", type: "number", min: -180, max: 180 },
      { key: "status", label: "状态", type: "select", options: statusOptions },
    ],
  };
  if (kind === "carriers") return {
    title: "船公司管理",
    description: "维护模拟船公司、公司代码、服务航线数量和状态。",
    addLabel: "新增船公司",
    endpoint: "/api/admin/carriers",
    searchPlaceholder: "搜索船公司名称、中文名、代码或国家",
    categoryLabel: "国家筛选",
    categoryKey: "country",
    columns: [
      { key: "name", label: "船公司名称" }, { key: "nameZh", label: "中文名称" }, { key: "code", label: "公司代码" },
      { key: "country", label: "国家" }, { key: "routeCount", label: "服务航线数量" }, { key: "scheduleCount", label: "船期数量" },
      { key: "status", label: "状态", type: "badge" }, { key: "updatedAt", label: "更新时间" },
    ],
    fields: [
      { key: "name", label: "船公司名称", type: "text", required: true },
      { key: "nameZh", label: "中文名称", type: "text" },
      { key: "code", label: "公司代码", type: "text", required: true },
      { key: "country", label: "国家", type: "text", required: true },
      { key: "status", label: "状态", type: "select", options: statusOptions },
    ],
  };
  return {
    title: "航线管理",
    description: "维护起运港、目的港、中转港、船公司 Service 与平均航程。",
    addLabel: "新增航线",
    endpoint: "/api/admin/routes",
    searchPlaceholder: "搜索航线、Service、船公司或港口代码",
    categoryLabel: "直达筛选",
    categoryKey: "direct",
    columns: [
      { key: "name", label: "航线名称" }, { key: "originPort", label: "起运港" }, { key: "destinationPort", label: "目的港" },
      { key: "transitPorts", label: "中转港" }, { key: "carrier", label: "船公司" }, { key: "serviceName", label: "Service" },
      { key: "direct", label: "直达或中转" }, { key: "averageTransitDays", label: "平均航程" }, { key: "status", label: "状态", type: "badge" },
      { key: "updatedAt", label: "更新时间" },
    ],
    fields: [
      { key: "name", label: "航线名称", type: "text", required: true },
      { key: "originPortId", label: "起运港", type: "select", required: true, options: portOptions },
      { key: "destinationPortId", label: "目的港", type: "select", required: true, options: portOptions },
      { key: "transitPortIds", label: "中转港", type: "multi-select", options: portOptions },
      { key: "carrierId", label: "船公司", type: "select", required: true, options: carrierOptions },
      { key: "serviceName", label: "Service 名称", type: "text", required: true },
      { key: "direct", label: "直达航线", type: "boolean" },
      { key: "averageTransitDays", label: "平均航程天数", type: "number", required: true, min: 1 },
      { key: "status", label: "状态", type: "select", options: statusOptions },
    ],
  };
}

async function parseResponse(response: Response) {
  const payload = await response.json() as ApiItemResponse | ApiListResponse | ApiErrorResponse;
  if (!response.ok) {
    return { ok: false as const, message: "error" in payload ? payload.error.message : "请求失败" };
  }
  return { ok: true as const, payload };
}

export function AdminDatabaseResourcePage({ resource }: { resource: ResourceKind }) {
  const [records, setRecords] = useState<DbRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 8, total: 0, totalPages: 1 });
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("全部");
  const [category, setCategory] = useState("全部");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [drawer, setDrawer] = useState<{ mode: "view" | "edit" | "create"; record: DbRecord } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DbRecord | null>(null);
  const [carrierOptions, setCarrierOptions] = useState<Option[]>([]);
  const [portOptions, setPortOptions] = useState<Option[]>([]);
  const config = useMemo(() => buildConfig(resource, carrierOptions, portOptions), [carrierOptions, portOptions, resource]);

  const categories = useMemo(() => Array.from(new Set(records.map((item) => text(config.categoryKey ? item[config.categoryKey] : undefined)).filter(Boolean))), [config.categoryKey, records]);

  const loadOptions = useCallback(async () => {
    if (resource !== "routes") return;
    const [portsResponse, carriersResponse] = await Promise.all([
      fetch("/api/admin/ports?pageSize=100"),
      fetch("/api/admin/carriers?pageSize=100"),
    ]);
    const portsPayload = await parseResponse(portsResponse);
    const carriersPayload = await parseResponse(carriersResponse);
    if (portsPayload.ok && "pagination" in portsPayload.payload) {
      setPortOptions(portsPayload.payload.data.map((item) => ({ value: item.id, label: `${text(item.name)} (${text(item.locode)})` })));
    }
    if (carriersPayload.ok && "pagination" in carriersPayload.payload) {
      setCarrierOptions(carriersPayload.payload.data.map((item) => ({ value: item.id, label: `${text(item.name)} (${text(item.code)})` })));
    }
  }, [resource]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: String(page), pageSize: "8" });
    if (query) params.set("search", query);
    if (status !== "全部") params.set("status", status);
    if (category !== "全部" && config.categoryKey) {
      if (resource === "routes") params.set("direct", category === "直达" ? "true" : "false");
      else params.set(config.categoryKey, category);
    }
    try {
      const response = await fetch(`${config.endpoint}?${params.toString()}`);
      const result = await parseResponse(response);
      if (!result.ok) {
        setError(result.message);
        setRecords([]);
      } else if ("pagination" in result.payload) {
        setRecords(result.payload.data);
        setPagination(result.payload.pagination);
      }
    } catch {
      setError("数据库接口暂不可用，请检查 DATABASE_URL 和服务状态");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [category, config.categoryKey, config.endpoint, page, query, resource, status]);

  useEffect(() => { void loadOptions(); }, [loadOptions]);
  useEffect(() => { void loadData(); }, [loadData]);

  const emptyRecord = (): DbRecord => {
    const record: DbRecord = { id: `new-${Date.now()}`, status: "启用" };
    config.fields.forEach((field) => {
      if (field.type === "number") record[field.key] = 0;
      else if (field.type === "boolean") record[field.key] = false;
      else if (field.type === "multi-select") record[field.key] = [];
      else record[field.key] = field.options?.[0]?.value ?? "";
    });
    return record;
  };

  const saveRecord = async (record: DbRecord) => {
    setNotice("");
    const payload: Record<string, DbValue | undefined> = {};
    config.fields.forEach((field) => {
      payload[field.key] = record[field.key];
    });
    const endpoint = drawer?.mode === "create" ? config.endpoint : `${config.endpoint}/${record.id}`;
    const method = drawer?.mode === "create" ? "POST" : "PUT";
    const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await parseResponse(response);
    if (!result.ok) {
      setNotice(result.message);
      return;
    }
    setDrawer(null);
    setNotice("保存成功，数据已写入数据库");
    await loadData();
    await loadOptions();
  };

  const removeRecord = async () => {
    if (!deleteTarget) return;
    const response = await fetch(`${config.endpoint}/${deleteTarget.id}`, { method: "DELETE" });
    const result = await parseResponse(response);
    if (!result.ok) {
      setNotice(result.message);
      setDeleteTarget(null);
      return;
    }
    setDeleteTarget(null);
    setNotice("删除成功");
    await loadData();
    await loadOptions();
  };

  return <div className="space-y-5"><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-semibold text-ink">{config.title}</h2><p className="mt-1 text-sm text-slate-500">{config.description}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => setDrawer({ mode: "create", record: emptyRecord() })} className="admin-primary"><Plus className="h-4 w-4" />{config.addLabel}</button><button className="admin-secondary"><FileUp className="h-4 w-4" />导入</button><button className="admin-secondary"><Download className="h-4 w-4" />导出</button></div></div><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_160px_180px_auto]"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={config.searchPlaceholder} className="admin-input" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="admin-input"><option>全部</option><option>启用</option><option>停用</option></select><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="admin-input"><option>全部</option>{(resource === "routes" ? ["直达", "中转"] : categories).map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => { setQuery(""); setStatus("全部"); setCategory("全部"); setPage(1); }} className="admin-secondary"><RotateCcw className="h-4 w-4" />重置筛选</button></div>{notice ? <div className="mt-4 rounded-md bg-ocean-50 px-3 py-2 text-sm text-ocean-700">{notice}</div> : null}</section><section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">{loading ? <div className="p-8 text-sm text-slate-500">正在加载数据库数据...</div> : error ? <div className="p-8"><p className="text-sm text-rose-700">{error}</p><button onClick={() => void loadData()} className="admin-primary mt-4">重试</button></div> : records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{config.columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}<th className="px-4 py-3">操作</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-100 hover:bg-ocean-50/40">{config.columns.map((column) => <td key={column.key} className="px-4 py-3 text-slate-700">{column.type === "badge" ? <AdminStatusBadge status={statusLabel(record.status)} /> : text(record[column.key]) || "-"}</td>)}<td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => setDrawer({ mode: "view", record: normalizeRecord(record, config.fields) })} className="admin-icon"><Eye className="h-4 w-4" /></button><button onClick={() => setDrawer({ mode: "edit", record: normalizeRecord(record, config.fields) })} className="admin-icon"><Pencil className="h-4 w-4" /></button><button onClick={() => setDeleteTarget(record)} className="admin-icon text-rose-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div> : <AdminEmptyState title="暂无数据库记录" description="请先运行 Prisma seed，或点击新增创建第一条记录。" />}</section><div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><span>共 {pagination.total} 条 · 第 {pagination.page}/{pagination.totalPages} 页</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="admin-page">上一页</button><button disabled={page === pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="admin-page">下一页</button></div></div>{drawer ? <DbFormDrawer config={config} mode={drawer.mode} record={drawer.record} onClose={() => setDrawer(null)} onSave={saveRecord} /> : null}{deleteTarget ? <ConfirmDialog title="确认删除" message={`确定删除 ${text(deleteTarget.name) || deleteTarget.id} 吗？数据库将同步删除。`} onCancel={() => setDeleteTarget(null)} onConfirm={removeRecord} /> : null}</div>;
}

function DbFormDrawer({ config, mode, record, onClose, onSave }: { config: ResourceConfig; mode: "view" | "edit" | "create"; record: DbRecord; onClose: () => void; onSave: (record: DbRecord) => void }) {
  const [form, setForm] = useState<DbRecord>(record);
  const [error, setError] = useState("");
  const readonly = mode === "view";
  const submit = () => {
    const required = config.fields.find((field) => field.required && !text(form[field.key]));
    if (required) { setError(`${required.label}必填`); return; }
    const invalid = config.fields.find((field) => field.type === "number" && ((field.min !== undefined && Number(form[field.key]) < field.min) || (field.max !== undefined && Number(form[field.key]) > field.max)));
    if (invalid) { setError(`${invalid.label}范围不正确`); return; }
    onSave(form);
  };
  return <div className="fixed inset-0 z-[2200] bg-ink/40"><aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-semibold text-ink">{mode === "create" ? config.addLabel : mode === "edit" ? "编辑记录" : "查看详情"}</h3><p className="mt-1 text-sm text-slate-500">数据通过后台 API 写入 PostgreSQL。</p></div><button onClick={onClose} className="admin-icon"><X className="h-4 w-4" /></button></header><div className="space-y-4 p-5">{error ? <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}{config.fields.map((field) => <label key={field.key} className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{field.label}</span>{field.type === "select" ? <select disabled={readonly} value={text(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="admin-input"><option value="">请选择</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "boolean" ? <select disabled={readonly} value={form[field.key] ? "true" : "false"} onChange={(event) => setForm({ ...form, [field.key]: event.target.value === "true" })} className="admin-input"><option value="true">直达</option><option value="false">中转</option></select> : field.type === "multi-select" ? <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 p-2">{field.options?.map((option) => { const values = Array.isArray(form[field.key]) ? form[field.key] as string[] : []; const checked = values.includes(option.value); return <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"><input disabled={readonly} type="checkbox" checked={checked} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked ? [...values, option.value] : values.filter((value) => value !== option.value) })} />{option.label}</label>; })}</div> : <input disabled={readonly} type={field.type} value={text(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })} className="admin-input" />}</label>)}</div><footer className="flex justify-end gap-2 border-t border-slate-200 p-5"><button onClick={onClose} className="admin-secondary">关闭</button>{!readonly ? <button onClick={submit} className="admin-primary">保存</button> : null}</footer></aside></div>;
}

function ConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) { return <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-ink/45 p-4"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-ink">{title}</h3><p className="mt-2 text-sm text-slate-600">{message}</p><div className="mt-5 flex justify-end gap-2"><button onClick={onCancel} className="admin-secondary">取消</button><button onClick={onConfirm} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">删除</button></div></div></div>; }


