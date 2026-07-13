import { Crosshair, Minus, Plus } from "lucide-react";

type MapControlsProps = {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

export function MapControls({ zoom, onZoomIn, onZoomOut }: MapControlsProps) {
  return (
    <div className="absolute right-4 top-4 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card">
      <button
        type="button"
        onClick={onZoomIn}
        className="flex h-10 w-10 items-center justify-center text-slate-700 transition hover:bg-ocean-50 hover:text-ocean-700 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
        aria-label="放大地图"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onZoomOut}
        className="flex h-10 w-10 items-center justify-center border-y border-slate-200 text-slate-700 transition hover:bg-ocean-50 hover:text-ocean-700 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
        aria-label="缩小地图"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center text-slate-700 transition hover:bg-ocean-50 hover:text-ocean-700 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
        aria-label="定位"
      >
        <Crosshair className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="border-t border-slate-200 px-2 py-1 text-center text-[11px] font-semibold text-slate-500">
        {zoom.toFixed(1)}x
      </div>
    </div>
  );
}
