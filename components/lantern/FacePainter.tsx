"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { getColorById } from "@/lib/lantern/colors"
import { track } from "@/lib/mvp/analytics"

type FacePainterProps = {
  /** city colour the lantern currently wears — ink defaults to its line colour */
  colorId: string
  /** receives the exported PNG dataURL (1024×1024 stroke disc) */
  onSaved: (src: string) => void
  onClosed: () => void
}

const CANVAS_SIZE = 1024
/** brush widths at canvas scale — DTZ strokes read bold at lantern size */
const WIDTHS = [22, 46, 84] as const

/**
 * 彩笔盘 — 首色永远是当前城市的线色（贴纸感，随灯自动适配），
 * 后面是几个在深浅纸面上都读得出的常用色。存的是色值本身，
 * 画的颜色与灯色解耦（P2 彩笔扩展）。
 */
export function inkPalette(defaultInk: string): string[] {
  return [defaultInk, "#E8E4DA", "#C64B33", "#D9A441", "#3D5A80", "#4A7A6F"]
}

type Pt = { x: number; y: number }
type Stroke = { w: number; c: string; pts: Pt[] }

/**
 * 手绘表情画板 — a circular disc matching the DTZ artwork convention:
 * transparent outside the strokes, alpha carries the ink. The exported
 * PNG dataURL drops straight into FacePreset.src — LanternModel loads it
 * like any other face, and the existing inverse-projection remap wraps
 * it onto the paper.
 */
