"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import ShareView from "@/components/lantern/ShareView"
import { getColorById, getDefaultFace, getFaceById } from "@/lib/lantern/colors"
import { renderShareCard } from "@/lib/lantern/share-card"
import { ensureFace, preloadAllFaces } from "@/lib/lantern/faces"
import { pickSong, getSongById, type MvpSong } from "@/lib/mvp/songs"
import { track } from "@/lib/mvp/analytics"
import {
  BLESSING_MAX,
  EXAMPLE_BLESSINGS,
  pickInspiration,
  isBlessingAllowed,
} from "@/lib/mvp/blessings"
import { addLantern, formatNumber } from "@/lib/mvp/storage"
import { customFacePreset, readCustomFace } from "@/lib/mvp/custom-face"
import { lanternLink, readLanternFromSearch, type LanternPayload } from "@/lib/mvp/share"
import type { FacePreset, LanternPhase, ReleaseStage } from "@/lib/lantern/types"

const LanternScene = dynamic(() => import("@/components/lantern/LanternScene"), {
  ssr: false,
  loading: () => <div className="absolute inset-0" aria-hidden="true" />,
})

/** apex stillness before the light merges into the moon (dissolve) */
const APEX_HOLD_MS = 2000
/** hold ≥ this many ms on release = charged enough to fly */
const HOLD_THRESHOLD_MS = 700

