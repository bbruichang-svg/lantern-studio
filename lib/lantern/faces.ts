import type { FaceId, FacePreset } from "./types"

export const FACE_PRESETS: readonly FacePreset[] = [
  { id: "laugh", name: "大笑" },
  { id: "happy", name: "开心" },
  { id: "smile", name: "微笑" },
  { id: "squint", name: "眯眼" },
  { id: "neutral", name: "普通" },
  { id: "surprised", name: "惊讶" },
  { id: "shy", name: "害羞" },
  { id: "sleepy", name: "困倦" },
] as const

/** neutral ink for thumbnails; the lantern itself uses the colour-matched line */
export const FACE_INK = "#2A2420"

/**
 * Deterministic hand wobble — keeps strokes slightly imperfect
 * but identical on every redraw (no random flicker between frames).
 */
function wob(n: number, amp: number): number {
  return Math.sin(n * 127.1 + 311.7) * amp
}

type FaceBrush = {
  ctx: CanvasRenderingContext2D
  /** feature scale unit in px */
  s: number
  ink: string
}

function strokeSetup(b: FaceBrush, widthScale = 0.17): void {
  b.ctx.strokeStyle = b.ink
  b.ctx.fillStyle = b.ink
  b.ctx.lineWidth = b.s * widthScale
  b.ctx.lineCap = "round"
  b.ctx.lineJoin = "round"
}

/** Slightly imperfect hand-drawn arc between two points. */
function handArc(
  b: FaceBrush,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ctrlX: number,
  ctrlY: number,
  seed: number,
): void {
  const { ctx } = b
  const a = wob(seed, b.s * 0.012)
  ctx.beginPath()
  ctx.moveTo(x0 + a, y0 - a * 0.5)
  ctx.quadraticCurveTo(ctrlX + wob(seed + 1, b.s * 0.02), ctrlY, x1 - a, y1 + a * 0.5)
  ctx.stroke()
}

function shortDash(b: FaceBrush, x: number, y: number, dx: number, dy: number, seed: number): void {
  const { ctx } = b
  const j = wob(seed, b.s * 0.03)
  ctx.beginPath()
  ctx.moveTo(x + j, y - j)
  ctx.lineTo(x + dx + j * 0.5, y + dy)
  ctx.stroke()
}

/* ------------------------------------------------------------------ */
/* DTZ (大头仔)构件 — shared parts of every face                       */
/* ------------------------------------------------------------------ */

/** curly hair band wrapping the whole lantern above the face */
function hairBand(b: FaceBrush, cy: number): void {
  const { ctx, s } = b
  const W = ctx.canvas.width
  const step = s * 0.62
  for (let x = step * 0.4, i = 0; x < W; x += step, i++) {
    const seed = 100 + i * 7
    const y = cy + wob(seed, s * 0.06)
    if (i % 4 === 3) {
      // occasional dash between curls, like the reference sheets
      shortDash(b, x, y - s * 0.34, s * 0.04, s * 0.3, seed + 1)
      continue
    }
    const dir = wob(seed + 2, 1) > 0 ? 1 : -1
    ctx.beginPath()
    ctx.moveTo(x + dir * s * 0.06, y + s * 0.2)
    ctx.quadraticCurveTo(x - dir * s * 0.1, y - s * 0.16, x + dir * s * 0.16, y - s * 0.24)
    ctx.quadraticCurveTo(x + dir * s * 0.36, y - s * 0.26, x + dir * s * 0.3, y - s * 0.04)
    ctx.stroke()
  }
  // side C shapes at head height, opening toward the face
  const cx = W / 2
  const eyeY = cy + s * 0.05
  ctx.beginPath()
  ctx.arc(cx - s * 1.5, eyeY, s * 0.3, Math.PI * 0.62, Math.PI * 1.38)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + s * 1.5, eyeY, s * 0.3, -Math.PI * 0.38, Math.PI * 0.38)
  ctx.stroke()
  shortDash(b, cx - s * 1.72, eyeY - s * 0.52, -s * 0.08, -s * 0.16, 201)
  shortDash(b, cx - s * 1.68, eyeY + s * 0.42, -s * 0.06, s * 0.18, 208)
  shortDash(b, cx + s * 1.72, eyeY - s * 0.52, s * 0.08, -s * 0.16, 215)
  shortDash(b, cx + s * 1.68, eyeY + s * 0.42, s * 0.06, s * 0.18, 222)
}

