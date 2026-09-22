"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import StudioToolbar from "@/components/lantern/StudioToolbar"
import { getColorById, getDefaultFace } from "@/lib/lantern/colors"
import { preloadAllFaces } from "@/lib/lantern/faces"
import { pickSong, songLink, type MvpSong } from "@/lib/mvp/songs"
import { track } from "@/lib/mvp/analytics"
import type { FacePreset, LanternPhase, MvpStage, StudioMode } from "@/lib/lantern/types"

const LanternScene = dynamic(() => import("@/components/lantern/LanternScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden="true" />,
})

/** deterministic star field — fixed values, no hydration mismatch */
const STARS: readonly { left: string; top: string; s: number; o: number }[] = [
  { left: "6%", top: "14%", s: 2, o: 0.5 },
  { left: "12%", top: "38%", s: 1.5, o: 0.35 },
  { left: "18%", top: "8%", s: 1, o: 0.4 },
  { left: "24%", top: "26%", s: 1.5, o: 0.3 },
  { left: "31%", top: "12%", s: 2, o: 0.45 },
  { left: "38%", top: "6%", s: 1, o: 0.35 },
  { left: "44%", top: "18%", s: 1.5, o: 0.3 },
  { left: "52%", top: "9%", s: 2, o: 0.5 },
  { left: "58%", top: "22%", s: 1, o: 0.35 },
  { left: "64%", top: "13%", s: 1.5, o: 0.4 },
  { left: "71%", top: "28%", s: 2, o: 0.45 },
  { left: "77%", top: "10%", s: 1, o: 0.35 },
  { left: "83%", top: "19%", s: 1.5, o: 0.4 },
  { left: "90%", top: "33%", s: 2, o: 0.5 },
  { left: "94%", top: "12%", s: 1, o: 0.3 },
  { left: "9%", top: "58%", s: 1, o: 0.25 },
  { left: "86%", top: "52%", s: 1.5, o: 0.3 },
  { left: "16%", top: "72%", s: 1.5, o: 0.25 },
  { left: "79%", top: "68%", s: 1, o: 0.25 },
  { left: "47%", top: "4%", s: 1, o: 0.3 },
  { left: "27%", top: "46%", s: 1, o: 0.2 },
  { left: "68%", top: "44%", s: 1, o: 0.2 },
]

/** matches LanternLighting.LIGHTING_DURATION (2.8s) — spec §7 timeline */
const LIGHTING_MS = 2800

