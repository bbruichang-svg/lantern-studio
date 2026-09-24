"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import StudioToolbar from "@/components/lantern/StudioToolbar"
import ShareView from "@/components/lantern/ShareView"
import FacePainter from "@/components/lantern/FacePainter"
import { getColorById, getDefaultFace, getFaceById } from "@/lib/lantern/colors"
import { renderShareCard } from "@/lib/lantern/share-card"
import { ensureFace, preloadAllFaces } from "@/lib/lantern/faces"
import { pickSong, getSongById, type MvpSong } from "@/lib/mvp/songs"
import { track } from "@/lib/mvp/analytics"
import {
  clearCustomFace,
  customFacePreset,
  readCustomFace,
  writeCustomFace,
  type StoredCustomFace,
} from "@/lib/mvp/custom-face"
import {
  BLESSING_MAX,
  EXAMPLE_BLESSINGS,
  pickInspiration,
  isBlessingAllowed,
} from "@/lib/mvp/blessings"
import { addLantern, litCount, formatNumber } from "@/lib/mvp/storage"
import { lanternLink, readLanternFromSearch, type LanternPayload } from "@/lib/mvp/share"
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

/** finished stillness ("今晚，灯亮了。") before auto-advancing into /release */
const FINISHED_HOLD_MS = 3000

/** 首页计数四档文案 — 本机口径，数字永远真实（PRD §7） */
function counterCopy(n: number): { main: string; sub: string } {
  if (n === 0) return { main: "灯会初亮，火种已备", sub: "点亮你的第一盏灯" }
  if (n < 50) return { main: `你是第 ${n} 位点灯人`, sub: "月色正好，再添一盏" }
  if (n < 1000) return { main: `你已亲手点亮 ${n} 盏灯`, sub: "千灯映月，皆是心意" }
  return { main: `你已亲手点亮 ${n.toLocaleString()} 盏灯`, sub: "灯火连成星河，皆出你手" }
}

