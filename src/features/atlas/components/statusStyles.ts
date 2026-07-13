import type { VesselStatus } from "@/features/atlas/types";

export function getStatusClassName(status: VesselStatus) {
  switch (status) {
    case "航行中":
      return "bg-emerald-50 text-emerald-700 ring-emerald-200";
    case "锚泊中":
      return "bg-amber-50 text-amber-700 ring-amber-200";
    case "靠港中":
      return "bg-sky-50 text-sky-700 ring-sky-200";
  }
}
