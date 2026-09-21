import type { FaceId, FacePreset } from "./types"
import { textureDrawScale } from "./geometry"

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
 * Amplitude is in world units (lantern diameter = 2).
 */
function wob(n: number, amp: number): number {
  return Math.sin(n * 127.1 + 311.7) * amp
}

/**
 * All drawing happens in WORLD units on the lantern surface
 * (lantern diameter = 2): the caller sets up a canvas transform
 * (textureDrawScale) so circles stay circular and stroke widths
 * stay uniform once mapped onto the sphere.
 */
type FaceBrush = {
  ctx: CanvasRenderingContext2D
  ink: string
}

const LINE_W = 0.07

function strokeSetup(b: FaceBrush, w = LINE_W): void {
  b.ctx.strokeStyle = b.ink
  b.ctx.fillStyle = b.ink
  b.ctx.lineWidth = w
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
  const a = wob(seed, 0.008)
  ctx.beginPath()
  ctx.moveTo(x0 + a, y0 - a * 0.5)
  ctx.quadraticCurveTo(ctrlX + wob(seed + 1, 0.012), ctrlY, x1 - a, y1 + a * 0.5)
  ctx.stroke()
}

function shortDash(b: FaceBrush, x: number, y: number, dx: number, dy: number, seed: number): void {
  const { ctx } = b
  const j = wob(seed, 0.015)
  ctx.beginPath()
  ctx.moveTo(x + j, y - j)
  ctx.lineTo(x + dx + j * 0.5, y + dy)
  ctx.stroke()
}

/* ------------------------------------------------------------------ */
/* DTZ (大头仔)构件 — positions match the lantern reference photos:    */
/* the whole face lives in a round patch on the front of the lantern, */
/* hair curls along the top edge of that patch plus side C shapes.    */
/* ------------------------------------------------------------------ */

const FACE_PATCH_R = 0.52

/** comma curls along the top arc of the face patch + side C shapes */
function hairBand(b: FaceBrush): void {
  const { ctx } = b
  const angles = [-58, -30, 0, 30, 58]
  angles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180
    const x = FACE_PATCH_R * 0.92 * Math.sin(a)
    const y = -0.04 - FACE_PATCH_R * 0.92 * Math.cos(a)
    const flip = i % 2 === 0 ? 1 : -1
    ctx.save()
    ctx.translate(x + wob(70 + i, 0.02), y + wob(80 + i, 0.015))
    ctx.rotate(a * 0.55 * flip)
    ctx.beginPath()
    ctx.arc(0, 0, 0.062, flip > 0 ? -0.1 * Math.PI : 0.1 * Math.PI, flip > 0 ? 0.9 * Math.PI : 1.1 * Math.PI)
    ctx.stroke()
    ctx.restore()
  })
  // side C shapes at cheek height, opening toward the face
  ctx.beginPath()
  ctx.arc(-FACE_PATCH_R - 0.05, -0.02, 0.115, Math.PI * 0.6, Math.PI * 1.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(FACE_PATCH_R + 0.05, -0.02, 0.115, -Math.PI * 0.4, Math.PI * 0.4)
  ctx.stroke()
  shortDash(b, -FACE_PATCH_R - 0.1, -0.36, -0.05, -0.1, 211)
  shortDash(b, -FACE_PATCH_R - 0.08, 0.3, -0.04, 0.12, 218)
  shortDash(b, FACE_PATCH_R + 0.1, -0.36, 0.05, -0.1, 225)
  shortDash(b, FACE_PATCH_R + 0.08, 0.3, 0.04, 0.12, 232)
}

/** arched brow */
function brow(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = 0.11
  handArc(b, x - w, y + 0.02, x + w, y, x, y - 0.06, seed)
}

/** the signature "8" eye — two stacked filled lobes */
function eye8(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.ellipse(x + wob(seed, 0.008), y, 0.048, 0.055, wob(seed + 2, 0.15), 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + wob(seed + 3, 0.008), y + 0.1, 0.06, 0.068, wob(seed + 5, 0.12), 0, Math.PI * 2)
  ctx.fill()
}

/** happy closed eye — the wavy S the reference sheets use for squinting */
function squintEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = 0.075
  handArc(b, x - w, y, x, y + 0.015, x - w * 0.4, y - 0.045, seed)
  handArc(b, x, y + 0.015, x + w, y, x + w * 0.4, y - 0.045, seed + 2)
}

/** bashful closed eye — curve bowing down */
function shyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = 0.075
  handArc(b, x - w, y, x + w, y, x, y + 0.05, seed)
}

/** sleepy droopy flat eye */
function sleepyEye(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = 0.075
  handArc(b, x - w, y - 0.01, x + w, y + 0.005, x, y + 0.015, seed)
}

/** the signature "3" nose — two arcs bulging right */
function nose3(b: FaceBrush, x: number, y: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.arc(x, y + 0.06, 0.058, -Math.PI * 0.55, Math.PI * 0.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y + 0.21, 0.072, -Math.PI * 0.5, Math.PI * 0.5)
  ctx.stroke()
}

/** wide grin with curled-up ends (成都 / 伦敦 mouth) */
function mouthGrin(b: FaceBrush, x: number, y: number, w: number, seed: number): void {
  handArc(b, x - w, y, x + w, y + wob(seed, 0.008), x, y + 0.15, seed + 4)
  handArc(b, x - w, y, x - w - 0.045, y - 0.05, x - w - 0.055, y + 0.01, seed + 6)
  handArc(b, x + w, y + wob(seed, 0.008), x + w + 0.045, y - 0.05, x + w + 0.055, y + 0.01, seed + 8)
}