export default function MvpPage() {
  const router = useRouter()
  const [stage, setStage] = useState<MvpStage>("landing")
  const [colorId, setColorId] = useState<string>("chengdu")
  // a city colour carries its own DTZ face — picking a colour brings its
  // artwork, picking a face switches the lantern to that design's colour
  const [face, setFace] = useState<FacePreset | null>(() => getDefaultFace("chengdu"))
  const [mode, setMode] = useState<StudioMode | null>(null)
  const [song, setSong] = useState<MvpSong | null>(null)
  // landing 计数读 localStorage — SSR 渲染 0，挂载后再同步，避免水合不匹配
  // （queueMicrotask：新版 react-hooks 规则禁止 effect 内同步 setState）
  const [count, setCount] = useState(0)
  // 手绘表情 — 本机单槽，挂载时恢复
  const [customFace, setCustomFace] = useState<FacePreset | null>(null)
  const [painterOpen, setPainterOpen] = useState(false)
  useEffect(() => {
    queueMicrotask(() => {
      setCount(litCount())
      const stored = readCustomFace()
      if (stored) {
        const f = customFacePreset(stored)
        setCustomFace(f)
        void ensureFace(f.src) // warm the texture cache for instant swaps
      }
    })
  }, [])

  // ---- share card state ----
  const captureApi = useRef<(() => string) | null>(null)
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [cardUrl, setCardUrl] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  // ---- hold-to-light (blessing stage): press the lantern to charge it ----
  const [charging, setCharging] = useState(false)
  const holdTimerRef = useRef<number | null>(null)
  const holdFiredRef = useRef(false)

  // ---- blessing step (PRD F1 写祝福) ----
  const [blessing, setBlessing] = useState("")
  const [inspiration, setInspiration] = useState<string[]>(() => pickInspiration())
  // ---- 先落盘后动画：本机编号在点亮瞬间写入 localStorage ----
  const [litNo, setLitNo] = useState(0)
  // ---- a lantern restored from a share link (?l=...) — skips the flow ----
  const [shared, setShared] = useState<LanternPayload | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    track("page_view")
    // share-link restore runs before anything else — zero network, local only.
    // queued as a microtask: it's one-shot init from an external system (the
    // URL), and keeps the effect free of synchronous setState.
    queueMicrotask(() => {
      const search = window.location.search
      const payload = readLanternFromSearch(search)
      if (payload) {
        track("share_link_opened")
        setShared(payload)
        setStage("finished")
      } else if (new URLSearchParams(search).has("l")) {
        // param present but truncated/tampered → soft fallback, never an error dump
        showToast("灯的线索丢了，先去灯会逛逛吧")
      }
    })
  }, [showToast])
  // (dev StrictMode mounts effects twice; production fires once)

  // warm the face-thumbnail cache so the FACE grid opens instantly
  useEffect(() => {
    preloadAllFaces()
  }, [])

  const color = getColorById(colorId)

  // what the 3D scene shows — the user's own lantern, or a shared one.
  // Shared lamps carrying faceId "custom" fall back to THIS device's own
  // drawing (links can't carry the image), then to the city default.
  const sceneColor = shared ? getColorById(shared.c) : color
  const sceneFace = shared
    ? getFaceById(shared.f) ??
      (shared.f === "custom" ? customFace : null) ??
      getDefaultFace(shared.c)
    : face
  const sceneSong = shared ? getSongById(shared.s) : song
  const sceneBlessing = shared ? shared.b : blessing.trim()
  const sceneNo = shared ? shared.n : litNo

  // MVP stage → legacy lantern phase: landing/make/blessing are unlit ("ready"),
  // lighting/finished drive the 2.8s internal-light timeline unchanged;
  // share keeps the lantern lit and mounted underneath the overlay
  const phase: LanternPhase =
    stage === "lighting"
      ? "lighting"
      : stage === "finished" || stage === "share"
        ? "finished"
        : "ready"
  const env =
    stage === "landing" || stage === "make" || stage === "blessing" ? "nightDim" : "nightLit"

  const handleStart = useCallback(() => {
    track("start_clicked")
    setMode("color")
    setStage("make")
  }, [])

  // narrative bridge — carry the lantern just made into the /release ritual.
  // state rides the query string (release page pre-fills wish inputs);
  // URLSearchParams handles the CJK blessing encoding. "custom" faces can't
  // ride a URL (image data) — release falls back to this device's own drawing.
  const releaseQuery = useCallback(() => {
    const params = new URLSearchParams()
    params.set("from", "make")
    params.set("color", colorId)
    const fid = face?.id
    if (fid) params.set("face", fid)
    const b = blessing.trim()
    if (b) params.set("blessing", b)
    return `/release?${params.toString()}`
  }, [colorId, face, blessing])

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

  // delete the hand-drawn face — the personal slot only; preset faces are
  // baked assets and stay fixed. If the drawing was on the lantern, fall
  // back to the current city's default face.
  const handleDeleteCustom = useCallback(() => {
    clearCustomFace()
    setCustomFace(null)
    setFace((prev) => (prev?.id === "custom" ? getDefaultFace(colorId) : prev))
    track("face_custom_deleted")
    showToast("手绘表情已删除")
  }, [colorId, showToast])

  // ---- 手绘表情 ----
  const openPainter = useCallback(() => {
    track("face_draw_opened")
    setPainterOpen(true)
  }, [])

  const handlePainterSaved = useCallback(
    (src: string) => {
      // ink was matched to the colour worn while drawing — freeze it there
      const stored: StoredCustomFace = { src, colorId, savedAt: Date.now() }
      const ok = writeCustomFace(stored)
      const f = customFacePreset(stored)
      void ensureFace(src) // warm the texture cache before the swap
      setCustomFace(f)
      setFace(f)
      setPainterOpen(false)
      track("face_selected", { face: "custom" })
      if (!ok) showToast("本机空间不足，手绘仅本次有效")
    },
    [colorId, showToast],
  )

  // the flame CTA / the wick itself now lead to the blessing step —
  // 点灯提交统一在写祝福步骤完成（PRD F1-E6/E10/E12）
  const goBlessing = useCallback(() => {
    if (stage !== "make") return
    setMode(null)
    setStage("blessing")
  }, [stage])

  const handleCoreClick = useCallback(() => {
    if (stage === "make") goBlessing()
  }, [stage, goBlessing])

  const handleLight = useCallback(() => {
    const text = blessing.trim()
    if (!text) return
    if (!isBlessingAllowed(text)) {
      showToast("寄语包含不被允许的内容，请修改")
      return
    }
    track("light_clicked", { color: colorId })
    const picked = pickSong()
    // 先落盘、后动画（E12/E14）：storage 不可用时走内存降级，流程不中断
    const res = addLantern({
      colorId,
      faceId: face?.id ?? "",
      blessing: text,
      songId: picked.id,
    })
    setLitNo(res.record.no)
    setSong(picked)
    setStage("lighting")
    if (res.trimmed) showToast("本机空间不足，最早的灯将被清理")
  }, [blessing, colorId, face, showToast])

  // ---- hold-to-light: press & hold the lantern ≥900ms to charge it alight.
  // Release / drag / cancel before the threshold decays the charge. The
  // button below stays as the keyboard & fallback path.
  const handleHoldStart = useCallback(() => {
    if (stage !== "blessing" || !blessing.trim()) return
    setCharging(true)
    track("light_hold_started")
    holdFiredRef.current = false
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null
      holdFiredRef.current = true
      setCharging(false)
      track("light_hold_completed", { color: colorId })
      handleLight()
    }, 900)
  }, [stage, blessing, colorId, handleLight])

  const handleHoldCancel = useCallback(() => {
    setCharging(false)
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      if (!holdFiredRef.current) track("light_hold_cancelled")
    }
  }, [])

  // clear a pending hold if the page goes away mid-charge
  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    if (stage !== "lighting") return
    const timer = window.setTimeout(() => {
      setStage("finished")
      track("light_completed", { color: colorId })
    }, LIGHTING_MS)
    return () => window.clearTimeout(timer)
  }, [stage, colorId])

  // seamless bridge: after the finished stillness ("今晚，灯亮了。") the flow
  // auto-advances into the /release ritual — wish page pre-filled, no second
  // arrival gate. replace() so Back never lands on the stillness frame.
  useEffect(() => {
    if (stage !== "finished" || shared) return
    const timer = window.setTimeout(() => {
      track("light_auto_release", { color: colorId })
      router.replace(releaseQuery())
    }, FINISHED_HOLD_MS)
    return () => window.clearTimeout(timer)
  }, [stage, shared, colorId, releaseQuery, router])

  // ---- share card flow (spec: freeze → capture → restore) ----
  // NOTE: the "分享我的灯笼" entry was removed when finished became an
  // auto-advancing stillness — sharing now lives at the end of the /release
  // ritual. The share-stage render below stays for the upcoming lamp album.

  const closeShare = useCallback(() => {
    track("share_closed")
    setCardUrl(null)
    cardCanvasRef.current = null
    setStage("finished")
  }, [])

  // 我也点一盏 — enter the flow with a clean slate (URL param scrubbed)
  const handleRelight = useCallback(() => {
    setShared(null)
    setBlessing("")
    setSong(null)
    window.history.replaceState(null, "", window.location.pathname)
    track("start_clicked")
    setMode("color")
    setStage("make")
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
          blessing: blessing.trim(),
          lanternNo: formatNumber(litNo),
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
  }, [stage, song, blessing, litNo])

  const showFeedback = useCallback((text: string) => {
    setFeedback(text)
    window.setTimeout(() => setFeedback(null), 1500)
  }, [])

  /** 免库分享链接 — 灯的完整配置编码进 URL 参数（相对路径，换域名不失效） */
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
    const text = blessing.trim() ? `我点了一盏灯：「${blessing.trim()}」` : "今晚，灯亮了。"
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
    const text = song ? `今晚，我点亮了一盏灯，听见《${song.title}》。` : "今晚，灯亮了。"
    const url = buildLanternUrl()

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
  }, [song, showFeedback, buildLanternUrl])

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
        color={sceneColor}
        face={sceneFace}
        phase={phase}
        env={env}
        moon
        onCoreClick={handleCoreClick}
        paused={generating}
        captureApiRef={captureApi}
        holdEnabled={stage === "blessing" && !!blessing.trim()}
        charging={charging}
        onHoldStart={handleHoldStart}
        onHoldCancel={handleHoldCancel}
      />

      {/* ---------------- LANDING ---------------- */}
      {stage === "landing" && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-end pb-[11vh]">
          {/* 计数四档文案 — 本机口径，数字永远真实（PRD §7） */}
          <p className="text-xs tracking-[0.3em] text-[#E8E4DA]/60">{counterCopy(count).main}</p>
          <h1 className="mt-4 text-3xl font-light tracking-[0.42em] sm:text-4xl">点一盏灯</h1>
          <p className="mt-3 text-[11px] tracking-[0.4em] text-[#E8E4DA]/55">MAKE IT. LIGHT IT.</p>
          <button
            type="button"
            onClick={handleStart}
            className="pointer-events-auto mt-9 rounded-full px-10 py-3 text-xs tracking-[0.45em] text-[#E8E4DA]/85 outline outline-1 outline-[#E8E4DA]/30 transition-all duration-300 hover:bg-[#E8E4DA]/10 hover:text-[#E8E4DA]"
          >
            ENTER
          </button>
          <p className="mt-5 text-[10px] tracking-[0.25em] text-[#E8E4DA]/40">
            {counterCopy(count).sub}
          </p>
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
            customFace={customFace}
            onDraw={openPainter}
            onDeleteCustom={handleDeleteCustom}
            action={
              /* the CTA is a small wick flame — the fire itself invites the
                 click (hover brightens, click moves to the blessing step) */
              <button
                type="button"
                onClick={goBlessing}
                aria-label="下一步：写祝福"
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
                  写祝福
                </span>
              </button>
            }
          />
        </div>
      )}

      {/* ---------------- FINISHED (own lamp & shared lamp) ---------------- */}
      {stage === "finished" && (shared || song) && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-7 z-10 flex justify-center">
            <span className="text-base text-[#E8E4DA]/55">☾</span>
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-[4vh] text-center">
            {shared && (
              <p className="text-[10px] tracking-[0.35em] text-[#E8E4DA]/40">朋友点亮的灯</p>
            )}
            {/* 本机编号 — No.XXXXX 5 位补零 */}
            <p
              className="mt-1 text-[10px] tracking-[0.35em] text-[#E8E4DA]/40"
              style={{ textShadow: "0 0 20px rgba(255,216,170,calc(var(--lantern-glow,0)*0.4))" }}
            >
              {formatNumber(sceneNo)}
            </p>
            {/* the lantern's own light tints the words — UI and lantern share
                one light source via --lantern-glow (0 unlit → 1 lit) */}
            <p
              className="text-sm tracking-[0.42em] text-[#E8E4DA]/85"
              style={{ textShadow: "0 0 24px rgba(255,216,170,calc(var(--lantern-glow,0)*0.6))" }}
            >
              今晚，灯亮了。
            </p>
            {sceneBlessing && (
              <p className="mt-3.5 max-w-[min(80vw,26em)] text-base leading-relaxed tracking-[0.06em] text-[#E8E4DA]/90">
                「{sceneBlessing}」
              </p>
            )}
            {/* the moon line — own lamp: the lyric lives once, at the memory
                stage of /release (repeating it here made blessing+lyric show
                up twice in one ritual); the shared view has no release ritual
                so it keeps the lyric here */}
            {shared && sceneSong && (
              <>
                <p className="animate-lyric mt-3.5 max-w-[min(80vw,36em)] text-xs font-light leading-relaxed tracking-[0.2em] text-[#E8E4DA]/60">
                  “{sceneSong.moonLyric}”
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
              {/* own lamp: no buttons — the stillness auto-advances into
                  /release after FINISHED_HOLD_MS; sharing happens at the end
                  of that ritual */}
              {shared && (
                <button
                  type="button"
                  onClick={handleRelight}
                  className="rounded-full bg-[#E8E4DA] px-9 py-3 text-sm tracking-[0.3em] text-[#0B1220] transition-colors duration-200 hover:bg-white"
                >
                  我也点一盏
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---------------- BLESSING (独立步骤，20 字上限) ---------------- */}
      {/* container is pointer-transparent so the lantern behind it can be
          pressed & held (hold-to-light); interactive children opt back in */}
      {stage === "blessing" && (
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

          {/* 固定示例句 — 点击直接填入 */}
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

          {/* 本地灵感库（随包内置、零网络请求） */}
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
            onClick={handleLight}
            disabled={!blessing.trim()}
            className="pointer-events-auto mt-9 rounded-full bg-[#E8E4DA] px-12 py-3.5 text-sm tracking-[0.5em] text-[#0B1220] transition-all duration-300 hover:bg-white disabled:opacity-35"
          >
            点亮这盏灯
          </button>
          {!blessing.trim() ? (
            <p className="mt-3 text-[10px] tracking-[0.25em] text-[#E8E4DA]/40">
              写一句祝福，或从上方灵感中挑一句
            </p>
          ) : (
            <p className="mt-3 text-[10px] tracking-[0.25em] text-[#E8E4DA]/40">
              按住灯笼，为它蓄光
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setMode("color")
              setStage("make")
            }}
            className="pointer-events-auto mt-4 text-[10px] tracking-[0.3em] text-[#E8E4DA]/40 transition-colors duration-200 hover:text-[#E8E4DA]/75"
          >
            ‹ 返回修改灯笼
          </button>
        </div>
      )}

      {/* ---------------- SHARE (full-screen, lantern stays lit below) ---------------- */}
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
      {/* toast — soft notices, never error dumps */}
      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-40 flex justify-center">
          <p className="rounded-full bg-black/60 px-5 py-2.5 text-xs tracking-[0.15em] text-[#E8E4DA]/90 backdrop-blur">
            {toast}
          </p>
        </div>
      )}

      {/* 手绘画板 — modal above everything, only reachable from MAKE */}
      {painterOpen && (
        <FacePainter
          colorId={colorId}
          onSaved={handlePainterSaved}
          onClosed={() => setPainterOpen(false)}
        />
      )}

      {/* 署名角标（个人项目定位，PRD 合规精神的轻量版） */}
      <p className="pointer-events-none absolute bottom-2.5 left-4 z-20 text-[9px] tracking-[0.2em] text-[#E8E4DA]/25">
        LANTERN © 2026 · Fan-made · 致敬陈奕迅 · 纯属娱乐  Design by Be Water.
      </p>
    </main>
  )
}
