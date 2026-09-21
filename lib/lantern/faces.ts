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

/**
 * DTZ source artwork uses near-black ink on every standard colour
 * (only the inverted designs specify their own line colour).
 */
export const FACE_INK = "#221A14"

/**
 * Deterministic hand wobble — keeps strokes slightly imperfect
 * but identical on every redraw (no random flicker between frames).
 * Amplitude is in world units (lantern radius = 1).
 */
function wob(n: number, amp: number): number {
  return Math.sin(n * 127.1 + 311.7) * amp
}

/**
 * All drawing happens in WORLD units on the lantern surface through
 * the caller's UV-correcting transform (textureDrawScale), so circles
 * stay circular and stroke widths stay uniform on the sphere.
 */
type FaceBrush = {
  ctx: CanvasRenderingContext2D
  ink: string
}

/**
 * Face patch radius in world units. The DTZ face fills the whole
 * artwork circle, and the构件 ring reaches 0.65–0.99 of that radius
 * (measured from the source PNGs), so the patch is large on the body.
 */
const F = 0.85

/** DTZ stroke ≈ 4.5% of the face radius (measured from source PNGs) */
const LINE_W = 0.045 * F

function strokeSetup(b: FaceBrush, w = LINE_W): void {
  b.ctx.strokeStyle = b.ink
  b.ctx.fillStyle = b.ink
  b.ctx.lineWidth = w
  b.ctx.lineCap = "round"
  b.ctx.lineJoin = "round"
}

/* ------------------------------------------------------------------ */
/* DTZ 构件 — positions & sizes measured from the source artwork       */
/* (connected-component analysis of 2成都-1.png, face-radius units,    */
/*  y+ = down, face centre = origin).                                  */
/* ------------------------------------------------------------------ */

/** comma curls along the top arc — measured ring 0.58–0.72R, outer pair bigger */
function hairCurls(b: FaceBrush): void {
  const { ctx } = b
  const curls = [
    { x: -0.69, y: -0.71, r: 0.115, dir: 1 },
    { x: -0.56, y: -0.47, r: 0.095, dir: -1 },
    { x: -0.32, y: -0.56, r: 0.09, dir: 1 },
    { x: -0.12, y: -0.57, r: 0.085, dir: -1 },
    { x: 0.09, y: -0.65, r: 0.095, dir: 1 },
    { x: 0.3, y: -0.59, r: 0.085, dir: -1 },
    { x: 0.52, y: -0.48, r: 0.095, dir: 1 },
    { x: 0.67, y: -0.71, r: 0.11, dir: -1 },
  ]
  for (let i = 0; i < curls.length; i++) {
    const c = curls[i]
    const x = c.x * F + wob(70 + i, 0.012)
    const y = c.y * F + wob(80 + i, 0.012)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(c.dir * (0.35 + wob(90 + i, 0.2)))
    ctx.beginPath()
    const r = c.r * F
    const a0 = c.dir > 0 ? -0.15 * Math.PI : 0.65 * Math.PI
    ctx.arc(0, 0, r, a0, a0 + 1.25 * Math.PI)
    ctx.stroke()
    ctx.restore()
  }
}

/** one side's stack (measured): 2 tilted dashes, big C, し hook */
function sideGroup(b: FaceBrush, s: 1 | -1): void {
  const { ctx } = b
  // dashes: top end toward the face, bottom end outward
  ctx.beginPath()
  ctx.moveTo(s * 0.585 * F, -0.34 * F)
  ctx.lineTo(s * 0.715 * F, -0.24 * F)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(s * 0.61 * F, -0.23 * F)
  ctx.lineTo(s * 0.71 * F, -0.13 * F)
  ctx.stroke()
  // big C — bulges outward, opens toward the face, at y ≈ +0.05
  ctx.beginPath()
  if (s > 0) ctx.arc(0.7 * F, 0.05 * F, 0.115 * F, -1.15, 1.15)
  else ctx.arc(-0.7 * F, 0.05 * F, 0.115 * F, Math.PI - 1.15, Math.PI + 1.15)
  ctx.stroke()
  // し hook at y ≈ +0.62: vertical stroke curving into an outward foot
  ctx.beginPath()
  ctx.moveTo(s * 0.61 * F, 0.47 * F)
  ctx.quadraticCurveTo(s * 0.6 * F, 0.75 * F, s * 0.83 * F, 0.68 * F)
  ctx.stroke()
}

/** the signature solid peanut "8" eye — measured: upper lobe 0.062/0.068R,
 *  lower lobe 0.075/0.092R, centres 0.12R apart, eyes at (±0.20R, +0.05R) */
