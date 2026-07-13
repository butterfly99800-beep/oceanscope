import { Anchor, Globe2, MapPin, Route, Ship } from "lucide-react";
import type { SearchSuggestion } from "@/features/atlas/types";

const icons = {
  vessel: Ship,
  port: Anchor,
  route: Route,
  region: Globe2,
};

export function SearchSuggestionItem({
  suggestion,
  isActive,
  onSelect,
}: {
  suggestion: SearchSuggestion;
  isActive: boolean;
  onSelect: (suggestion: SearchSuggestion) => void;
}) {
  const Icon = icons[suggestion.type] ?? MapPin;

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onSelect(suggestion)}
      className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition ${
        isActive ? "bg-ocean-50" : "hover:bg-slate-50"
      }`}
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ocean-100 text-ocean-700">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{suggestion.title}</span>
        <span className="mt-0.5 block truncate text-xs text-slate-500">{suggestion.subtitle}</span>
        <span className="mt-1 block truncate text-xs font-medium text-slate-600">{suggestion.meta}</span>
      </span>
    </button>
  );
}
