import Link from "next/link";
import { AdminStatCard } from "@/features/admin/components/AdminPrimitives";
import { carriers, fallbackOrders, ports, rates, routes, schedules } from "@/features/admin/data/mock-admin-data";

const quick = [["新增港口", "/admin/ports"], ["新增船公司", "/admin/carriers"], ["新增航线", "/admin/routes"], ["新增船期", "/admin/schedules"], ["新增运价", "/admin/rates"]] as const;

export function AdminDashboard() {
  return <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6"><AdminStatCard label="港口数量" value={ports.length} /><AdminStatCard label="船公司数量" value={carriers.length} /><AdminStatCard label="航线数量" value={routes.length} /><AdminStatCard label="船期数量" value={schedules.length} /><AdminStatCard label="运价方案数量" value={rates.length} /><AdminStatCard label="模拟订单数量" value={fallbackOrders.length} /></div><div className="grid gap-5 xl:grid-cols-3"><Card title="最近更新船期">{schedules.slice(0, 5).map((item) => <Row key={item.id} left={`${item.vesselName} ${item.voyageNumber}`} right={String(item.updatedAt)} />)}</Card><Card title="最近新增航线">{routes.slice(0, 5).map((item) => <Row key={item.id} left={String(item.name)} right={String(item.service)} />)}</Card><Card title="订单状态概览"><Row left="待确认" right="1" /><Row left="已确认" right="1" /><Row left="已取消" right="1" /></Card><Card title="数据更新状态"><Row left="港口数据" right="正常" /><Row left="船期数据" right="模拟" /><Row left="运价数据" right="模拟" /></Card><Card title="快捷操作"><div className="grid gap-2">{quick.map(([label, href]) => <Link key={href} href={href} className="admin-secondary justify-start">{label}</Link>)}</div></Card><Card title="最近操作记录"><Row left="更新船期 EVER GLORY" right="10:20" /><Row left="新增航线 Yantian → Long Beach" right="09:42" /><Row left="调整运价方案 ZEX" right="08:15" /></Card></div></div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-card"><h2 className="mb-4 font-semibold text-ink">{title}</h2><div className="space-y-3">{children}</div></section>; }
function Row({ left, right }: { left: string; right: string }) { return <div className="flex justify-between gap-3 border-b border-slate-100 pb-2 text-sm last:border-0"><span className="text-slate-600">{left}</span><b className="text-slate-800">{right}</b></div>; }