function eye8(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.ellipse(x + wob(seed, 0.008), y - 0.12 * F, 0.062 * F, 0.068 * F, wob(seed + 2, 0.12), 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(x + wob(seed + 3, 0.008), y + 0.05 * F, 0.075 * F, 0.092 * F, wob(seed + 5, 0.1), 0, Math.PI * 2)
  ctx.fill()
}

/** happy closed eye — arc bowing up (∩) at the eye position */
function squintEye(b: FaceBrush, x: number, y: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - 0.09 * F, y + 0.03 * F)
  ctx.quadraticCurveTo(x, y - 0.09 * F, x + 0.09 * F, y + 0.03 * F)
  ctx.stroke()
}

/** bashful closed eye — arc bowing down (⌣) */
function shyEye(b: FaceBrush, x: number, y: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - 0.085 * F, y - 0.02 * F)
  ctx.quadraticCurveTo(x, y + 0.06 * F, x + 0.085 * F, y - 0.02 * F)
  ctx.stroke()
}

/** sleepy droopy flat eye */
function sleepyEye(b: FaceBrush, x: number, y: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(x - 0.085 * F, y)
  ctx.quadraticCurveTo(x, y + 0.03 * F, x + 0.085 * F, y - 0.01 * F)
  ctx.stroke()
}

/** tilted brow (measured: centre ±0.26R/-0.20R, bbox 0.24×0.15R,
 *  inner end high with a small down-hook, bowing up) */
function brow(b: FaceBrush, s: 1 | -1): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(s * 0.38 * F, -0.125 * F)
  ctx.quadraticCurveTo(s * 0.27 * F, -0.3 * F, s * 0.155 * F, -0.26 * F)
  ctx.stroke()
  // small hook at the inner tip, curling down toward the eye
  ctx.beginPath()
  ctx.moveTo(s * 0.155 * F, -0.26 * F)
  ctx.quadraticCurveTo(s * 0.12 * F, -0.245 * F, s * 0.135 * F, -0.19 * F)
  ctx.stroke()
}

/** the DTZ nose — ONE comma-hook stroke (measured from the source):
 *  horizontal top bowing slightly up → right end turns down → tail
 *  hooks back down-left with a blunt tip; tucks under the right eye */
function nose(b: FaceBrush): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(-0.07 * F + wob(301, 0.01), 0.03 * F)
  ctx.bezierCurveTo(0.05 * F, -0.05 * F, 0.17 * F, -0.05 * F, 0.25 * F, 0.04 * F)
  ctx.quadraticCurveTo(0.31 * F, 0.11 * F, 0.26 * F, 0.2 * F)
  ctx.quadraticCurveTo(0.22 * F, 0.28 * F, 0.12 * F, 0.3 * F)
  ctx.stroke()
}

/** wide grin (成都, measured: span ±0.345R, bottom +0.58R,
 *  tips curl up-and-out with fat round ends) */
function mouthGrin(b: FaceBrush): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(-0.3 * F, 0.32 * F)
  ctx.quadraticCurveTo(0, 0.8 * F, 0.3 * F, 0.32 * F)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-0.3 * F, 0.32 * F)
  ctx.quadraticCurveTo(-0.375 * F, 0.315 * F, -0.34 * F, 0.245 * F)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0.3 * F, 0.32 * F)
  ctx.quadraticCurveTo(0.375 * F, 0.315 * F, 0.34 * F, 0.245 * F)
  ctx.stroke()
}

/** plain smile arc (smaller, no curled tips) */
function mouthSmile(b: FaceBrush, w = 0.2): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(-w * F, 0.4 * F)
  ctx.quadraticCurveTo(0, (0.4 + w * 0.75) * F, w * F, 0.4 * F)
  ctx.stroke()
}

/** sad frown (广州) — wide ⌢, middle up, ends down */
function mouthFrown(b: FaceBrush): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(-0.27 * F, 0.5 * F)
  ctx.quadraticCurveTo(0, 0.37 * F, 0.27 * F, 0.5 * F)
  ctx.stroke()
}

/** pout (澳门) — the ω beak: two humps with a centre dip */
function mouthPout(b: FaceBrush): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(-0.21 * F, 0.43 * F)
  ctx.quadraticCurveTo(-0.11 * F, 0.34 * F, 0, 0.45 * F)
  ctx.quadraticCurveTo(0.11 * F, 0.34 * F, 0.21 * F, 0.43 * F)
  ctx.stroke()
}

/** open laughing mouth — filled D with a tongue notch */
function mouthOpen(b: FaceBrush): void {
  const c = b.ctx
  const w = 0.17 * F
  const h = 0.2 * F
  const y = 0.42 * F
  c.beginPath()
  c.moveTo(-w + wob(41, 0.006), y)
  c.quadraticCurveTo(-w * 0.6, y + h * 1.2, 0, y + h)
  c.quadraticCurveTo(w * 0.6, y + h * 1.2, w + wob(43, 0.006), y)
  c.quadraticCurveTo(0, y - h * 0.25, -w, y)
  c.fill()
}

