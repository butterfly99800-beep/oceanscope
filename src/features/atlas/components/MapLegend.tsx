export function MapLegend() {
  return (
    <div className="absolute bottom-14 left-4 z-20 rounded-lg border border-white/70 bg-white/90 p-3 text-xs text-slate-700 shadow-card backdrop-blur">
      <div className="mb-2 font-semibold text-ink">图例</div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-ocean-600" />
          船舶
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-600" />
          选中船舶
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          港口
        </div>
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-ocean-400" />
          航线
        </div>
      </div>
    </div>
  );
}
