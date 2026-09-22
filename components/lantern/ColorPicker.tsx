"use client"

import { LANTERN_COLORS } from "@/lib/lantern/colors"
import type { LanternColor } from "@/lib/lantern/types"

type ColorPickerProps = {
  selectedId: string
  onSelect: (color: LanternColor) => void
  /** "ink" = dark selection ring (studio) · "night" = light ring (night sky) */
  tone?: "ink" | "night"
}

export default function ColorPicker({ selectedId, onSelect, tone = "ink" }: ColorPickerProps) {
  const night = tone === "night"
  return (
    /* single thin rail of dots, horizontally scrollable — stays below the
       lantern silhouette instead of covering it (the lantern is the hero) */
    <div className="flex max-w-[min(92vw,720px)] gap-x-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {LANTERN_COLORS.map((color) => {
        const isSelected = color.id === selectedId
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => onSelect(color)}
            aria-label={color.name}
            title={color.name}
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
              isSelected
                ? `outline outline-1 outline-offset-2 ${night ? "outline-[#E8E4DA]" : "outline-[#2A2622]"}`
                : "outline outline-1 outline-transparent"
            }`}
          >
            <span
              className={`block h-4 w-4 rounded-full transition-shadow duration-[400ms] ${
                night ? "border border-white/25" : "border border-black/10"
              }`}
              style={{
                backgroundColor: color.base,
                boxShadow: isSelected ? `0 0 12px ${color.glow}99` : "none",
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
