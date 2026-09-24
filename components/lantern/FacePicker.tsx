"use client"

import { ALL_FACES, getColorById } from "@/lib/lantern/colors"
import type { FacePreset } from "@/lib/lantern/types"

type FacePickerProps = {
  selectedId: string | null
  onSelect: (face: FacePreset) => void
  /** the user's hand-drawn face (single local slot), shown after the draw entry */
  customFace?: FacePreset | null
  /** opens the hand-drawing board; omit to hide the entry (studio keeps DTZ-only) */
  onDraw?: () => void
  /** deletes the stored hand-drawn face; omit to hide the delete affordance */
  onDeleteCustom?: () => void
  /** "ink" = dark selection ring (studio) · "night" = light ring (night sky) */
  tone?: "ink" | "night"
}

export default function FacePicker({
  selectedId,
  onSelect,
  customFace,
  onDraw,
  onDeleteCustom,
  tone = "ink",
}: FacePickerProps) {
  const night = tone === "night"
  const ringCls = (isSelected: boolean) =>
    night
      ? isSelected
        ? "outline outline-1 outline-[#E8E4DA]"
        : "outline outline-1 outline-transparent hover:bg-white/5"
      : isSelected
        ? "outline outline-1 outline-[#2A2622]"
        : "outline outline-1 outline-transparent hover:bg-black/5"

  return (
    <div className="flex max-w-[min(92vw,720px)] gap-x-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {/* draw entry — first in the strip so the personal path is discoverable */}
      {onDraw && (
        <button
          type="button"
          onClick={onDraw}
          aria-label="画一个表情"
          title="画一个表情"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-dashed p-0.5 transition-all duration-200 ${
            night
              ? "border-[#E8E4DA]/40 hover:border-[#E8E4DA]/80"
              : "border-[#2A2622]/35 hover:border-[#2A2622]/70"
          }`}
        >
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full text-base ${
              night ? "text-[#E8E4DA]/70" : "text-[#2A2622]/60"
            }`}
          >
            画
          </span>
        </button>
      )}

      {/* the user's own drawing, when one exists — deletable (the preset
          faces are fixed; only the personal slot can be removed) */}
      {customFace && (
        <div key={customFace.id} className="relative shrink-0">
          <button
            type="button"
            onClick={() => onSelect(customFace)}
            aria-label={customFace.name}
            title={customFace.name}
            className={`flex h-11 w-11 items-center justify-center rounded-full p-0.5 transition-all duration-200 ${ringCls(
              selectedId === customFace.id,
            )}`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ${
                night ? "border border-white/20" : "border border-black/10"
              }`}
              style={{ backgroundColor: getColorById(customFace.colorId).base }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={customFace.src} alt="" draggable={false} className="h-9 w-9 select-none" />
            </span>
          </button>
          {onDeleteCustom && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteCustom()
              }}
              aria-label="删除手绘表情"
              title="删除手绘表情"
              className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] leading-none transition-colors duration-200 ${
                night
                  ? "bg-[#0B1220] text-[#E8E4DA]/70 hover:bg-[#E03860] hover:text-white"
                  : "bg-[#2A2622] text-white/80 hover:bg-[#E03860] hover:text-white"
              }`}
            >
              ✕
            </button>
          )}
        </div>
      )}

      {ALL_FACES.map((face) => {
        const isSelected = face.id === selectedId
        return (
          <button
            key={face.id}
            type="button"
            onClick={() => onSelect(face)}
            aria-label={face.name}
            title={face.name}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0.5 transition-all duration-200 ${ringCls(
              isSelected,
            )}`}
          >
            {/* disc backing in the city colour so light-ink designs stay visible */}
            <span
              className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ${
                night ? "border border-white/20" : "border border-black/10"
              }`}
              style={{ backgroundColor: getColorById(face.colorId).base }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={face.src}
                alt=""
                draggable={false}
                className="h-9 w-9 select-none"
              />
            </span>
          </button>
        )
      })}
    </div>
  )
}
