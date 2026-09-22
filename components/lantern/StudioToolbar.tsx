"use client"

import type { ReactNode } from "react"
import ColorPicker from "./ColorPicker"
import FacePicker from "./FacePicker"
import type { FacePreset, StudioMode } from "@/lib/lantern/types"

type StudioToolbarProps = {
  mode: StudioMode | null
  onModeChange: (mode: StudioMode | null) => void
  selectedColorId: string
  onColorSelect: (colorId: string) => void
  selectedFace: FacePreset | null
  onFaceSelect: (face: FacePreset | null) => void
  /** "ink" = dark text for bright backgrounds (studio) · "night" = light text for dark scenes */
  tone?: "ink" | "night"
  /** optional primary action rendered under the mode tabs (e.g. the MVP 点亮 button) */
  action?: ReactNode
}

export default function StudioToolbar({
  mode,
  onModeChange,
  selectedColorId,
  onColorSelect,
  selectedFace,
  onFaceSelect,
  tone = "ink",
  action,
}: StudioToolbarProps) {
  const night = tone === "night"
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-3 sm:pb-4">
      {/* expanding panel — intentionally cardless and compact: one thin
          strip hugging the bottom edge so the lantern silhouette stays clear */}
      <div
        className={`pointer-events-auto mb-2.5 origin-bottom px-4 py-2 transition-all duration-200 ${
          mode !== null ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className={mode === "color" ? "block" : "hidden"}>
          <ColorPicker
            tone={tone}
            selectedId={selectedColorId}
            onSelect={(c) => onColorSelect(c.id)}
          />
        </div>
        <div className={mode === "face" ? "block" : "hidden"}>
          <FacePicker tone={tone} selectedId={selectedFace?.id ?? null} onSelect={onFaceSelect} />
        </div>
      </div>

      {/* mode tabs — small, quiet, unobtrusive */}
      <div className="pointer-events-auto flex items-center gap-1.5">
        {(
          [
            ["color", "COLOR"],
            ["face", "FACE"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(mode === value ? null : value)}
            className={`rounded-full px-4 py-1.5 text-[10px] tracking-[0.2em] transition-all duration-200 ${
              night
                ? mode === value
                  ? "bg-white/10 text-[#E8E4DA] outline outline-1 outline-[#E8E4DA]/50"
                  : "text-[#E8E4DA]/50 hover:bg-white/5 hover:text-[#E8E4DA]/85"
                : mode === value
                  ? "bg-[#2A2622]/8 text-[#2A2622] outline outline-1 outline-[#2A2622]/35"
                  : "text-[#2A2622]/55 hover:bg-black/5 hover:text-[#2A2622]/85"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* optional primary action */}
      {action && <div className="pointer-events-auto mt-2.5 flex justify-center">{action}</div>}
    </div>
  )
}
