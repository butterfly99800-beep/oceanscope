import Link from "next/link";

export function OrderEmptyState() {
  return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center"><h2 className="text-lg font-semibold text-ink">暂无模拟订单</h2><p className="mt-2 text-sm text-slate-500">提交模拟预订后，订单会保存在本地浏览器。</p><Link href="/rates" className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white">前往查询运价</Link></div>;
}
