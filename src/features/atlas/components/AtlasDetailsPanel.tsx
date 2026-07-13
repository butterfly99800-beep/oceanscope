"use client";

import { PortDetailsPanel } from "@/features/atlas/components/PortDetailsPanel";
import { RouteDetailsPanel } from "@/features/atlas/components/RouteDetailsPanel";
import { VesselDetailsPanel } from "@/features/atlas/components/VesselDetailsPanel";
import type { Port, RouteOption, SelectedMapEntity, Vessel } from "@/features/atlas/types";

export function AtlasDetailsPanel({ entity, vessels, ports, routeOptions, isOpen, onClose }: { entity: SelectedMapEntity; vessels: Vessel[]; ports: Port[]; routeOptions: RouteOption[]; isOpen: boolean; onClose: () => void }) {
  if (!isOpen || !entity) {
    return null;
  }

  const className = "fixed inset-y-20 right-4 z-40 flex w-[min(380px,calc(100vw-32px))] flex-col rounded-lg border border-slate-200 bg-white shadow-card lg:relative lg:inset-auto lg:z-auto lg:w-[360px] xl:w-[380px]";

  if (entity.type === "vessel") {
    const vessel = vessels.find((item) => item.id === entity.id);
    return vessel ? <aside className={className}><VesselDetailsPanel vessel={vessel} onClose={onClose} /></aside> : null;
  }

  if (entity.type === "port") {
    const port = ports.find((item) => item.id === entity.id);
    return port ? <aside className={className}><PortDetailsPanel port={port} onClose={onClose} /></aside> : null;
  }

  const option = routeOptions.find((item) => item.id === entity.id);
  return option ? <aside className={className}><RouteDetailsPanel option={option} ports={ports} onClose={onClose} /></aside> : null;
}
