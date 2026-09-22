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
    <div className="grid max-w-[340px] grid-cols-7 gap-x-2 gap-y-2.5 sm:max-w-[400px] sm:grid-cols-9">
      {LANTERN_COLORS.map((color) => {
        const isSelected = color.id === selectedId
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => onSelect(color)}
            aria-label={color.name}
            title={color.name}
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
              isSelected
                ? `outline outline-1 outline-offset-2 ${night ? "outline-[#E8E4DA]" : "outline-[#2A2622]"}`
                : "outline outline-1 outline-transparent"
            }`}
          >
            <span
              className={`block h-7 w-7 rounded-full transition-shadow duration-[400ms] ${
                night ? "border border-white/20" : "border border-black/10"
              }`}
              style={{
                backgroundColor: color.base,
                boxShadow: isSelected ? `0 0 14px ${color.glow}88` : "none",
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
