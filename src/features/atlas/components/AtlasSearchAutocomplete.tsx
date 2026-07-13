"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SearchSuggestionItem } from "@/features/atlas/components/SearchSuggestionItem";
import type { SearchSuggestion } from "@/features/atlas/types";

type AtlasSearchAutocompleteProps = {
  inputRef: React.RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  query: string;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClose: () => void;
};

const groupLabels: Record<SearchSuggestion["type"], string> = {
  vessel: "船舶",
  port: "港口",
  route: "航线",
  region: "地区",
};

export function AtlasSearchAutocomplete({
  inputRef,
  isOpen,
  query,
  suggestions,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  onClose,
}: AtlasSearchAutocompleteProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 420 });

  const grouped = useMemo(() => {
    let absoluteIndex = 0;
    return (["vessel", "port", "route", "region"] as SearchSuggestion["type"][]).map((type) => {
      const items = suggestions
        .map((suggestion, index) => ({ suggestion, index }))
        .filter((item) => item.suggestion.type === type)
        .map((item) => {
          absoluteIndex = Math.max(absoluteIndex, item.index + 1);
          return item;
        });
      return { type, items };
    });
  }, [suggestions]);

  useLayoutEffect(() => {
    if (!isOpen || !inputRef.current) {
      return;
    }

    const rect = inputRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(window.innerWidth - width - viewportPadding, Math.max(viewportPadding, rect.left));
    setPosition({ top: rect.bottom + 8, left, width });
  }, [inputRef, isOpen, query, suggestions.length]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || inputRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [inputRef, isOpen, onClose]);

  useEffect(() => {
    if (activeIndex >= suggestions.length) {
      onActiveIndexChange(Math.max(0, suggestions.length - 1));
    }
  }, [activeIndex, onActiveIndexChange, suggestions.length]);

  if (!isOpen || query.trim().length === 0) {
    return null;
  }

  return createPortal(
    <div
      ref={panelRef}
      className="fixed max-h-[420px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-2xl"
      style={{ top: position.top, left: position.left, width: position.width, zIndex: 1900 }}
      role="listbox"
    >
      {suggestions.length === 0 ? (
        <div className="px-4 py-5 text-sm text-slate-500">未找到匹配的船舶、港口或航线</div>
      ) : (
        grouped.map((group) =>
          group.items.length > 0 ? (
            <div key={group.type} className="border-b border-slate-100 last:border-b-0">
              <div className="bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {groupLabels[group.type]}
              </div>
              {group.items.map(({ suggestion, index }) => (
                <SearchSuggestionItem
                  key={suggestion.id}
                  suggestion={suggestion}
                  isActive={activeIndex === index}
                  onSelect={onSelect}
                />
              ))}
            </div>
          ) : null,
        )
      )}
    </div>,
    document.body,
  );
}