export default function ReleasePage() {
  const [stage, setStage] = useState<ReleaseStage>("arrive")
  const [colorId, setColorId] = useState<string>("xuan")
  const [face, setFace] = useState<FacePreset | null>(() => getDefaultFace("xuan"))
  const [song, setSong] = useState<MvpSong | null>(null)

  // ---- share card state ----
  const captureApi = useRef<(() => string) | null>(null)
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  // ---- hold-to-release (charge stage): press to charge, release to fly ----
  const [charging, setCharging] = useState(false)
  const holdStartRef = useRef<number>(0)

  // ---- blessing ----
  const [blessing, setBlessing] = useState("")
  const [inspiration, setInspiration] = useState<string[]>(() => pickInspiration())
  const [litNo, setLitNo] = useState(0)

  // ---- share-link restore (?l=... opens straight to apex) ----
  const [shared, setShared] = useState<LanternPayload | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    track("release_page_view")
    // share-link restore — same one-shot microtask pattern as the root MVP
    queueMicrotask(() => {
      const search = window.location.search
      const payload = readLanternFromSearch(search)
      if (payload) {
        track("release_share_opened")
        setShared(payload)
        const s = getSongById(payload.s)
        if (s) setSong(s)
        setStage("apex")
        return
      }
      // entry bridge from the MVP finished step (?from=make&color=&face=&blessing=)
      // — the make→release flow is one continuous ritual now: skip the arrive
      // gate and land straight on the wish page with the inputs pre-filled
      // (one tap on 蓄力放灯 confirms). "custom" faces can't ride a URL
      // (image data), so they fall back to THIS device's own drawing, then to
      // the city default.
      const params = new URLSearchParams(search)
      if (params.get("from") !== "make") return
      const c = params.get("color")
      if (c && getColorById(c).id === c) setColorId(c)
      const f = params.get("face")
      if (f === "custom") {
        const stored = readCustomFace()
        if (stored) {
          const cf = customFacePreset(stored)
          setFace(cf)
          setColorId(cf.colorId)
          void ensureFace(cf.src)
        }
      } else if (f) {
        const preset = getFaceById(f)
        if (preset) {
          setFace(preset)
          setColorId(preset.colorId)
        }
      }
      const b = params.get("blessing")
      if (b && b.length <= BLESSING_MAX && isBlessingAllowed(b)) setBlessing(b)
      if (c || f || b) {
        track("release_prefilled")
        // keep the funnel metric — handleEnter never fires on this path
        track("release_start")
        // the blessing was already written during the make ritual — skip
        // arrive AND wish, land straight on charge (hold the lantern to release)
        setStage("charge")
        track("release_charge_entered")
      }
      window.history.replaceState(null, "", window.location.pathname)
    })
  }, [])

  useEffect(() => {
    preloadAllFaces()
  }, [])

  const color = getColorById(colorId)
  const sceneColor = shared ? getColorById(shared.c) : color
  // shared lamps with faceId "custom" fall back to THIS device's own
  // drawing (links can't carry the image), then to the city default
  const sharedCustom = shared && shared.f === "custom" ? readCustomFace() : null
  const sceneFace = shared
    ? getFaceById(shared.f) ??
      (sharedCustom ? customFacePreset(sharedCustom) : null) ??
      getDefaultFace(shared.c)
    : face
  const sceneSong = shared ? getSongById(shared.s) : song
  const sceneBlessing = shared ? shared.b : blessing.trim()
  const sceneNo = shared ? shared.n : litNo

  // release stage → lantern phase: arrive/wish/charge unlit ("ready"),
  // soar uses "lighting" so the paper ignites while it lifts off the ground
  // (ignition and take-off are the same moment), then holds at full glow.
  const phase: LanternPhase =
    stage === "apex" ||
    stage === "hang" ||
    stage === "dissolve" ||
    stage === "memory" ||
    stage === "share"
      ? "finished"
      : stage === "soar"
        ? "lighting"
        : "ready"
  const env =
    stage === "arrive" || stage === "wish" || stage === "charge" ? "nightDim" : "nightLit"

  const handleEnter = useCallback(() => {
    track("release_start")
    setStage("wish")
  }, [])

  const handleWishDone = useCallback(() => {
    if (!blessing.trim()) return
    setStage("charge")
    track("release_charge_entered")
  }, [blessing])

  const handleRelease = useCallback(() => {
    const text = blessing.trim()
    if (!text) return
    if (!isBlessingAllowed(text)) {
      showToast("寄语包含不被允许的内容，请修改")
      setStage("wish")
      return
    }
    track("release_hold_released", { color: colorId })
    const picked = pickSong()
    // 先落盘后动画 — the lamp exists on this device the moment it flies
    const res = addLantern({
      colorId,
      faceId: face?.id ?? "",
      blessing: text,
      songId: picked.id,
    })
    setLitNo(res.record.no)
    setSong(picked)
    setStage("soar")
    if (res.trimmed) showToast("本机空间不足，最早的灯将被清理")
  }, [blessing, colorId, face, showToast])

  // hold-to-release: press starts charging; RELEASE judges the hold length
  // — held past the threshold = charged enough to fly. Unlike the root MVP
  // (900ms auto-fires lighting on release), here the user's lift-off is the
  // release itself. The chargeRef glow inside LanternModel is shared verbatim.
  const handleHoldStart = useCallback(() => {
    if (stage !== "charge" || !blessing.trim()) return
    setCharging(true)
    holdStartRef.current = performance.now()
    track("release_hold_started")
  }, [stage, blessing])

  const handleHoldCancel = useCallback(() => {
    setCharging(false)
    const held = performance.now() - holdStartRef.current
    if (held >= HOLD_THRESHOLD_MS) {
      handleRelease()
    } else if (held > 0) {
      track("release_hold_short")
    }
  }, [handleRelease])

  // soar → apex is signalled by the flight timeline itself (SoarController),
  // not a timer — the camera and lantern arrive together.
  const handleSoarComplete = useCallback(() => {
    setStage("apex")
    track("release_soar_complete", { color: colorId })
  }, [colorId])

  // apex → hang: a still beat at the moon-framed apex, then the lantern
  // flies to the bare branch and hangs there (挂树终幕) before 化月
  useEffect(() => {
    if (stage !== "apex") return
    const t = window.setTimeout(() => {
      setStage("hang")
    }, APEX_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [stage])

  // hang → dissolve: the lantern has caught the branch and swayed; now its
  // light swells and merges into the moon from the branch tip
  const handleHangComplete = useCallback(() => {
    setStage("dissolve")
    track("release_hang", { color: colorId })
  }, [colorId])

  const handleDissolveComplete = useCallback(() => {
    setStage("memory")
    track("release_dissolve_complete")
    track("release_memory")
  }, [])

  // ---- share card ----
  const openShare = useCallback(() => {
    track("release_share_opened_card")
    setStage("share")
  }, [])
  const closeShare = useCallback(() => {
    setCardUrl(null)
    cardCanvasRef.current = null
    setStage("memory")
  }, [])

  useEffect(() => {
    if (stage !== "share" || !song) return
    let cancelled = false
    const t = window.setTimeout(async () => {
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
          blessing: blessing.trim(),
          lanternNo: formatNumber(litNo),
          headline: "今晚，灯住进了树梢。",
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
    }, 420)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [stage, song, blessing, litNo])

  const showFeedback = useCallback((text: string) => {
    setFeedback(text)
    window.setTimeout(() => setFeedback(null), 1500)
  }, [])

  const buildLanternUrl = useCallback(() => {
    const link = lanternLink({
      c: colorId,
      f: face?.id ?? "",
      b: blessing.trim(),
      s: song?.id ?? "",
      n: litNo,
    })
    return new URL(link, window.location.origin).toString()
  }, [colorId, face, blessing, song, litNo])

  const copyLanternLink = useCallback(async () => {
    const url = buildLanternUrl()
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    const text = blessing.trim() ? `我放了一盏灯：「${blessing.trim()}」` : "今晚，灯住进了树梢。"
    try {
      await nav?.clipboard?.writeText(`${text} ${url}`)
      showFeedback("链接已复制，去粘贴给朋友吧")
    } catch {
      try {
        const ta = document.createElement("textarea")
        ta.value = `${text} ${url}`
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
        showFeedback("链接已复制，去粘贴给朋友吧")
      } catch {
        showFeedback("复制失败，请手动复制地址栏链接")
      }
    }
  }, [buildLanternUrl, blessing, showFeedback])

  const saveCard = useCallback(async () => {
    const canvas = cardCanvasRef.current
    if (!canvas) return
    const nav = typeof navigator !== "undefined" ? navigator : undefined
    const text = song ? `今晚，我放了一盏灯，听见《${song.title}》。` : "今晚，灯住进了树梢。"
    const url = buildLanternUrl()
    const canShareFiles =
      !!nav &&
      typeof nav.share === "function" &&
      "canShare" in nav &&
      typeof nav.canShare === "function"
    if (canShareFiles) {
      try {
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
        if (!blob) throw new Error("blob failed")
        const file = new File([blob], "lantern-release-2026.png", { type: "image/png" })
        if (nav.canShare({ files: [file] })) {
          await nav.share({ files: [file], text, url })
          track("release_share_native")
          showFeedback("已分享")
          return
        }
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
      }
    }
    const a = document.createElement("a")
    a.href = canvas.toDataURL("image/png")
    a.download = "lantern-release-2026.png"
    a.click()
    track("release_share_downloaded")
    showFeedback("已保存")
  }, [song, showFeedback, buildLanternUrl])

  const handleRelight = useCallback(() => {
    setShared(null)
    setBlessing("")
    setSong(null)
    setColorId("xuan")
    setFace(getDefaultFace("xuan"))
    window.history.replaceState(null, "", window.location.pathname)
    track("release_start")
    setStage("arrive")
  }, [])

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[#060B16] text-[#E8E4DA]">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 62% at 50% 42%, #101B30 0%, #0A1322 55%, #060B16 100%)",
        }}
      />

      <LanternScene
        color={sceneColor}
        face={sceneFace}
        phase={phase}
        env={env}
        moon
        onCoreClick={() => {}}
        paused={generating}
        captureApiRef={captureApi}
        holdEnabled={stage === "charge" && !!blessing.trim()}
        charging={charging}
        onHoldStart={handleHoldStart}
        onHoldCancel={handleHoldCancel}
        releaseStage={stage}
        onSoarComplete={handleSoarComplete}
        onHangComplete={handleHangComplete}
        onDissolveComplete={handleDissolveComplete}
      />

      {/* ---------------- ARRIVE ---------------- */}
      {stage === "arrive" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-[11vh] text-center">
          <h1 className="text-3xl font-light tracking-[0.42em] sm:text-4xl">放一盏灯</h1>
          <p className="mt-3 text-[11px] tracking-[0.4em] text-[#E8E4DA]/55">RELEASE IT.</p>
          <button
            type="button"
            onClick={handleEnter}
            className="pointer-events-auto mt-9 rounded-full px-10 py-3 text-xs tracking-[0.45em] text-[#E8E4DA]/85 outline outline-1 outline-[#E8E4DA]/30 transition-all duration-300 hover:bg-[#E8E4DA]/10 hover:text-[#E8E4DA]"
          >
            ENTER
          </button>
          <p className="mt-5 text-[10px] tracking-[0.25em] text-[#E8E4DA]/40">写一句话，放飞它</p>
        </div>
      )}

      {/* ---------------- WISH ---------------- */}
      {/* container pointer-transparent so the lantern behind can be held;
          interactive children opt back in (same pattern as root MVP blessing) */}
      {stage === "wish" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-6 pb-[8vh] text-center">
          <p className="text-[10px] tracking-[0.45em] text-[#E8E4DA]/50">给这盏灯写一句话</p>
          <div className="pointer-events-auto mt-6 w-full max-w-sm rounded-2xl border border-white/15 bg-white/[0.08] px-5 py-4 backdrop-blur-md">
            <input
              value={blessing}
              maxLength={BLESSING_MAX}
              autoFocus
              onChange={(e) => setBlessing(e.target.value)}
              placeholder="写一句祝福…"
              className="w-full bg-transparent text-center text-lg tracking-[0.08em] text-[#E8E4DA] outline-none placeholder:text-[#E8E4DA]/30"
            />
            <p className="mt-1 text-right text-[10px] tracking-[0.2em] text-[#E8E4DA]/40">
              剩余 {BLESSING_MAX - blessing.length} 字
            </p>
          </div>
          <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-2">
            {EXAMPLE_BLESSINGS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setBlessing(x)}
                className="rounded-full border border-white/12 px-4 py-2 text-xs text-[#E8E4DA]/70 transition-colors duration-200 hover:bg-white/10 hover:text-[#E8E4DA]"
              >
                {x}
              </button>
            ))}
          </div>
          <div className="pointer-events-auto mt-3 flex flex-wrap items-center justify-center gap-2">
            {inspiration.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setBlessing(x)}
                className="rounded-full px-4 py-2 text-xs text-[#E8E4DA]/55 outline outline-1 outline-white/10 transition-colors duration-200 hover:bg-white/10 hover:text-[#E8E4DA]"
              >
                {x}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setInspiration(pickInspiration(new Set(inspiration)))}
              className="rounded-full px-3 py-2 text-[10px] tracking-[0.2em] text-[#E8E4DA]/40 transition-colors duration-200 hover:text-[#E8E4DA]/80"
            >
              换一批
            </button>
          </div>
          <button
            type="button"
            onClick={handleWishDone}
            disabled={!blessing.trim()}
            className="pointer-events-auto mt-9 rounded-full bg-[#E8E4DA] px-12 py-3.5 text-sm tracking-[0.5em] text-[#0B1220] transition-all duration-300 hover:bg-white disabled:opacity-35"
          >
            蓄力放灯
          </button>
          {!blessing.trim() && (
            <p className="mt-3 text-[10px] tracking-[0.25em] text-[#E8E4DA]/40">
              写一句祝福，或从上方灵感中挑一句
            </p>
          )}
        </div>
      )}

      {/* ---------------- CHARGE — hold the lantern to charge, release to fly */}
      {stage === "charge" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-[14vh] text-center">
          <p className="text-[10px] tracking-[0.45em] text-[#E8E4DA]/50">
            {charging ? "蓄光中…" : "按住灯笼，蓄满放灯"}
          </p>
          {/* fallback for when hold is awkward (trackpad / a11y) */}
          <button
            type="button"
            onClick={handleRelease}
            className="pointer-events-auto mt-6 rounded-full bg-[#E8E4DA] px-10 py-3 text-xs tracking-[0.45em] text-[#0B1220] transition-all duration-300 hover:bg-white"
          >
            放灯
          </button>
          <button
            type="button"
            onClick={() => setStage("wish")}
            className="pointer-events-auto mt-4 text-[10px] tracking-[0.3em] text-[#E8E4DA]/40 transition-colors duration-200 hover:text-[#E8E4DA]/75"
          >
            ‹ 改祝福
          </button>
        </div>
      )}

      {/* ---------------- SOAR — placeholder (real trajectory in Task 4) */}
      {stage === "soar" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <p className="text-[11px] tracking-[0.4em] text-[#E8E4DA]/40">灯，正在升空</p>
        </div>
      )}

      {/* ---------------- APEX / HANG / MEMORY — high & still, moon-framed */}
      {(stage === "apex" || stage === "hang" || stage === "memory") && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-[4vh] text-center">
          <p
            className="text-[10px] tracking-[0.35em] text-[#E8E4DA]/40"
            style={{ textShadow: "0 0 20px rgba(255,216,170,calc(var(--lantern-glow,0)*0.4))" }}
          >
            {formatNumber(sceneNo)}
          </p>
          <p
            className="mt-1 text-sm tracking-[0.42em] text-[#E8E4DA]/85"
            style={{ textShadow: "0 0 24px rgba(255,216,170,calc(var(--lantern-glow,0)*0.6))" }}
          >
            {stage === "apex" ? "今晚，灯飞了。" : "今晚，灯住进了树梢。"}
          </p>
          {sceneBlessing && (
            <p className="mt-3.5 max-w-[min(80vw,26em)] text-base leading-relaxed tracking-[0.06em] text-[#E8E4DA]/90">
              「{sceneBlessing}」
            </p>
          )}
          {sceneSong && (
            <>
              <p className="mt-3.5 max-w-[min(80vw,36em)] text-xs font-light leading-relaxed tracking-[0.2em] text-[#E8E4DA]/60">
                &ldquo;{sceneSong.moonLyric}&rdquo;
              </p>
              <p
                className="mt-3 text-xl font-light tracking-[0.18em]"
                style={{ textShadow: "0 0 30px rgba(255,216,170,calc(var(--lantern-glow,0)*0.45))" }}
              >
                《{sceneSong.title}》
              </p>
              <p className="mt-1.5 text-[11px] tracking-[0.3em] text-[#E8E4DA]/50">
                {sceneSong.artist}
              </p>
            </>
          )}
          <div className="pointer-events-auto mt-6 flex flex-col items-center gap-3">
            {shared ? (
              <button
                type="button"
                onClick={handleRelight}
                className="rounded-full bg-[#E8E4DA] px-9 py-3 text-sm tracking-[0.3em] text-[#0B1220] transition-colors duration-200 hover:bg-white"
              >
                我也放一盏
              </button>
            ) : (
              <button
                type="button"
                onClick={openShare}
                className="text-[11px] tracking-[0.32em] text-[#E8E4DA]/55 underline decoration-[#E8E4DA]/20 underline-offset-8 transition-colors duration-200 hover:text-[#E8E4DA] hover:decoration-[#E8E4DA]/60"
              >
                分享这盏灯
              </button>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SHARE ---------------- */}
      {stage === "share" && (
        <ShareView
          cardUrl={cardUrl}
          generating={generating}
          feedback={feedback}
          onSave={saveCard}
          onCopyLink={copyLanternLink}
          onClose={closeShare}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center">
          <p className="rounded-full bg-black/60 px-5 py-2.5 text-xs tracking-[0.15em] text-[#E8E4DA]/90 backdrop-blur">
            {toast}
          </p>
        </div>
      )}

      <p className="pointer-events-none absolute bottom-2.5 left-4 z-20 text-[9px] tracking-[0.2em] text-[#E8E4DA]/25">
        非官方粉丝二创 · 图案素材：大头仔 DTZ
      </p>
    </main>
  )
}