export default function FacePainter({ colorId, onSaved, onClosed }: FacePainterProps) {
  const color = useMemo(() => getColorById(colorId), [colorId])
  const palette = useMemo(() => inkPalette(color.line), [color.line])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef(false)
  const [width, setWidth] = useState<number>(WIDTHS[1])
  const [ink, setInk] = useState<string>(color.line)
  const [count, setCount] = useState(0)

  const ctx = useCallback(
    () => canvasRef.current?.getContext("2d") ?? null,
    [],
  )

  const redrawAll = useCallback(() => {
    const c = ctx()
    if (!c) return
    c.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    c.lineCap = "round"
    c.lineJoin = "round"
    for (const s of strokesRef.current) {
      c.lineWidth = s.w
      c.strokeStyle = s.c
      c.fillStyle = s.c
      if (s.pts.length === 1) {
        // a tap leaves a dot
        c.beginPath()
        c.arc(s.pts[0].x, s.pts[0].y, s.w / 2, 0, Math.PI * 2)
        c.fill()
        continue
      }
      c.beginPath()
      c.moveTo(s.pts[0].x, s.pts[0].y)
      for (let i = 1; i < s.pts.length; i++) c.lineTo(s.pts[i].x, s.pts[i].y)
      c.stroke()
    }
    setCount(strokesRef.current.length)
  }, [ctx])

  const toCanvas = useCallback((e: React.PointerEvent<HTMLCanvasElement>): Pt | null => {
    const el = canvasRef.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const k = CANVAS_SIZE / r.width
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k }
  }, [])

  const handleDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const p = toCanvas(e)
      const c = ctx()
      if (!p || !c) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drawingRef.current = true
      strokesRef.current.push({ w: width, c: ink, pts: [p] })
      // draw the dot immediately
      c.lineCap = "round"
      c.fillStyle = ink
      c.beginPath()
      c.arc(p.x, p.y, width / 2, 0, Math.PI * 2)
      c.fill()
      setCount(strokesRef.current.length)
    },
    [ctx, toCanvas, width, ink],
  )

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return
      const p = toCanvas(e)
      const c = ctx()
      if (!p || !c) return
      const s = strokesRef.current[strokesRef.current.length - 1]
      if (!s) return
      const prev = s.pts[s.pts.length - 1]
      s.pts.push(p)
      c.strokeStyle = s.c
      c.lineWidth = s.w
      c.lineCap = "round"
      c.lineJoin = "round"
      c.beginPath()
      c.moveTo(prev.x, prev.y)
      c.lineTo(p.x, p.y)
      c.stroke()
    },
    [ctx, toCanvas],
  )

  const handleUp = useCallback(() => {
    drawingRef.current = false
  }, [])

  const undo = useCallback(() => {
    strokesRef.current.pop()
    redrawAll()
  }, [redrawAll])

  const clear = useCallback(() => {
    strokesRef.current = []
    redrawAll()
  }, [redrawAll])

  const save = useCallback(() => {
    const el = canvasRef.current
    if (!el || strokesRef.current.length === 0) return
    const src = el.toDataURL("image/png")
    track("face_draw_saved", { color: colorId })
    onSaved(src)
  }, [onSaved, colorId])

  const close = useCallback(() => {
    if (strokesRef.current.length > 0) track("face_draw_cancelled")
    onClosed()
  }, [onClosed])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <div className="w-[min(92vw,380px)] rounded-3xl border border-white/12 bg-[#101828]/95 p-6 text-center">
        <p className="text-sm tracking-[0.42em] text-[#E8E4DA]/90">画一个表情</p>
        <p className="mt-1.5 text-[10px] tracking-[0.25em] text-[#E8E4DA]/45">
          首色随灯色，其余彩笔任选
        </p>

        {/* the disc — backing in the city colour, strokes on a transparent canvas */}
        <div
          className="relative mx-auto mt-5 h-[min(70vw,270px)] w-[min(70vw,270px)] overflow-hidden rounded-full border border-white/15"
          style={{ backgroundColor: color.base }}
        >
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            className="absolute inset-0 h-full w-full touch-none select-none"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            onContextMenu={(e) => e.preventDefault()}
          />
          {count === 0 && (
            <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs tracking-[0.3em] text-black/35">
              在圆盘上画表情
            </p>
          )}
        </div>

        {/* ink palette — first swatch is the city line colour (default) */}
        <div className="mt-4 flex items-center justify-center gap-2.5">
          {palette.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c === palette[0] ? "灯色墨" : `彩笔 ${c}`}
              onClick={() => setInk(c)}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${
                ink === c
                  ? "outline outline-1 outline-[#E8E4DA]/70"
                  : "outline outline-1 outline-transparent hover:bg-white/5"
              }`}
            >
              <span
                className={`block h-4 w-4 rounded-full ${c === "#E8E4DA" ? "border border-white/25" : ""}`}
                style={{ backgroundColor: c }}
              />
            </button>
          ))}
        </div>

        {/* brush width + history controls */}
        <div className="mt-3 flex items-center justify-center gap-5">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-label={w === WIDTHS[0] ? "细笔" : w === WIDTHS[1] ? "中笔" : "粗笔"}
              onClick={() => setWidth(w)}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                width === w
                  ? "bg-white/12 outline outline-1 outline-[#E8E4DA]/60"
                  : "outline outline-1 outline-transparent hover:bg-white/5"
              }`}
            >
              <span
                className="block rounded-full"
                style={{
                  width: 6 + w / 8,
                  height: 6 + w / 8,
                  backgroundColor: ink,
                }}
              />
            </button>
          ))}
          <span className="h-5 w-px bg-white/15" />
          <button
            type="button"
            onClick={undo}
            disabled={count === 0}
            className="text-[11px] tracking-[0.25em] text-[#E8E4DA]/60 transition-colors duration-200 hover:text-[#E8E4DA] disabled:opacity-30"
          >
            撤销
          </button>
          <button
            type="button"
            onClick={clear}
            disabled={count === 0}
            className="text-[11px] tracking-[0.25em] text-[#E8E4DA]/60 transition-colors duration-200 hover:text-[#E8E4DA] disabled:opacity-30"
          >
            清空
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={close}
            className="rounded-full px-8 py-2.5 text-xs tracking-[0.35em] text-[#E8E4DA]/60 outline outline-1 outline-white/15 transition-all duration-200 hover:text-[#E8E4DA]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            disabled={count === 0}
            className="rounded-full bg-[#E8E4DA] px-10 py-2.5 text-xs tracking-[0.35em] text-[#0B1220] transition-all duration-200 hover:bg-white disabled:opacity-35"
          >
            画好了
          </button>
        </div>
      </div>
    </div>
  )
}
