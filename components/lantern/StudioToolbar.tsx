"use client"

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
}

export default function StudioToolbar({
  mode,
  onModeChange,
  selectedColorId,
  onColorSelect,
  selectedFace,
  onFaceSelect,
}: StudioToolbarProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-5 sm:pb-7">
      {/* expanding panel */}
      <div
        className={`pointer-events-auto mb-4 origin-bottom rounded-2xl border border-white/8 bg-[#0D0E12]/85 px-5 py-4 shadow-[0_8px_40px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-200 ${
          mode !== null ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <div className={mode === "color" ? "block" : "hidden"}>
          <ColorPicker
            selectedId={selectedColorId}
            onSelect={(c) => onColorSelect(c.id)}
          />
        </div>
        <div className={mode === "face" ? "block" : "hidden"}>
          <FacePicker selected={selectedFace} onSelect={onFaceSelect} />
        </div>
      </div>

      {/* mode tabs */}
      <div className="pointer-events-auto flex items-center gap-2">
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
            className={`rounded-full px-6 py-2.5 text-xs tracking-[0.2em] transition-all duration-200 ${
              mode === value
                ? "bg-[#E9E3D8]/12 text-[#E9E3D8] outline outline-1 outline-[#E9E3D8]/40"
                : "text-[#E9E3D8]/55 hover:bg-white/5 hover:text-[#E9E3D8]/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