export default function MvpPage() {
  const [stage, setStage] = useState<MvpStage>("landing")
  const [colorId, setColorId] = useState<string>("chengdu")
  // a city colour carries its own DTZ face — picking a colour brings its
  // artwork, picking a face switches the lantern to that design's colour
  const [face, setFace] = useState<FacePreset | null>(() => getDefaultFace("chengdu"))
  const [mode, setMode] = useState<StudioMode | null>(null)
  const [song, setSong] = useState<MvpSong | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    track("page_view")
  }, [])
  // (dev StrictMode mounts effects twice; production fires once)

  // warm the face-thumbnail cache so the FACE grid opens instantly
  useEffect(() => {
    preloadAllFaces()
  }, [])

  const color = getColorById(colorId)

  // MVP stage → legacy lantern phase: landing/make are unlit ("ready"),
  // lighting/finished drive the 2.8s internal-light timeline unchanged
  const phase: LanternPhase =
    stage === "lighting" ? "lighting" : stage === "finished" ? "finished" : "ready"
  const env = stage === "landing" || stage === "make" ? "nightDim" : "nightLit"

  const handleStart = useCallback(() => {
    track("start_clicked")
    setMode("color")
    setStage("make")
  }, [])

  const handleColorSelect = useCallback((id: string) => {
    track("color_selected", { color: id })
    setColorId(id)
    setFace(getDefaultFace(id))
  }, [])

  const handleFaceSelect = useCallback(
    (next: FacePreset | null) => {
      if (!next) return
      track("face_selected", { face: next.id })
      setFace(next)
      setColorId(next.colorId)
    },
    [],
  )

  const lightUp = useCallback(() => {
    track("light_clicked", { color: colorId })
    setMode(null)
    setSong(pickSong())
    setStage("lighting")
  }, [colorId])

  // clicking the wick itself also lights it up (make stage only)
  const handleCoreClick = useCallback(() => {
    if (stage === "make") lightUp()
  }, [stage, lightUp])

  useEffect(() => {
    if (stage !== "lighting") return
    const timer = window.setTimeout(() => {
      setStage("finished")
      track("light_completed", { color: colorId })
    }, LIGHTING_MS)
    return () => window.clearTimeout(timer)
  }, [stage, colorId])

  const handleShare = useCallback(async () => {
    track("share_clicked")
    const url = typeof window !== "undefined" ? window.location.href : ""
    const text = song ? `今晚，我点亮了一盏灯，听见《${song.title}》。` : "今晚，灯亮了。"
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    if (nav && typeof nav.share === "function") {
      try {
        await nav.share({ title: "点一盏灯", text, url })
        return
      } catch (e) {
        // user closed the share sheet — don't also drop a link in the clipboard
        if (e instanceof Error && e.name === "AbortError") return
        // share unavailable/failed (e.g. unsupported context) → clipboard fallback
      }
    }
    try {
      await nav?.clipboard?.writeText(`${text} ${url}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2400)
    } catch {
      // legacy fallback: temporary textarea + execCommand (works on http pages)
      try {
        const ta = document.createElement("textarea")
        ta.value = `${text} ${url}`
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 2400)
      } catch {
        // clipboard truly unavailable — nothing else to do in the MVP
      }
    }
  }, [song])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#060B16] text-[#E8E4DA]">
      {/* deep blue-black night */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 62% at 50% 42%, #101B30 0%, #0A1322 55%, #060B16 100%)",
        }}
      />
      {/* sparse stars */}
      <div aria-hidden="true" className="absolute inset-0">
        {STARS.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-[#E8E4DA]"
            style={{
              left: st.left,
              top: st.top,
              width: st.s,
              height: st.s,
              opacity: st.o,
            }}
          />
        ))}
      </div>

      <LanternScene color={color} face={face} phase={phase} env={env} moon onCoreClick={handleCoreClick} />

      {/* ---------------- LANDING ---------------- */}
      {stage === "landing" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-[13vh]">
          <h1 className="text-3xl font-light tracking-[0.42em] sm:text-4xl">点一盏灯</h1>
          <p className="mt-3 text-[11px] tracking-[0.4em] text-[#E8E4DA]/55">MAKE IT. LIGHT IT.</p>
          <button
            type="button"
            onClick={handleStart}
            className="pointer-events-auto mt-9 rounded-full px-10 py-3 text-xs tracking-[0.45em] text-[#E8E4DA]/85 outline outline-1 outline-[#E8E4DA]/30 transition-all duration-300 hover:bg-[#E8E4DA]/10 hover:text-[#E8E4DA]"
          >
            ENTER
          </button>
        </div>
      )}

      {/* ---------------- MAKE (fades away on lighting) ---------------- */}
      {(stage === "make" || stage === "lighting") && (
        <div
          className={`transition-opacity duration-700 ${
            stage === "lighting" ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >
          <StudioToolbar
            tone="night"
            mode={mode}
            onModeChange={setMode}
            selectedColorId={colorId}
            onColorSelect={handleColorSelect}
            selectedFace={face}
            onFaceSelect={handleFaceSelect}
            action={
              <button
                type="button"
                onClick={lightUp}
                className="rounded-full bg-[#E8E4DA] px-12 py-3.5 text-sm tracking-[0.5em] text-[#0B1220] transition-all duration-300 hover:bg-white"
              >
                点亮
              </button>
            }
          />
        </div>
      )}

      {/* ---------------- FINISHED ---------------- */}
      {stage === "finished" && song && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-7 z-10 flex justify-center">
            <span className="text-base text-[#E8E4DA]/55">☾</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-[6vh] text-center">
            <p className="text-sm tracking-[0.42em] text-[#E8E4DA]/85">今晚，灯亮了。</p>
            <p className="mt-7 text-xl font-light tracking-[0.18em]">《{song.title}》</p>
            <p className="mt-2 text-[11px] tracking-[0.3em] text-[#E8E4DA]/50">
              {song.artist} · {song.note}
            </p>
            <div className="pointer-events-auto mt-9 flex flex-col items-center gap-3.5">
              <a
                href={songLink(song)}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("song_clicked", { song: song.title })}
                className="rounded-full bg-[#E8E4DA] px-9 py-3 text-sm tracking-[0.3em] text-[#0B1220] transition-colors duration-200 hover:bg-white"
              >
                去听这首歌
              </a>
              <button
                type="button"
                onClick={handleShare}
                className="rounded-full px-9 py-3 text-xs tracking-[0.3em] text-[#E8E4DA]/80 outline outline-1 outline-[#E8E4DA]/30 transition-colors duration-200 hover:text-[#E8E4DA]"
              >
                {copied ? "链接已复制" : "分享这盏灯"}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
