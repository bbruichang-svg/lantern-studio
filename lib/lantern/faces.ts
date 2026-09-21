import type { FaceId, FacePreset } from "./types"

export const FACE_PRESETS: readonly FacePreset[] = [
  { id: "happy", name: "开心" },
  { id: "smile", name: "微笑" },
  { id: "squint", name: "眯眼" },
  { id: "surprised", name: "惊讶" },
  { id: "shy", name: "害羞" },
  { id: "sleepy", name: "困倦" },
  { id: "laugh", name: "大笑" },
  { id: "neutral", name: "普通" },
] as const

export const FACE_INK = "#211C1A"

/**
 * Deterministic hand wobble — keeps strokes slightly imperfect
 * but identical on every redraw (no random flicker between frames).
 */
function wob(n: number, amp: number): number {
  return Math.sin(n * 127.1 + 311.7) * amp
}

type FaceBrush = {
  ctx: CanvasRenderingContext2D
  /** half-width of the face area in px */
  s: number
}

function strokeSetup(b: FaceBrush, widthScale = 0.075): void {
  b.ctx.strokeStyle = FACE_INK
  b.ctx.fillStyle = FACE_INK
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

function dotEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  const r = b.s * 0.055
  ctx.beginPath()
  ctx.ellipse(
    x + wob(seed, r * 0.18),
    y + wob(seed + 3, r * 0.18),
    r * (1 + wob(seed + 5, 0.06)),
    r * (1 + wob(seed + 7, 0.06)),
    wob(seed + 9, 0.2),
    0,
    Math.PI * 2,
  )
  ctx.fill()
}

function ringEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  const r = b.s * 0.1
  ctx.beginPath()
  ctx.ellipse(
    x + wob(seed, r * 0.12),
    y + wob(seed + 2, r * 0.12),
    r,
    r * 1.12,
    wob(seed + 4, 0.15),
    0,
    Math.PI * 2,
  )
  ctx.stroke()
  dotEye(b, x, y, seed + 6)
}

/** Happy closed eye: curve bowing up, like ⌒. */
function happyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.2
  handArc(b, x - w, y, x + w, y + wob(seed, b.s * 0.01), x, y - b.s * 0.16, seed)
}

/** Bashful closed eye: curve bowing down, like ⌣. */
function shyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.18
  handArc(b, x - w, y, x + w, y, x, y + b.s * 0.11, seed)
}

/** Sleepy droopy lid: flat line with a small sag and a tiny lash. */
function sleepyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = b.s * 0.18
  handArc(b, x - w, y - b.s * 0.02, x + w, y + b.s * 0.015, x, y + b.s * 0.03, seed)
  handArc(b, x + w * 0.7, y + b.s * 0.015, x + w * 0.95, y + b.s * 0.07, x + w * 0.9, y + b.s * 0.05, seed + 2)
}

function blushStrokes(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  ctx.save()
  ctx.lineWidth = b.s * 0.035
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * b.s * 0.06
    ctx.beginPath()
    ctx.moveTo(x + dx + wob(seed + i, b.s * 0.01), y - b.s * 0.045)
    ctx.lineTo(x + dx + b.s * 0.035 + wob(seed + i + 3, b.s * 0.01), y + b.s * 0.045)
    ctx.stroke()
  }
  ctx.restore()
}

function smileMouth(b: FaceBrush, x: number, y: number, widthScale: number, depthScale: number, seed: number): void {
  const w = b.s * widthScale
  handArc(b, x - w, y, x + w, y + wob(seed, b.s * 0.012), x, y + b.s * depthScale, seed + 4)
}

function openMouth(b: FaceBrush, x: number, y: number, w: number, h: number, seed: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - w + wob(seed, w * 0.08), y)
  ctx.quadraticCurveTo(x - w * 0.6, y + h * 1.15, x, y + h)
  ctx.quadraticCurveTo(x + w * 0.6, y + h * 1.15, x + w, y + wob(seed + 1, w * 0.08))
  ctx.quadraticCurveTo(x, y - h * 0.22, x - w, y)
  ctx.fill()
}

function oMouth(b: FaceBrush, x: number, y: number, r: number, seed: number): void {
  b.ctx.beginPath()
  b.ctx.ellipse(x, y, r * 0.85, r * 1.05, wob(seed, 0.2), 0, Math.PI * 2)
  b.ctx.stroke()
}

const EYE_DX = 0.42
const EYE_Y = -0.16
const MOUTH_Y = 0.32

type DrawFace = (b: FaceBrush, cx: number, cy: number) => void

