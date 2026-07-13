import { Loader2 } from "lucide-react";

export function MapLoadingState() {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ocean-50/80 backdrop-blur-sm">
      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink shadow-card">
        <Loader2 className="h-4 w-4 animate-spin text-ocean-700" aria-hidden="true" />
        地图正在加载……
      </div>
    </div>
  );
}