/** plain smile arc */
function mouthSmile(b: FaceBrush, x: number, y: number, w: number, seed: number): void {
  handArc(b, x - w, y, x + w, y + wob(seed, 0.008), x, y + 0.09, seed + 4)
}

/** unsure wavy mouth (悉尼 / 横滨) */
function mouthWavy(b: FaceBrush, x: number, y: number): void {
  const w = 0.16
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.quadraticCurveTo(x - w * 0.5, y + 0.05, x, y)
  ctx.quadraticCurveTo(x + w * 0.5, y - 0.05, x + w, y + 0.01)
  ctx.stroke()
}

/** pout lips (澳门) — wide wave with a centre dip plus a lower dash */
function mouthPout(b: FaceBrush, x: number, y: number, seed: number): void {
  const w = 0.17
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - w, y)
  ctx.quadraticCurveTo(x - w * 0.5, y + 0.045, x, y + 0.01)
  ctx.quadraticCurveTo(x + w * 0.5, y + 0.045, x + w, y)
  ctx.stroke()
  handArc(b, x - 0.05, y + 0.12, x + 0.05, y + 0.12, x, y + 0.16, seed + 4)
}

/** open laughing mouth with a tongue notch (北京) */
function mouthOpen(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  const w = 0.13
  const h = 0.12
  ctx.beginPath()
  ctx.moveTo(x - w + wob(seed, 0.008), y)
  ctx.quadraticCurveTo(x - w * 0.6, y + h * 1.15, x, y + h)
  ctx.quadraticCurveTo(x + w * 0.6, y + h * 1.15, x + w, y + wob(seed + 1, 0.008))
  ctx.quadraticCurveTo(x, y - h * 0.22, x - w, y)
  ctx.fill()
}

/** small o mouth */
function mouthO(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.ellipse(x, y, 0.045, 0.055, wob(seed, 0.2), 0, Math.PI * 2)
  ctx.stroke()
}

/** small chin dash below the mouth */
function chinDash(b: FaceBrush, x: number, y: number): void {
  handArc(b, x - 0.045, y, x + 0.045, y, x, y + 0.025, 301)
}

/** shy blush dashes on the cheeks */
function blushStrokes(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  ctx.save()
  ctx.lineWidth = LINE_W * 0.75
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 0.045
    ctx.beginPath()
    ctx.moveTo(x + dx + wob(seed + i, 0.006), y - 0.025)
    ctx.lineTo(x + dx + 0.025 + wob(seed + i + 3, 0.006), y + 0.025)
    ctx.stroke()
  }
  ctx.restore()
}

const EYE_DX = 0.22

type DrawFace = (b: FaceBrush) => void

const FACE_DRAWERS: Record<FaceId, DrawFace> = {
  laugh(b) {
    strokeSetup(b)
    hairBand(b)
    brow(b, -EYE_DX, -0.18, 41)
    brow(b, EYE_DX, -0.18, 47)
    eye8(b, -EYE_DX, 0, 11)
    eye8(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthGrin(b, 0, 0.36, 0.2, 31)
    chinDash(b, 0, 0.54)
  },
  happy(b) {
    strokeSetup(b)
    hairBand(b)
    brow(b, -EYE_DX, -0.18, 41)
    brow(b, EYE_DX, -0.18, 47)
    eye8(b, -EYE_DX, 0, 11)
    eye8(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthOpen(b, 0, 0.35, 31)
    chinDash(b, 0, 0.52)
  },
  smile(b) {
    strokeSetup(b)
    hairBand(b)
    eye8(b, -EYE_DX, 0, 11)
    eye8(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthSmile(b, 0, 0.36, 0.11, 31)
    chinDash(b, 0, 0.52)
  },
  squint(b) {
    strokeSetup(b)
    hairBand(b)
    squintEye(b, -EYE_DX, 0, 11)
    squintEye(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthGrin(b, 0, 0.36, 0.17, 31)
    chinDash(b, 0, 0.54)
  },
  neutral(b) {
    strokeSetup(b)
    hairBand(b)
    brow(b, -EYE_DX, -0.18, 41)
    brow(b, EYE_DX, -0.18, 47)
    eye8(b, -EYE_DX, 0, 11)
    eye8(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthWavy(b, 0, 0.37)
    chinDash(b, 0, 0.52)
  },
  surprised(b) {
    strokeSetup(b)
    hairBand(b)
    brow(b, -EYE_DX, -0.22, 41)
    brow(b, EYE_DX, -0.22, 47)
    eye8(b, -EYE_DX, 0, 11)
    eye8(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthPout(b, 0, 0.36, 31)
  },
  shy(b) {
    strokeSetup(b)
    hairBand(b)
    shyEye(b, -EYE_DX, 0, 11)
    shyEye(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthSmile(b, 0, 0.36, 0.08, 31)
    blushStrokes(b, -0.42, 0.1, 61)
    blushStrokes(b, 0.42, 0.1, 71)
    chinDash(b, 0, 0.52)
  },
  sleepy(b) {
    strokeSetup(b)
    hairBand(b)
    sleepyEye(b, -EYE_DX, 0, 11)
    sleepyEye(b, EYE_DX, 0, 23)
    nose3(b, 0.02, 0.02)
    mouthO(b, 0, 0.36, 31)
  },
}

/**
 * FacePreset -> canvas. Drawn in world units through the UV-correcting
 * transform so the face appears round and undistorted on the sphere.
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
  const { sx, sy } = textureDrawScale(canvas.width)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height * 0.5)
  ctx.scale(sx, sy)
  drawer({ ctx, ink })
  ctx.restore()
}
