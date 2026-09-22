"use client"

import { ALL_FACES, getColorById } from "@/lib/lantern/colors"
import type { FacePreset } from "@/lib/lantern/types"

type FacePickerProps = {
  selectedId: string | null
  onSelect: (face: FacePreset) => void
  /** "ink" = dark selection ring (studio) · "night" = light ring (night sky) */
  tone?: "ink" | "night"
}

export default function FacePicker({ selectedId, onSelect, tone = "ink" }: FacePickerProps) {
  const night = tone === "night"
  return (
    <div className="grid max-w-[420px] grid-cols-7 gap-x-2 gap-y-2.5">
      {ALL_FACES.map((face) => {
        const isSelected = face.id === selectedId
        return (
          <button
            key={face.id}
            type="button"
            onClick={() => onSelect(face)}
            aria-label={face.name}
            title={face.name}
            className={`flex items-center justify-center rounded-xl p-1 transition-all duration-200 ${
              night
                ? isSelected
                  ? "bg-white/10 outline outline-1 outline-[#E8E4DA]"
                  : "outline outline-1 outline-transparent hover:bg-white/5"
                : isSelected
                  ? "bg-black/5 outline outline-1 outline-[#2A2622]"
                  : "outline outline-1 outline-transparent hover:bg-black/5"
            }`}
          >
            {/* disc backing in the city colour so light-ink designs stay visible */}
            <span
              className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full ${
                night ? "border border-white/20" : "border border-black/10"
              }`}
              style={{ backgroundColor: getColorById(face.colorId).base }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={face.src}
                alt=""
                draggable={false}
                className="h-11 w-11 select-none"
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}
