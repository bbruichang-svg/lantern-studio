"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import StudioToolbar from "@/components/lantern/StudioToolbar"
import ShareView from "@/components/lantern/ShareView"
import { getColorById, getDefaultFace } from "@/lib/lantern/colors"
import { renderShareCard } from "@/lib/lantern/share-card"
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

  // ---- share card state ----
  const captureApi = useRef<(() => string) | null>(null)
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

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
  // lighting/finished drive the 2.8s internal-light timeline unchanged;
  // share keeps the lantern lit and mounted underneath the overlay
  const phase: LanternPhase =
    stage === "lighting"
      ? "lighting"
      : stage === "finished" || stage === "share"
        ? "finished"
        : "ready"
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

  // ---- share card flow (spec: freeze → capture → restore) ----
  const openShare = useCallback(() => {
    // share_clicked kept for backwards compatibility with the original entry
    track("share_clicked", { color: colorId })
    track("share_opened")
    setStage("share")
  }, [colorId])

  const closeShare = useCallback(() => {
    track("share_closed")
    setCardUrl(null)
    cardCanvasRef.current = null
    setStage("finished")
  }, [])

  useEffect(() => {
    if (stage !== "share" || !song) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setGenerating(true)
      setFeedback(null)
      try {
        const shot = captureApi.current?.()
        if (!shot) throw new Error("canvas capture unavailable")
        const canvas = await renderShareCard({
          lanternCapture: shot,
          songTitle: song.title,
          artist: song.artist,
          moonLyric: song.moonLyric,
          year: 2026,
        })
        if (cancelled) return
        cardCanvasRef.current = canvas
        setCardUrl(canvas.toDataURL("image/png"))
      } catch {
        if (!cancelled) setFeedback("生成失败，请重试")
      } finally {
        if (!cancelled) setGenerating(false)
      }
    }, 420) // let the freeze settle (no sway, light stable) before capturing
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [stage, song])

  const showFeedback = useCallback((text: string) => {
    setFeedback(text)
    window.setTimeout(() => setFeedback(null), 1500)
  }, [])

  const saveCard = useCallback(async () => {
    const canvas = cardCanvasRef.current
    if (!canvas) return
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    const text = song ? `今晚，我点亮了一盏灯，听见《${song.title}》。` : "今晚，灯亮了。"
    const url = typeof window !== "undefined" ? window.location.href : ""

    // mobile first: Web Share API with the image as a File (spec §14)
    const canShareFiles =
      !!nav &&
      typeof nav.share === "function" &&
      "canShare" in nav &&
      typeof nav.canShare === "function"
    if (canShareFiles) {
      try {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
        if (!blob) throw new Error("blob failed")
        const file = new File([blob], "lantern-2026.png", { type: "image/png" })
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text, url })
          track("share_native")
          showFeedback("已分享")
          return
        }
      } catch (e) {
        // user closed the share sheet — not an error
        if (e instanceof Error && e.name === "AbortError") return
        // fall through to download
      }
    }

    // desktop / unsupported fallback: download the PNG
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "lantern-2026.png"
    a.click()
    track("share_downloaded")
    showFeedback("已保存")
  }, [song, showFeedback])

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

      <LanternScene
        color={color}
        face={face}
        phase={phase}
        env={env}
        moon
        onCoreClick={handleCoreClick}
        paused={generating}
        captureApiRef={captureApi}
      />

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
              /* the CTA is a small wick flame, not a pill button — the fire
                 itself invites the click (hover brightens, click ignites) */
              <button
                type="button"
                onClick={lightUp}
                aria-label="点亮"
                className="group flex flex-col items-center gap-2.5 outline-none"
              >
                <svg
                  className="wick-flame transition-transform duration-300 group-hover:scale-110 group-focus-visible:scale-110"
                  width="24"
                  height="32"
                  viewBox="0 0 24 32"
                  aria-hidden="true"
                >
                  <path
                    d="M12 1.5 C16.5 8 21 12.5 21 20.5 A9 9 0 0 1 3 20.5 C3 12.5 7.5 8 12 1.5 Z"
                    fill="#E8944A"
                  />
                  <path
                    d="M12 13 C14.5 16.5 16.5 18.5 16.5 22.5 A4.5 4.5 0 0 1 7.5 22.5 C7.5 18.5 9.5 16.5 12 13 Z"
                    fill="#FFDFA6"
                  />
                </svg>
                <span className="text-[10px] tracking-[0.5em] text-[#E8E4DA]/50 transition-colors duration-300 group-hover:text-[#E8E4DA]/90">
                  点亮
                </span>
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
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-[4vh] text-center">
            {/* the lantern's own light tints the words — UI and lantern share
                one light source via --lantern-glow (0 unlit → 1 lit) */}
            <p
              className="text-sm tracking-[0.42em] text-[#E8E4DA]/85"
              style={{ textShadow: "0 0 24px rgba(255,216,170,calc(var(--lantern-glow,0)*0.6))" }}
            >
              今晚，灯亮了。
            </p>
            {/* the moon line — rises out of the night after the light settles */}
            <p className="animate-lyric mt-3.5 max-w-[min(80vw,36em)] text-xs font-light leading-relaxed tracking-[0.2em] text-[#E8E4DA]/60">
              “{song.moonLyric}”
            </p>
            <p
              className="mt-3 text-xl font-light tracking-[0.18em]"
              style={{ textShadow: "0 0 30px rgba(255,216,170,calc(var(--lantern-glow,0)*0.45))" }}
            >
              《{song.title}》
            </p>
            <p className="mt-1.5 text-[11px] tracking-[0.3em] text-[#E8E4DA]/50">
              {song.artist}
            </p>
            <div className="pointer-events-auto mt-6 flex flex-col items-center gap-3">
              <a
                href={songLink(song)}
                target="_blank"
                rel="noreferrer"
                onClick={() => track("song_clicked", { song: song.title })}
                className="rounded-full bg-[#E8E4DA] px-9 py-3 text-sm tracking-[0.3em] text-[#0B1220] transition-colors duration-200 hover:bg-white"
              >
                去听这首歌
              </a>
              {/* lightweight share entry — thin text, no button card (spec §3) */}
              <button
                type="button"
                onClick={openShare}
                className="text-[11px] tracking-[0.32em] text-[#E8E4DA]/55 underline decoration-[#E8E4DA]/20 underline-offset-8 transition-colors duration-200 hover:text-[#E8E4DA] hover:decoration-[#E8E4DA]/60"
              >
                分享我的灯笼
              </button>
            </div>
          </div>
        </>
      )}

      {/* ---------------- SHARE (full-screen, lantern stays lit below) ---------------- */}
      {stage === "share" && (
        <ShareView
          cardUrl={cardUrl}
          generating={generating}
          feedback={feedback}
          onSave={saveCard}
          onClose={closeShare}
        />
      )}
    </main>
  )
}