/** arched brow */
function brow(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.22
  handArc(b, x - w, y + b.s * 0.03, x + w, y, x, y - b.s * 0.12, seed)
}

/** the signature "8" eye — two stacked filled lobes */
function eye8(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx, s } = b
  const r1 = s * 0.085
  const r2 = s * 0.115
  ctx.beginPath()
  ctx.ellipse(x + wob(seed, r1 * 0.2), y, r1, r1 * 1.08, wob(seed + 2, 0.15), 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + wob(seed + 3, r2 * 0.16), y + s * 0.17, r2, r2 * 1.05, wob(seed + 5, 0.12), 0, Math.PI * 2)
  ctx.fill()
}

/** happy closed eye — the wavy S the reference sheets use for squinting */
function squintEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.17
  handArc(b, x - w, y, x, y + b.s * 0.03, x - w * 0.4, y - b.s * 0.1, seed)
  handArc(b, x, y + b.s * 0.03, x + w, y, x + w * 0.4, y - b.s * 0.1, seed + 2)
}

/** bashful closed eye — curve bowing down */
function shyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.17
  handArc(b, x - w, y, x + w, y, x, y + b.s * 0.1, seed)
}

/** sleepy droopy flat eye */
function sleepyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.17
  handArc(b, x - w, y - b.s * 0.02, x + w, y + b.s * 0.01, x, y + b.s * 0.03, seed)
}

/** the signature "3" nose — two arcs bulging right */
function nose3(b: FaceBrush, x: number, y: number): void {
  const { ctx, s } = b
  ctx.beginPath()
  ctx.arc(x, y + s * 0.14, s * 0.13, -Math.PI * 0.55, Math.PI * 0.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y + s * 0.44, s * 0.15, -Math.PI * 0.5, Math.PI * 0.5)
  ctx.stroke()
}

/** wide grin with curled-up ends (成都 / 伦敦 mouth) */
function mouthGrin(b: FaceBrush, x: number, y: number, wScale: number, seed: number): void {
  const { s } = b
  const w = s * wScale
  handArc(b, x - w, y, x + w, y + wob(seed, s * 0.012), x, y + s * 0.3, seed + 4)
  handArc(b, x - w, y, x - w - s * 0.07, y - s * 0.1, x - w - s * 0.1, y + s * 0.02, seed + 6)
  handArc(b, x + w, y + wob(seed, s * 0.012), x + w + s * 0.07, y - s * 0.1, x + w + s * 0.1, y + s * 0.02, seed + 8)
}

/** plain smile arc */
function mouthSmile(b: FaceBrush, x: number, y: number, wScale: number, seed: number): void {
  const w = b.s * wScale
  handArc(b, x - w, y, x + w, y + wob(seed, b.s * 0.012), x, y + b.s * 0.16, seed + 4)
}

/** unsure wavy mouth (悉尼 / 横滨) */
function mouthWavy(b: FaceBrush, x: number, y: number): void {
  const { s } = b
  const w = s * 0.3
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.quadraticCurveTo(x - w * 0.5, y + s * 0.1, x, y)
  ctx.quadraticCurveTo(x + w * 0.5, y - s * 0.1, x + w, y + s * 0.02)
  ctx.stroke()
}

/** pout lips (澳门) — wide wave with a centre dip plus a lower dash */
function mouthPout(b: FaceBrush, x: number, y: number, seed: number): void {
  const { s, ctx } = b
  const w = s * 0.32
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.quadraticCurveTo(x - w * 0.5, y + s * 0.09, x, y + s * 0.02)
  ctx.quadraticCurveTo(x + w * 0.5, y + s * 0.09, x + w, y)
  ctx.stroke()
  handArc(b, x - s * 0.1, y + s * 0.24, x + s * 0.1, y + s * 0.24, x, y + s * 0.3, seed + 4)
}

/** open laughing mouth with a tongue notch (北京) */
function mouthOpen(b: FaceBrush, x: number, y: number, seed: number): void {
  const { s, ctx } = b
  const w = s * 0.26
  const h = s * 0.24
  ctx.beginPath()
  ctx.moveTo(x - w + wob(seed, w * 0.08), y)
  ctx.quadraticCurveTo(x - w * 0.6, y + h * 1.15, x, y + h)
  ctx.quadraticCurveTo(x + w * 0.6, y + h * 1.15, x + w, y + wob(seed + 1, w * 0.08))
  ctx.quadraticCurveTo(x, y - h * 0.22, x - w, y)
  ctx.fill()
}