/** small o mouth */
function mouthO(b: FaceBrush, seed: number): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.ellipse(0, 0.46 * F, 0.055 * F, 0.068 * F, wob(seed, 0.2), 0, Math.PI * 2)
  ctx.stroke()
}

/** chin crease — the ⌣ arc at y ≈ +0.66R (measured 0.23×0.10R) */
function chinMark(b: FaceBrush): void {
  const { ctx } = b
  ctx.beginPath()
  ctx.moveTo(-0.115 * F, 0.63 * F)
  ctx.quadraticCurveTo(0, 0.73 * F, 0.115 * F, 0.63 * F)
  ctx.stroke()
}

/** shy blush dashes on the cheeks */
function blushStrokes(b: FaceBrush, x: number, y: number, seed: number): void {
  const { ctx } = b
  ctx.save()
  ctx.lineWidth = LINE_W * 0.8
  for (let i = 0; i < 3; i++) {
    const dy = (i - 1) * 0.05 * F
    ctx.beginPath()
    ctx.moveTo(x - 0.02 * F + wob(seed + i, 0.005), y + dy - 0.02 * F)
    ctx.lineTo(x + 0.025 * F + wob(seed + i + 3, 0.005), y + dy + 0.02 * F)
    ctx.stroke()
  }
  ctx.restore()
}

/** full DTZ head: hair curls + both side stacks */
function headFrame(b: FaceBrush): void {
  hairCurls(b)
  sideGroup(b, 1)
  sideGroup(b, -1)
}

type DrawFace = (b: FaceBrush) => void

const FACE_DRAWERS: Record<FaceId, DrawFace> = {
  laugh(b) {
    strokeSetup(b)
    headFrame(b)
    brow(b, -1)
    brow(b, 1)
    eye8(b, -0.2 * F, 0.05 * F, 11)
    eye8(b, 0.2 * F, 0.05 * F, 23)
    nose(b)
    mouthGrin(b)
    chinMark(b)
  },
  happy(b) {
    strokeSetup(b)
    headFrame(b)
    brow(b, -1)
    brow(b, 1)
    eye8(b, -0.2 * F, 0.05 * F, 11)
    eye8(b, 0.2 * F, 0.05 * F, 23)
    nose(b)
    mouthOpen(b)
    chinMark(b)
  },
  smile(b) {
    strokeSetup(b)
    headFrame(b)
    eye8(b, -0.2 * F, 0.05 * F, 11)
    eye8(b, 0.2 * F, 0.05 * F, 23)
    nose(b)
    mouthSmile(b, 0.18)
    chinMark(b)
  },
  squint(b) {
    strokeSetup(b)
    headFrame(b)
    squintEye(b, -0.2 * F, 0.03 * F)
    squintEye(b, 0.2 * F, 0.03 * F)
    nose(b)
    mouthGrin(b)
    chinMark(b)
  },
  neutral(b) {
    strokeSetup(b)
    headFrame(b)
    brow(b, -1)
    brow(b, 1)
    eye8(b, -0.2 * F, 0.05 * F, 11)
    eye8(b, 0.2 * F, 0.05 * F, 23)
    nose(b)
    mouthFrown(b)
    chinMark(b)
  },
  surprised(b) {
    strokeSetup(b)
    headFrame(b)
    // brows lifted higher for the startled look
    const { ctx } = b
    ctx.save()
    ctx.translate(0, -0.09 * F)
    brow(b, -1)
    brow(b, 1)
    ctx.restore()
    eye8(b, -0.2 * F, 0.05 * F, 11)
    eye8(b, 0.2 * F, 0.05 * F, 23)
    nose(b)
    mouthPout(b)
    chinMark(b)
  },
  shy(b) {
    strokeSetup(b)
    headFrame(b)
    shyEye(b, -0.2 * F, 0.05 * F)
    shyEye(b, 0.2 * F, 0.05 * F)
    nose(b)
    mouthSmile(b, 0.13)
    blushStrokes(b, -0.42 * F, 0.24 * F, 61)
    blushStrokes(b, 0.42 * F, 0.24 * F, 71)
    chinMark(b)
  },
  sleepy(b) {
    strokeSetup(b)
    headFrame(b)
    sleepyEye(b, -0.2 * F, 0.05 * F)
    sleepyEye(b, 0.2 * F, 0.05 * F)
    nose(b)
    mouthO(b, 31)
    chinMark(b)
  },
}

/**
 * FacePreset -> canvas. Drawn in world units through the UV-correcting
 * transform so the face appears round and undistorted on the sphere.
 * `ink` follows the DTZ rule: near-black on standard colours, the
 * inverted designs pass their own light line colour.
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
