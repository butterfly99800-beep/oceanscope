"use client";

import { Download, Eye, FileUp, Pencil, Plus, RotateCcw, Ship, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminEmptyState, AdminStatusBadge } from "@/features/admin/components/AdminPrimitives";
import { CoscoScheduleTestDrawer } from "@/features/admin/components/CoscoScheduleTestDrawer";
import type { AdminStatus } from "@/features/admin/types";

type DbValue = string | number | boolean | string[];
type DbRecord = { id: string; status: string; [key: string]: DbValue | undefined };
type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type Option = { label: string; value: string };
type Field = { key: string; label: string; type: "text" | "number" | "select" | "boolean" | "multi-select" | "datetime-local"; required?: boolean; options?: Option[]; min?: number; max?: number };
type Column = { key: string; label: string; type?: "badge" };
type ResourceKind = "ports" | "carriers" | "routes" | "schedules" | "rates";
type ApiListResponse = { data: DbRecord[]; pagination: Pagination };
type ApiItemResponse = { data: DbRecord };
type ApiErrorResponse = { error: { code: string; message: string } };

type ResourceConfig = { title: string; description: string; addLabel: string; endpoint: string; searchPlaceholder: string; categoryKey?: string; columns: Column[]; fields: Field[] };

const statusOptions: Option[] = [{ label: "Active", value: "启用" }, { label: "Inactive", value: "停用" }, { label: "Expired", value: "已过期" }];
const scheduleStatusOptions: Option[] = [{ label: "Normal", value: "正常" }, { label: "Expected Delay", value: "预计延误" }, { label: "Delayed", value: "已延误" }, { label: "Cutoff Soon", value: "即将截关" }, { label: "Cancelled", value: "已取消" }];

function text(value: DbValue | undefined) {
  if (Array.isArray(value)) return value.join(",");
  if (value === undefined) return "";
  return String(value);
}

