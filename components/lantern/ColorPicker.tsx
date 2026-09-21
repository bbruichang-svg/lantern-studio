"use client"

import { LANTERN_COLORS } from "@/lib/lantern/colors"
import type { LanternColor } from "@/lib/lantern/types"

type ColorPickerProps = {
  selectedId: string
  onSelect: (color: LanternColor) => void
}

export default function ColorPicker({ selectedId, onSelect }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-3">
      {LANTERN_COLORS.map((color) => {
        const isSelected = color.id === selectedId
        return (
          <button
            key={color.id}
            type="button"
            onClick={() => onSelect(color)}
            aria-label={color.name}
            title={color.name}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all duration-200 hover:scale-105 ${
              isSelected ? "outline outline-1 outline-offset-2 outline-[#E9E3D8]" : "outline outline-1 outline-transparent"
            }`}
          >
            <span
              className="block h-8 w-8 rounded-full transition-shadow duration-[400ms]"
              style={{
                backgroundColor: color.base,
                boxShadow: isSelected ? `0 0 14px ${color.glow}55` : "none",
              }}
            />
          </button>
        )
      })}
    </div>
  )
}
