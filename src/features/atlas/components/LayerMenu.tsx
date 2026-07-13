"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LayerVisibility } from "@/features/atlas/types";

type LayerMenuProps = {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  layers: LayerVisibility;
  onLayerToggle: (layer: keyof LayerVisibility) => void;
  onClose: () => void;
};

const layerLabels: Array<{ key: keyof LayerVisibility; label: string }> = [
  { key: "vessels", label: "船舶" },
  { key: "ports", label: "港口" },
  { key: "routes", label: "航线" },
];

export function LayerMenu({ anchorRef, isOpen, layers, onLayerToggle, onClose }: LayerMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 200 });

  useLayoutEffect(() => {
    if (!isOpen || !anchorRef.current) {
      return;
    }

    const rect = anchorRef.current.getBoundingClientRect();
    const width = 200;
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width));
    setPosition({ top: rect.bottom + 8, left, width });
  }, [anchorRef, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || anchorRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [anchorRef, isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      className="fixed rounded-lg border border-slate-200 bg-white p-2 shadow-2xl"
      style={{ top: position.top, left: position.left, width: position.width, zIndex: 2000 }}
      role="menu"
    >
      {layerLabels.map((layer) => (
        <button
          key={layer.key}
          type="button"
          onClick={() => onLayerToggle(layer.key)}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-ocean-50 focus:outline-none focus-visible:ring-4 focus-visible:ring-ocean-100"
        >
          <span>{layer.label}</span>
          <span className={`relative h-5 w-9 rounded-full transition ${layers[layer.key] ? "bg-violet-600" : "bg-slate-300"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${layers[layer.key] ? "left-4" : "left-0.5"}`} />
          </span>
        </button>
      ))}
    </div>,
    document.body,
  );
}
