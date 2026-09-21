"use client"

import { useEffect, useRef } from "react"
import { FACE_PRESETS, renderFaceToCanvas } from "@/lib/lantern/faces"
import type { FacePreset } from "@/lib/lantern/types"

type FacePickerProps = {
  selected: FacePreset | null
  onSelect: (face: FacePreset | null) => void
}

function FaceThumb({ face }: { face: FacePreset }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (ref.current) renderFaceToCanvas(ref.current, face)
  }, [face])

  return <canvas ref={ref} width={96} height={96} className="h-12 w-12" aria-hidden="true" />
}

export default function FacePicker({ selected, onSelect }: FacePickerProps) {
  return (
    <div className="grid grid-cols-4 gap-x-3 gap-y-3">
      {FACE_PRESETS.map((face) => {
        const isSelected = selected?.id === face.id
        return (
          <button
            key={face.id}
            type="button"
            onClick={() => onSelect(face)}
            aria-label={face.name}
            title={face.name}
            className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-200 hover:bg-black/5 ${
              isSelected ? "bg-black/5 outline outline-1 outline-[#2A2622]" : "outline outline-1 outline-transparent"
            }`}
          >
            <FaceThumb face={face} />
            <span
              className={`text-[10px] tracking-wide transition-colors duration-200 ${
                isSelected ? "text-[#2A2622]" : "text-[#2A2622]/55"
              }`}
            >
              {face.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