function statusLabel(value: DbValue | undefined): AdminStatus {
  const label = text(value);
  if (["停用", "维护中", "待确认", "已确认", "已取消", "正常", "预计延误", "已延误", "即将截关", "已过期"].includes(label)) return label as AdminStatus;
  return "启用";
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

function buildConfig(kind: ResourceKind, carrierOptions: Option[], portOptions: Option[], routeOptions: Option[]): ResourceConfig {
  const relationFields = {
    carrierId: { key: "carrierId", label: "Carrier", type: "select" as const, required: true, options: carrierOptions },
    routeId: { key: "routeId", label: "Route", type: "select" as const, options: routeOptions },
    originPortId: { key: "originPortId", label: "Origin Port", type: "select" as const, required: true, options: portOptions },
    destinationPortId: { key: "destinationPortId", label: "Destination Port", type: "select" as const, required: true, options: portOptions },
  };
  if (kind === "ports") return {
    title: "Port Management", description: "Manage ports, LOCODE, country, region and coordinates.", addLabel: "New Port", endpoint: "/api/admin/ports", searchPlaceholder: "Search port name, code or country", categoryKey: "country",
    columns: [{ key: "name", label: "Name" }, { key: "nameZh", label: "Chinese Name" }, { key: "locode", label: "LOCODE" }, { key: "country", label: "Country" }, { key: "region", label: "Region" }, { key: "latitude", label: "Lat" }, { key: "longitude", label: "Lng" }, { key: "status", label: "Status", type: "badge" }, { key: "updatedAt", label: "Updated" }],
    fields: [{ key: "name", label: "Name", type: "text", required: true }, { key: "nameZh", label: "Chinese Name", type: "text" }, { key: "locode", label: "LOCODE", type: "text", required: true }, { key: "country", label: "Country", type: "text", required: true }, { key: "countryCode", label: "Country Code", type: "text" }, { key: "region", label: "Region", type: "text", required: true }, { key: "latitude", label: "Latitude", type: "number", min: -90, max: 90 }, { key: "longitude", label: "Longitude", type: "number", min: -180, max: 180 }, { key: "status", label: "Status", type: "select", options: statusOptions }],
  };
  if (kind === "carriers") return {
    title: "Carrier Management", description: "Manage simulated carriers and service status.", addLabel: "New Carrier", endpoint: "/api/admin/carriers", searchPlaceholder: "Search carrier name, code or country", categoryKey: "country",
    columns: [{ key: "name", label: "Name" }, { key: "nameZh", label: "Chinese Name" }, { key: "code", label: "Code" }, { key: "country", label: "Country" }, { key: "routeCount", label: "Routes" }, { key: "scheduleCount", label: "Schedules" }, { key: "status", label: "Status", type: "badge" }, { key: "updatedAt", label: "Updated" }],
    fields: [{ key: "name", label: "Name", type: "text", required: true }, { key: "nameZh", label: "Chinese Name", type: "text" }, { key: "code", label: "Code", type: "text", required: true }, { key: "country", label: "Country", type: "text", required: true }, { key: "status", label: "Status", type: "select", options: statusOptions }],
  };
  if (kind === "routes") return {
    title: "Route Management", description: "Manage origin, destination, transit ports and services.", addLabel: "New Route", endpoint: "/api/admin/routes", searchPlaceholder: "Search route, service, carrier or port", categoryKey: "direct",
    columns: [{ key: "name", label: "Name" }, { key: "originPort", label: "Origin" }, { key: "destinationPort", label: "Destination" }, { key: "transitPorts", label: "Transit" }, { key: "carrier", label: "Carrier" }, { key: "serviceName", label: "Service" }, { key: "direct", label: "Direct" }, { key: "averageTransitDays", label: "Days" }, { key: "status", label: "Status", type: "badge" }, { key: "updatedAt", label: "Updated" }],
    fields: [{ key: "name", label: "Name", type: "text", required: true }, relationFields.originPortId, relationFields.destinationPortId, { key: "transitPortIds", label: "Transit Ports", type: "multi-select", options: portOptions }, relationFields.carrierId, { key: "serviceName", label: "Service", type: "text", required: true }, { key: "direct", label: "Direct", type: "boolean" }, { key: "averageTransitDays", label: "Average Days", type: "number", required: true, min: 1 }, { key: "status", label: "Status", type: "select", options: statusOptions }],
  };
  if (kind === "schedules") return {
    title: "Schedule Management", description: "Manage sailing schedules, vessels, ETD/ETA and milestones.", addLabel: "New Schedule", endpoint: "/api/admin/schedules", searchPlaceholder: "Search vessel, voyage, service or route", categoryKey: "source",
    columns: [{ key: "carrier", label: "Carrier" }, { key: "serviceName", label: "Service" }, { key: "vesselName", label: "Vessel" }, { key: "voyageNumber", label: "Voyage" }, { key: "originPort", label: "Origin" }, { key: "destinationPort", label: "Destination" }, { key: "etd", label: "ETD" }, { key: "eta", label: "ETA" }, { key: "transitPorts", label: "Transit" }, { key: "transitDays", label: "Days" }, { key: "status", label: "Status", type: "badge" }, { key: "source", label: "Source" }, { key: "updatedAt", label: "Updated" }],
    fields: [relationFields.carrierId, relationFields.routeId, { key: "serviceName", label: "Service", type: "text", required: true }, { key: "routeName", label: "Route Name", type: "text", required: true }, { key: "vesselName", label: "Vessel", type: "text", required: true }, { key: "voyageNumber", label: "Voyage", type: "text", required: true }, relationFields.originPortId, relationFields.destinationPortId, { key: "transitPortIds", label: "Transit Ports", type: "multi-select", options: portOptions }, { key: "etd", label: "ETD", type: "datetime-local", required: true }, { key: "eta", label: "ETA", type: "datetime-local", required: true }, { key: "transitDays", label: "Transit Days", type: "number", required: true, min: 1 }, { key: "direct", label: "Direct", type: "boolean" }, { key: "frequency", label: "Frequency", type: "text", required: true }, { key: "originTerminal", label: "Origin Terminal", type: "text", required: true }, { key: "destinationTerminal", label: "Destination Terminal", type: "text", required: true }, { key: "cyOpenTime", label: "CY Open", type: "datetime-local", required: true }, { key: "siCutOffTime", label: "SI Cutoff", type: "datetime-local", required: true }, { key: "vgmCutOffTime", label: "VGM Cutoff", type: "datetime-local", required: true }, { key: "customsCutOffTime", label: "Customs Cutoff", type: "datetime-local", required: true }, { key: "estimatedBerthingTime", label: "Berthing", type: "datetime-local", required: true }, { key: "departureReliability", label: "Reliability", type: "number", required: true, min: 0, max: 100 }, { key: "status", label: "Status", type: "select", options: scheduleStatusOptions }, { key: "delayHours", label: "Delay Hours", type: "number", min: 0 }],
  };
  return {
    title: "Rate Management", description: "Manage rate quotes, container types, fees and validity.", addLabel: "New Rate", endpoint: "/api/admin/rates", searchPlaceholder: "Search carrier, service, port, vessel or voyage", categoryKey: "containerType",
    columns: [{ key: "carrier", label: "Carrier" }, { key: "serviceName", label: "Service" }, { key: "origin", label: "Origin" }, { key: "destination", label: "Destination" }, { key: "containerType", label: "Container" }, { key: "baseFreight", label: "Base" }, { key: "totalBasePrice", label: "Total" }, { key: "currency", label: "Currency" }, { key: "effectiveFrom", label: "Effective" }, { key: "validUntil", label: "Valid Until" }, { key: "status", label: "Status", type: "badge" }],
    fields: [relationFields.carrierId, relationFields.routeId, relationFields.originPortId, relationFields.destinationPortId, { key: "serviceName", label: "Service", type: "text", required: true }, { key: "transportMode", label: "Mode", type: "select", options: [{ label: "FCL", value: "FCL" }, { label: "LCL", value: "LCL" }, { label: "AIR", value: "AIR" }] }, { key: "containerType", label: "Container", type: "select", required: true, options: [{ label: "20GP", value: "TWENTY_GP" }, { label: "40GP", value: "FORTY_GP" }, { label: "40HC", value: "FORTY_HC" }, { label: "45HC", value: "FORTY_FIVE_HC" }] }, { key: "currency", label: "Currency", type: "text", required: true }, { key: "baseFreight", label: "Base Freight", type: "number", required: true, min: 0 }, { key: "fuelSurcharge", label: "Fuel", type: "number", required: true, min: 0 }, { key: "terminalHandlingCharge", label: "THC", type: "number", required: true, min: 0 }, { key: "documentationFee", label: "Documentation", type: "number", required: true, min: 0 }, { key: "bookingFee", label: "Booking", type: "number", required: true, min: 0 }, { key: "dangerousGoodsSurcharge", label: "DG Surcharge", type: "number", min: 0 }, { key: "otherSurcharge", label: "Other", type: "number", min: 0 }, { key: "totalBasePrice", label: "Total Base", type: "number", required: true, min: 0 }, { key: "effectiveFrom", label: "Effective From", type: "datetime-local", required: true }, { key: "validUntil", label: "Valid Until", type: "datetime-local", required: true }, { key: "transitDays", label: "Transit Days", type: "number", required: true, min: 1 }, { key: "direct", label: "Direct", type: "boolean" }, { key: "stopCount", label: "Stops", type: "number", min: 0 }, { key: "vesselName", label: "Vessel", type: "text", required: true }, { key: "voyageNumber", label: "Voyage", type: "text", required: true }, { key: "etd", label: "ETD", type: "datetime-local", required: true }, { key: "eta", label: "ETA", type: "datetime-local", required: true }, { key: "cutOffDate", label: "Cutoff", type: "datetime-local", required: true }, { key: "freeDays", label: "Free Days", type: "number", min: 0 }, { key: "reliability", label: "Reliability", type: "number", required: true, min: 0, max: 100 }, { key: "status", label: "Status", type: "select", options: statusOptions }],
  };
}

async function parseResponse(response: Response) {
  const payload = await response.json() as ApiItemResponse | ApiListResponse | ApiErrorResponse;
  if (!response.ok) return { ok: false as const, message: "error" in payload ? payload.error.message : "Request failed" };
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
  const [coscoDrawerOpen, setCoscoDrawerOpen] = useState(false);
  const [carrierOptions, setCarrierOptions] = useState<Option[]>([]);
  const [portOptions, setPortOptions] = useState<Option[]>([]);
  const [routeOptions, setRouteOptions] = useState<Option[]>([]);
  const config = useMemo(() => buildConfig(resource, carrierOptions, portOptions, routeOptions), [carrierOptions, portOptions, resource, routeOptions]);
  const categories = useMemo(() => resource === "schedules" ? ["SEED", "MANUAL", "COSCO_LIVE_QUERY", "OOCL_LIVE_QUERY", "CMA_LIVE_QUERY"] : Array.from(new Set(records.map((item) => text(config.categoryKey ? item[config.categoryKey] : undefined)).filter(Boolean))), [config.categoryKey, records, resource]);

  const loadOptions = useCallback(async () => {
    if (!["routes", "schedules", "rates"].includes(resource)) return;
    const [portsResponse, carriersResponse, routesResponse] = await Promise.all([fetch("/api/admin/ports?pageSize=100"), fetch("/api/admin/carriers?pageSize=100"), fetch("/api/admin/routes?pageSize=100")]);
    const [portsPayload, carriersPayload, routesPayload] = await Promise.all([parseResponse(portsResponse), parseResponse(carriersResponse), parseResponse(routesResponse)]);
    if (portsPayload.ok && "pagination" in portsPayload.payload) setPortOptions(portsPayload.payload.data.map((item) => ({ value: item.id, label: `${text(item.name)} (${text(item.locode)})` })));
    if (carriersPayload.ok && "pagination" in carriersPayload.payload) setCarrierOptions(carriersPayload.payload.data.map((item) => ({ value: item.id, label: `${text(item.name)} (${text(item.code)})` })));
    if (routesPayload.ok && "pagination" in routesPayload.payload) setRouteOptions(routesPayload.payload.data.map((item) => ({ value: item.id, label: `${text(item.name)} / ${text(item.serviceName)}` })));
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
      const result = await parseResponse(await fetch(`${config.endpoint}?${params.toString()}`));
      if (!result.ok) { setError(result.message); setRecords([]); }
      else if ("pagination" in result.payload) { setRecords(result.payload.data); setPagination(result.payload.pagination); }
    } catch { setError("Database API is unavailable. Check DATABASE_URL and server status."); setRecords([]); }
    finally { setLoading(false); }
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
    config.fields.forEach((field) => { payload[field.key] = record[field.key]; });
    const endpoint = drawer?.mode === "create" ? config.endpoint : `${config.endpoint}/${record.id}`;
    const response = await fetch(endpoint, { method: drawer?.mode === "create" ? "POST" : "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await parseResponse(response);
    if (!result.ok) { setNotice(result.message); return; }
    setDrawer(null);
    setNotice("Saved to MySQL.");
    await loadData();
    await loadOptions();
  };

  const removeRecord = async () => {
    if (!deleteTarget) return;
    const result = await parseResponse(await fetch(`${config.endpoint}/${deleteTarget.id}`, { method: "DELETE" }));
    if (!result.ok) { setNotice(result.message); setDeleteTarget(null); return; }
    setDeleteTarget(null);
    setNotice("Deleted.");
    await loadData();
    await loadOptions();
  };

  return <div className="space-y-5"><section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="text-2xl font-semibold text-ink">{config.title}</h2><p className="mt-1 text-sm text-slate-500">{config.description}</p></div><div className="flex flex-wrap gap-2">{resource === "schedules" ? <button onClick={() => setCoscoDrawerOpen(true)} className="admin-secondary"><Ship className="h-4 w-4" />COSCO 实时船期查询</button> : null}<button onClick={() => setDrawer({ mode: "create", record: emptyRecord() })} className="admin-primary"><Plus className="h-4 w-4" />{config.addLabel}</button><button className="admin-secondary"><FileUp className="h-4 w-4" />Import</button><button className="admin-secondary"><Download className="h-4 w-4" />Export</button></div></div><div className="mt-5 grid gap-3 lg:grid-cols-[1fr_160px_180px_auto]"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={config.searchPlaceholder} className="admin-input" /><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="admin-input"><option>全部</option><option>启用</option><option>停用</option><option>已过期</option></select><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className="admin-input"><option>全部</option>{(resource === "routes" ? ["直达", "中转"] : categories).map((item) => <option key={item}>{item}</option>)}</select><button onClick={() => { setQuery(""); setStatus("全部"); setCategory("全部"); setPage(1); }} className="admin-secondary"><RotateCcw className="h-4 w-4" />Reset</button></div>{notice ? <div className="mt-4 rounded-md bg-ocean-50 px-3 py-2 text-sm text-ocean-700">{notice}</div> : null}</section><section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">{loading ? <div className="p-8 text-sm text-slate-500">Loading database records...</div> : error ? <div className="p-8"><p className="text-sm text-rose-700">{error}</p><button onClick={() => void loadData()} className="admin-primary mt-4">Retry</button></div> : records.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{config.columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}<th className="px-4 py-3">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-100 hover:bg-ocean-50/40">{config.columns.map((column) => <td key={column.key} className="px-4 py-3 text-slate-700">{column.type === "badge" ? <AdminStatusBadge status={statusLabel(record.status)} /> : text(record[column.key]) || "-"}</td>)}<td className="px-4 py-3"><div className="flex gap-2"><button onClick={() => setDrawer({ mode: "view", record: normalizeRecord(record, config.fields) })} className="admin-icon"><Eye className="h-4 w-4" /></button><button onClick={() => setDrawer({ mode: "edit", record: normalizeRecord(record, config.fields) })} className="admin-icon"><Pencil className="h-4 w-4" /></button><button onClick={() => setDeleteTarget(record)} className="admin-icon text-rose-600"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div> : <AdminEmptyState title="No records" description="Run Prisma seed or create a record." />}</section><div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500"><span>Total {pagination.total} / Page {pagination.page} of {pagination.totalPages}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="admin-page">Previous</button><button disabled={page === pagination.totalPages} onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} className="admin-page">Next</button></div></div>{drawer ? <DbFormDrawer config={config} mode={drawer.mode} record={drawer.record} onClose={() => setDrawer(null)} onSave={saveRecord} /> : null}{deleteTarget ? <ConfirmDialog title="Confirm delete" message={`Delete ${text(deleteTarget.name) || deleteTarget.id}?`} onCancel={() => setDeleteTarget(null)} onConfirm={removeRecord} /> : null}{resource === "schedules" ? <CoscoScheduleTestDrawer open={coscoDrawerOpen} onClose={() => setCoscoDrawerOpen(false)} onCommitted={() => void loadData()} /> : null}</div>;
}

function DbFormDrawer({ config, mode, record, onClose, onSave }: { config: ResourceConfig; mode: "view" | "edit" | "create"; record: DbRecord; onClose: () => void; onSave: (record: DbRecord) => void }) {
  const [form, setForm] = useState<DbRecord>(record);
  const [error, setError] = useState("");
  const readonly = mode === "view";
  const submit = () => {
    const required = config.fields.find((field) => field.required && !text(form[field.key]));
    if (required) { setError(`${required.label} is required`); return; }
    const invalid = config.fields.find((field) => field.type === "number" && ((field.min !== undefined && Number(form[field.key]) < field.min) || (field.max !== undefined && Number(form[field.key]) > field.max)));
    if (invalid) { setError(`${invalid.label} is out of range`); return; }
    onSave(form);
  };
  return <div className="fixed inset-0 z-[2200] bg-ink/40"><aside className="ml-auto h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-5"><div><h3 className="text-xl font-semibold text-ink">{mode === "create" ? config.addLabel : mode === "edit" ? "Edit Record" : "Record Detail"}</h3><p className="mt-1 text-sm text-slate-500">Data is written through the admin API into MySQL.</p></div><button onClick={onClose} className="admin-icon"><X className="h-4 w-4" /></button></header><div className="space-y-4 p-5">{error ? <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}{config.fields.map((field) => <label key={field.key} className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{field.label}</span>{field.type === "select" ? <select disabled={readonly} value={text(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} className="admin-input"><option value="">Select</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === "boolean" ? <select disabled={readonly} value={form[field.key] ? "true" : "false"} onChange={(event) => setForm({ ...form, [field.key]: event.target.value === "true" })} className="admin-input"><option value="true">Direct</option><option value="false">Transshipment</option></select> : field.type === "multi-select" ? <div className="max-h-44 overflow-y-auto rounded-md border border-slate-200 p-2">{field.options?.map((option) => { const values = Array.isArray(form[field.key]) ? form[field.key] as string[] : []; const checked = values.includes(option.value); return <label key={option.value} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"><input disabled={readonly} type="checkbox" checked={checked} onChange={(event) => setForm({ ...form, [field.key]: event.target.checked ? [...values, option.value] : values.filter((value) => value !== option.value) })} />{option.label}</label>; })}</div> : <input disabled={readonly} type={field.type} value={text(form[field.key])} onChange={(event) => setForm({ ...form, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })} className="admin-input" />}</label>)}</div><footer className="flex justify-end gap-2 border-t border-slate-200 p-5"><button onClick={onClose} className="admin-secondary">Close</button>{!readonly ? <button onClick={submit} className="admin-primary">Save</button> : null}</footer></aside></div>;
}

function ConfirmDialog({ title, message, onCancel, onConfirm }: { title: string; message: string; onCancel: () => void; onConfirm: () => void }) {
  return <div className="fixed inset-0 z-[2300] flex items-center justify-center bg-ink/45 p-4"><div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl"><h3 className="text-lg font-semibold text-ink">{title}</h3><p className="mt-2 text-sm text-slate-600">{message}</p><div className="mt-5 flex justify-end gap-2"><button onClick={onCancel} className="admin-secondary">Cancel</button><button onClick={onConfirm} className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Delete</button></div></div></div>;
}



