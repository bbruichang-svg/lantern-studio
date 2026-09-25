"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import StudioToolbar from "@/components/lantern/StudioToolbar"
import { DEFAULT_COLOR_ID, getColorById, getDefaultFace } from "@/lib/lantern/colors"
import { preloadAllFaces } from "@/lib/lantern/faces"
import { usePrefersReducedMotion } from "@/lib/lantern/motion"
import type { FacePreset, LanternPhase, StudioMode } from "@/lib/lantern/types"

const LanternScene = dynamic(() => import("@/components/lantern/LanternScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden="true" />,
})

export default function LanternPage() {
  const [colorId, setColorId] = useState<string>(DEFAULT_COLOR_ID)
  // prefers-reduced-motion: compressed lighting timeline → shorter timer
  const reduceMotion = usePrefersReducedMotion()
  const lightingHoldMs = reduceMotion ? 1500 : 3600
  // a city colour carries its own DTZ face; picking a face switches
  // the lantern to that design's colour (city = colour + expression)
  const [face, setFace] = useState<FacePreset | null>(() => getDefaultFace(DEFAULT_COLOR_ID))
  const [mode, setMode] = useState<StudioMode | null>("color")
  const [phase, setPhase] = useState<LanternPhase>("studio")

  const color = getColorById(colorId)
  const inStudio = phase === "studio"
  // once the wick is lit the world turns to night — the studio only exists
  // while editing; the lit lantern belongs to a dark blue evening
  const night = phase === "lighting" || phase === "finished"

  const handleColorSelect = useCallback((id: string) => {
    setColorId(id)
    setFace(getDefaultFace(id))
  }, [])

  const handleFaceSelect = useCallback((next: FacePreset | null) => {
    if (!next) return
    setFace(next)
    setColorId(next.colorId)
  }, [])

  useEffect(() => {
    preloadAllFaces()
  }, [])

  const handleCoreClick = useCallback(() => {
    setPhase((prev) => (prev === "ready" ? "lighting" : prev))
  }, [])

  useEffect(() => {
    if (phase !== "lighting") return
    const timer = window.setTimeout(() => setPhase("finished"), lightingHoldMs)
    return () => window.clearTimeout(timer)
  }, [phase, lightingHoldMs])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#F7F4ED]">
      {/* bright studio background: white center, warm paper edges */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 46%, #FFFFFF 0%, #F3F0E7 70%, #EBE7DB 100%)",
        }}
      />
      {/* night backdrop crossfades in as the lantern lights */}
      <div
        aria-hidden="true"
        className="absolute inset-0 transition-opacity duration-[1800ms] ease-out"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 46%, #17233A 0%, #0C1526 55%, #060B16 100%)",
          opacity: night ? 1 : 0,
        }}
      />

      <LanternScene
        color={color}
        face={face}
        phase={phase}
        onCoreClick={handleCoreClick}
        reduceMotion={reduceMotion}
      />

      {/* title */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col items-center pt-6 sm:pt-8">
        <h1
          className={`text-[11px] font-medium tracking-[0.42em] transition-colors duration-[1800ms] sm:text-xs ${
            night ? "text-[#E8E4DA]/80" : "text-[#2A2622]/75"
          }`}
        >
          LANTERN STUDIO
        </h1>
        <p
          className={`mt-1.5 text-[11px] tracking-[0.2em] transition-colors duration-[1800ms] ${
            night ? "text-[#E8E4DA]/50" : "text-[#2A2622]/45"
          }`}
        >
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
          className="absolute right-5 top-6 z-10 rounded-full px-5 py-2.5 text-xs tracking-[0.25em] text-[#2A2622]/75 outline outline-1 outline-[#2A2622]/25 transition-all duration-200 hover:bg-black/5 hover:text-[#2A2622] sm:right-8 sm:top-8"
        >
          DONE
        </button>
      )}

      {/* ready-to-light hint */}
      {phase === "ready" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 z-10 flex justify-center">
          <p className="animate-pulse-soft text-xs tracking-[0.3em] text-[#2A2622]/55">
            点击灯芯 · 点亮它
          </p>
        </div>
      )}

      {/* finished caption */}
      {phase === "finished" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-14 z-10 flex justify-center">
          <p className="text-xs tracking-[0.4em] text-[#E8E4DA]/55">这盏灯是你的</p>
        </div>
      )}

      {/* toolbar */}
      {inStudio && (
        <StudioToolbar
          mode={mode}
          onModeChange={setMode}
          selectedColorId={colorId}
          onColorSelect={handleColorSelect}
          selectedFace={face}
          onFaceSelect={handleFaceSelect}
        />
      )}
    </main>
  )
}