const FACE_DRAWERS: Record<FaceId, DrawFace> = {
  happy(b, cx, cy) {
    strokeSetup(b)
    happyEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    happyEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    openMouth(b, cx, cy + b.s * MOUTH_Y, b.s * 0.24, b.s * 0.22, 31)
  },
  smile(b, cx, cy) {
    strokeSetup(b)
    dotEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    dotEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    smileMouth(b, cx, cy + b.s * MOUTH_Y, 0.2, 0.14, 31)
  },
  squint(b, cx, cy) {
    strokeSetup(b)
    // wavy ~ eyes
    for (const [dx, seed] of [[-1, 11], [1, 23]] as const) {
      const x = cx + dx * b.s * EYE_DX
      const y = cy + b.s * EYE_Y
      const w = b.s * 0.19
      handArc(b, x - w, y, x, y - b.s * 0.02, x - w * 0.5, y - b.s * 0.1, seed)
      handArc(b, x, y - b.s * 0.02, x + w, y, x + w * 0.5, y - b.s * 0.1, seed + 2)
    }
    smileMouth(b, cx, cy + b.s * MOUTH_Y, 0.14, 0.08, 31)
  },
  surprised(b, cx, cy) {
    strokeSetup(b)
    ringEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    ringEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    // raised brows
    const w = b.s * 0.15
    handArc(b, cx - b.s * EYE_DX - w, cy + b.s * (EYE_Y - 0.24), cx - b.s * EYE_DX + w, cy + b.s * (EYE_Y - 0.26), cx - b.s * EYE_DX, cy + b.s * (EYE_Y - 0.36), 41)
    handArc(b, cx + b.s * EYE_DX - w, cy + b.s * (EYE_Y - 0.26), cx + b.s * EYE_DX + w, cy + b.s * (EYE_Y - 0.24), cx + b.s * EYE_DX, cy + b.s * (EYE_Y - 0.36), 47)
    oMouth(b, cx, cy + b.s * MOUTH_Y, b.s * 0.11, 53)
  },
  shy(b, cx, cy) {
    strokeSetup(b)
    shyEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    shyEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    smileMouth(b, cx, cy + b.s * MOUTH_Y, 0.12, 0.07, 31)
    blushStrokes(b, cx - b.s * 0.62, cy + b.s * 0.02, 61)
    blushStrokes(b, cx + b.s * 0.62, cy + b.s * 0.02, 71)
  },
  sleepy(b, cx, cy) {
    strokeSetup(b)
    sleepyEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    sleepyEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    oMouth(b, cx, cy + b.s * MOUTH_Y, b.s * 0.07, 31)
  },
  laugh(b, cx, cy) {
    strokeSetup(b)
    happyEye(b, cx - b.s * EYE_DX, cy + b.s * (EYE_Y - 0.02), 11)
    happyEye(b, cx + b.s * EYE_DX, cy + b.s * (EYE_Y - 0.02), 23)
    openMouth(b, cx, cy + b.s * MOUTH_Y, b.s * 0.3, b.s * 0.26, 31)
    // a hint of teeth
    const { ctx } = b
    ctx.save()
    ctx.strokeStyle = "rgba(232,225,214,0.9)"
    ctx.lineWidth = b.s * 0.03
    ctx.beginPath()
    ctx.moveTo(cx - b.s * 0.16, cy + b.s * MOUTH_Y + b.s * 0.03)
    ctx.quadraticCurveTo(cx, cy + b.s * MOUTH_Y + b.s * 0.06, cx + b.s * 0.16, cy + b.s * MOUTH_Y + b.s * 0.03)
    ctx.stroke()
    ctx.restore()
  },
  neutral(b, cx, cy) {
    strokeSetup(b)
    dotEye(b, cx - b.s * EYE_DX, cy + b.s * EYE_Y, 11)
    dotEye(b, cx + b.s * EYE_DX, cy + b.s * EYE_Y, 23)
    // almost straight mouth with the faintest lift at the ends
    const w = b.s * 0.16
    handArc(b, cx - w, cy + b.s * MOUTH_Y, cx + w, cy + b.s * MOUTH_Y, cx, cy + b.s * (MOUTH_Y + 0.03), 31)
  },
}

/**
 * FacePreset -> canvas. Kept as a single entry point so V2 can
 * compose eyes / mouth / details independently later.
 */
export function renderFaceToCanvas(canvas: HTMLCanvasElement, face: FacePreset | null): void {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  if (!face) return
  const drawer = FACE_DRAWERS[face.id]
  if (!drawer) return
  const cx = canvas.width / 2
  const cy = canvas.height * 0.46
  // face scale unit: ~0.18 of canvas width keeps the face inside
  // the middle ~35% of the circumference on the lantern UV map
  drawer({ ctx, s: canvas.width * 0.18 }, cx, cy)
}
