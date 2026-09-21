"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import StudioToolbar from "@/components/lantern/StudioToolbar"
import { DEFAULT_COLOR_ID, getColorById } from "@/lib/lantern/colors"
import type { FacePreset, LanternPhase, StudioMode } from "@/lib/lantern/types"

const LanternScene = dynamic(() => import("@/components/lantern/LanternScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden="true" />,
})

export default function LanternPage() {
  const [colorId, setColorId] = useState<string>(DEFAULT_COLOR_ID)
  const [face, setFace] = useState<FacePreset | null>(null)
  const [mode, setMode] = useState<StudioMode | null>("color")
  const [phase, setPhase] = useState<LanternPhase>("studio")

  const color = getColorById(colorId)
  const inStudio = phase === "studio"

  const handleCoreClick = useCallback(() => {
    setPhase((prev) => (prev === "ready" ? "lighting" : prev))
  }, [])

  useEffect(() => {
    if (phase !== "lighting") return
    const timer = window.setTimeout(() => setPhase("finished"), 3600)
    return () => window.clearTimeout(timer)
  }, [phase])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#07080B]">
      {/* night background: barely-there radial glow behind the lantern */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 46%, rgba(120,116,104,0.10), rgba(7,8,11,0) 70%), #07080B",
        }}
      />

      <LanternScene color={color} face={face} phase={phase} onCoreClick={handleCoreClick} />

      {/* title */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center pt-6 sm:pt-8">
        <h1 className="text-[11px] font-medium tracking-[0.42em] text-[#E9E3D8]/70 sm:text-xs">
          LANTERN STUDIO
        </h1>
        <p className="mt-1.5 text-[11px] tracking-[0.2em] text-[#E9E3D8]/35">
          画一盏灯，点亮它
        </p>
      </header>

      {/* DONE */}
      {inStudio && (
        <button
          type="button"
          onClick={() => {
            setMode(null)
            setPhase("ready")
          }}
          className="absolute right-5 top-6 z-10 rounded-full px-5 py-2.5 text-xs tracking-[0.25em] text-[#E9E3D8]/75 outline outline-1 outline-[#E9E3D8]/25 transition-all duration-200 hover:bg-white/8 hover:text-[#E9E3D8] sm:right-8 sm:top-8"
        >
          DONE
        </button>
      )}

      {/* ready-to-light hint */}
      {phase === "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center">
          <p className="animate-pulse-soft text-xs tracking-[0.3em] text-[#E9E3D8]/50">
            点击灯芯 · 点亮它
          </p>
        </div>
      )}

      {/* finished caption */}
      {phase === "finished" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center">
          <p className="text-xs tracking-[0.4em] text-[#E9E3D8]/45">这盏灯是你的</p>
        </div>
      )}

      {/* toolbar */}
      {inStudio && (
        <StudioToolbar
          mode={mode}
          onModeChange={setMode}
          selectedColorId={colorId}
          onColorSelect={setColorId}
          selectedFace={face}
          onFaceSelect={setFace}
        />
      )}
    </main>
  )
}