/** small o mouth */
function mouthO(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx, s } = b
  ctx.beginPath()
  ctx.ellipse(x, y, s * 0.09, s * 0.11, wob(seed, 0.2), 0, Math.PI * 2)
  ctx.stroke()
}

/** small chin dash below the mouth */
function chinDash(b: FaceBrush, x: number, y: number): void {
  handArc(b, x - b.s * 0.09, y, x + b.s * 0.09, y, x, y + b.s * 0.05, 301)
}

/** shy blush dashes on the cheeks */
function blushStrokes(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx, s } = b
  ctx.save()
  ctx.lineWidth = s * 0.07
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * s * 0.09
    ctx.beginPath()
    ctx.moveTo(x + dx + wob(seed + i, s * 0.012), y - s * 0.05)
    ctx.lineTo(x + dx + s * 0.05 + wob(seed + i + 3, s * 0.012), y + s * 0.05)
    ctx.stroke()
  }
  ctx.restore()
}

const EYE_DX = 0.42
const EYE_Y = -0.14

type DrawFace = (b: FaceBrush, cx: number, cy: number) => void

const FACE_DRAWERS: Record<FaceId, DrawFace> = {
  laugh(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    brow(b, cx - b.s * EYE_DX, cy + b.s * -0.44, 41)
    brow(b, cx + b.s * EYE_DX, cy + b.s * -0.44, 47)
    eye8(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    eye8(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthGrin(b, cx, cy + b.s * 0.62, 0.42, 31)
    chinDash(b, cx, cy + b.s * 1.06)
  },
  happy(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    brow(b, cx - b.s * EYE_DX, cy + b.s * -0.44, 41)
    brow(b, cx + b.s * EYE_DX, cy + b.s * -0.44, 47)
    eye8(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    eye8(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthOpen(b, cx, cy + b.s * 0.6, 31)
    chinDash(b, cx, cy + b.s * 1.02)
  },
  smile(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    eye8(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    eye8(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthSmile(b, cx, cy + b.s * 0.62, 0.22, 31)
    chinDash(b, cx, cy + b.s * 1.0)
  },
  squint(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    squintEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    squintEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthGrin(b, cx, cy + b.s * 0.62, 0.36, 31)
    chinDash(b, cx, cy + b.s * 1.06)
  },
  neutral(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    brow(b, cx - b.s * EYE_DX, cy + b.s * -0.44, 41)
    brow(b, cx + b.s * EYE_DX, cy + b.s * -0.44, 47)
    eye8(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    eye8(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthWavy(b, cx, cy + b.s * 0.64)
    chinDash(b, cx, cy + b.s * 1.02)
  },
  surprised(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    brow(b, cx - b.s * EYE_DX, cy + b.s * -0.5, 41)
    brow(b, cx + b.s * EYE_DX, cy + b.s * -0.5, 47)
    eye8(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    eye8(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthPout(b, cx, cy + b.s * 0.62, 31)
  },
  shy(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    shyEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    shyEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthSmile(b, cx, cy + b.s * 0.62, 0.16, 31)
    blushStrokes(b, cx - b.s * 0.82, cy + b.s * 0.12, 61)
    blushStrokes(b, cx + b.s * 0.82, cy + b.s * 0.12, 71)
    chinDash(b, cx, cy + b.s * 1.0)
  },
  sleepy(b, cx, cy) {
    strokeSetup(b)
    hairBand(b, cy - b.s * 1.2)
    sleepyEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    sleepyEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    nose3(b, cx + b.s * 0.04, cy + b.s * 0.1)
    mouthO(b, cx, cy + b.s * 0.62, 31)
  },
}

/**
 * FacePreset -> canvas. Kept as a single entry point so V2 can
 * compose eyes / mouth / details independently later.
 * `ink` lets the stroke follow the lantern colour (DTZ rule:
 * stroke = darker — sometimes lighter — shade of the base).
 */
export function renderFaceToCanvas(canvas: HTMLCanvasElement, face: FacePreset | null, ink: string = FACE_INK): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!face) return
  const drawer = FACE_DRAWERS[face.id]
  if (!drawer) return
  const cx = canvas.width / 2
  const cy = canvas.height * 0.47
  drawer({ ctx, s: canvas.width * 0.2, ink }, cx, cy)
}
