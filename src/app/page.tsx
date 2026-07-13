import Link from "next/link";
import { ArrowRight, BarChart3, Globe2, Route } from "lucide-react";
import { PageContainer } from "@/components/layout/PageContainer";
import { FeatureCard } from "@/components/ui/FeatureCard";

const features = [
  {
    title: "全球船舶动态",
    description: "以清晰的可视化方式承载船舶位置、航线状态和关键节点信息。",
    icon: Globe2,
  },
  {
    title: "智能船期查询",
    description: "为起运港、目的港和出发时间建立统一的船期查询入口。",
    icon: Route,
  },
  {
    title: "运费方案对比",
    description: "预留面向运输方案、箱型、货物属性和报价比较的标准化体验。",
    icon: BarChart3,
  },
];

export default function HomePage() {
  return (
    <PageContainer className="py-10 sm:py-14 lg:py-16">
      <section className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-6 shadow-card sm:p-10 lg:p-12">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_60%_35%,rgba(53,104,255,0.28),transparent_34%),linear-gradient(135deg,rgba(8,17,31,0.03),rgba(109,93,252,0.12))] lg:block" />
        <div className="relative max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-ocean-700">
            OceanScope Logistics Platform
          </p>
          <h1 className="text-4xl font-semibold tracking-normal text-ink sm:text-5xl lg:text-6xl">
            让全球航运变得清晰可见
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            查询全球船舶动态、船期航线与运输方案
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/atlas"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
            >
              探索航运地图
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/schedules"
              className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-ink transition hover:border-ocean-500 hover:text-ocean-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
            >
              查询运输方案
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-3">
        {features.map((feature) => (
          <FeatureCard
            key={feature.title}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
          />
        ))}
      </section>
    </PageContainer>
  );
}
