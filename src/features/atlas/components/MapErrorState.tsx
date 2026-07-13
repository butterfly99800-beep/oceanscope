import { AlertTriangle, RefreshCw } from "lucide-react";

type MapErrorStateProps = {
  onReload: () => void;
};

export function MapErrorState({ onReload }: MapErrorStateProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ocean-50 p-6">
      <div className="max-w-sm rounded-lg border border-slate-200 bg-white p-5 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-amber-50 text-amber-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-ink">地图加载失败</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">地图加载失败，请检查网络连接后重试。</p>
        <button
          type="button"
          onClick={onReload}
          className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          重新加载地图
        </button>
      </div>
    </div>
  );
}
