"use client";

import { Expand, Filter, Layers, RefreshCw, Search } from "lucide-react";
import { useRef } from "react";
import { AtlasSearchAutocomplete } from "@/features/atlas/components/AtlasSearchAutocomplete";
import { LayerMenu } from "@/features/atlas/components/LayerMenu";
import type { LayerVisibility, SearchSuggestion } from "@/features/atlas/types";

type AtlasToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  suggestions: SearchSuggestion[];
  isSuggestOpen: boolean;
  activeSuggestionIndex: number;
  onActiveSuggestionIndexChange: (index: number) => void;
  onSuggestionSelect: (suggestion: SearchSuggestion) => void;
  onSuggestionsClose: () => void;
  onSearchSubmit: () => void;
  layers: LayerVisibility;
  onLayerToggle: (layer: keyof LayerVisibility) => void;
  isLayerMenuOpen: boolean;
  onLayerMenuToggle: () => void;
  onLayerMenuClose: () => void;
  onRefresh: () => void;
  onToggleSidebar: () => void;
  dataTimestamp: string;
};

export function AtlasToolbar({
  query,
  onQueryChange,
  suggestions,
  isSuggestOpen,
  activeSuggestionIndex,
  onActiveSuggestionIndexChange,
  onSuggestionSelect,
  onSuggestionsClose,
  onSearchSubmit,
  layers,
  onLayerToggle,
  isLayerMenuOpen,
  onLayerMenuToggle,
  onLayerMenuClose,
  onRefresh,
  onToggleSidebar,
  dataTimestamp,
}: AtlasToolbarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const layerButtonRef = useRef<HTMLButtonElement | null>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      onActiveSuggestionIndexChange(Math.min(suggestions.length - 1, activeSuggestionIndex + 1));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      onActiveSuggestionIndexChange(Math.max(0, activeSuggestionIndex - 1));
    }

    if (event.key === "Enter") {
      event.preventDefault();
      onSearchSubmit();
    }

    if (event.key === "Escape") {
      onSuggestionsClose();
    }
  };

  return (
    <section className="relative z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto flex min-h-16 w-full max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 xl:flex-row xl:items-center lg:px-8">
        <div className="flex min-w-0 items-center justify-between gap-4 xl:w-72">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold text-ink">全球航运地图</h1>
              <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700 ring-1 ring-violet-100">模拟数据</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">更新于 {dataTimestamp}</p>
          </div>
          <button
            type="button"
            onClick={onToggleSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 transition hover:border-ocean-500 hover:text-ocean-700 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100 lg:hidden"
            aria-label="打开或关闭筛选面板"
          >
            <Filter className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">搜索</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onFocus={() => query.trim().length > 0 && onQueryChange(query)}
              onKeyDown={handleKeyDown}
              placeholder="搜索船名、MMSI、IMO、港口或航线"
              className="h-11 w-full rounded-md border border-slate-300 bg-slate-50 pl-10 pr-3 text-sm text-ink outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-ocean-500 focus:bg-white focus:ring-4 focus:ring-ocean-100"
              type="search"
            />
          </label>
          <button
            type="button"
            onClick={onSearchSubmit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-gradient-to-r from-ocean-500 to-violet-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            搜索
          </button>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            ref={layerButtonRef}
            type="button"
            onClick={onLayerMenuToggle}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-ocean-500 hover:text-ocean-700 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
            aria-expanded={isLayerMenuOpen}
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            图层
          </button>
          <button type="button" onClick={onToggleSidebar} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-ocean-500 hover:text-ocean-700 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
            <Filter className="h-4 w-4" aria-hidden="true" />
            筛选
          </button>
          <button type="button" onClick={onRefresh} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-ocean-500 hover:text-ocean-700 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            刷新
          </button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-ocean-500 hover:text-ocean-700 active:scale-[0.98] focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100">
            <Expand className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">全屏</span>
          </button>
        </div>
      </div>

      <LayerMenu anchorRef={layerButtonRef} isOpen={isLayerMenuOpen} layers={layers} onLayerToggle={onLayerToggle} onClose={onLayerMenuClose} />
      <AtlasSearchAutocomplete
        inputRef={inputRef}
        isOpen={isSuggestOpen}
        query={query}
        suggestions={suggestions}
        activeIndex={activeSuggestionIndex}
        onActiveIndexChange={onActiveSuggestionIndexChange}
        onSelect={onSuggestionSelect}
        onClose={onSuggestionsClose}
      />
    </section>
  );
}
