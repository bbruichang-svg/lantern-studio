"use client"

import { useEffect, useState } from "react"
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
  /** the user's hand-drawn gallery (root MVP only — studio keeps DTZ-only) */
  customFaces?: FacePreset[]
  /** opens the hand-drawing board; omit to hide the draw entry */
  onDraw?: () => void
  /** deletes one stored hand-drawn face by id; omit to hide the delete affordance */
  onDeleteCustom?: (faceId: string) => void
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
  customFaces,
  onDraw,
  onDeleteCustom,
  tone = "ink",
  action,
}: StudioToolbarProps) {
  const night = tone === "night"

  // 「新」badge on the FACE tab — a first-visit hint toward the hand-drawing
  // entry. Disappears once the FACE tab is opened; remembered via localStorage.
  const [faceBadge, setFaceBadge] = useState(false)
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (!window.localStorage.getItem("moon.seenFaceBadge.v1")) setFaceBadge(true)
      } catch {
        // storage unavailable (private mode) — simply skip the badge
      }
    })
  }, [])

  const handleTabClick = (value: StudioMode) => {
    if (value === "face") {
      setFaceBadge(false)
      try {
        window.localStorage.setItem("moon.seenFaceBadge.v1", "1")
      } catch {
        // storage unavailable — the badge just reappears next visit
      }
    }
    onModeChange(mode === value ? null : value)
  }

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
          <FacePicker
            tone={tone}
            selectedId={selectedFace?.id ?? null}
            onSelect={onFaceSelect}
            customFaces={customFaces}
            onDraw={onDraw}
            onDeleteCustom={onDeleteCustom}
          />
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
            onClick={() => handleTabClick(value)}
            className={`relative rounded-full px-4 py-1.5 text-[10px] tracking-[0.2em] transition-all duration-200 ${
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
            {value === "face" && faceBadge && (
              <span className="absolute -right-1.5 -top-1.5 rounded-full bg-[#E8944A] px-[5px] py-px text-[8px] font-medium leading-none text-[#0B1220]">
                新
              </span>
            )}
          </button>
        ))}
      </div>

      {/* optional primary action */}
      {action && <div className="pointer-events-auto mt-2.5 flex justify-center">{action}</div>}
    </div>
  )
}
