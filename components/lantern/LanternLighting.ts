import * as THREE from "three"

export type LightingFrame = {
  /** small spark flash 0..1 */
  spark: number
  /** light-core bulb visibility 0..1 */
  core: number
  /** internal PointLight intensity (fixtures: rings, caps, wick) */
  pointIntensity: number
  /** thin-paper translucency term (shader), main "light through paper" */
  translucent: number
  /** material emissiveIntensity — low warm assist near the core only */
  emissive: number
  /** outer halo / bloom opacity 0..1 (scaled down by the material layer) */
  glow: number
  /** multiplier on the idle sway amplitude (gently swings when lit) */
  swayBoost: number
}

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1)
/** smooth 0→1 ramp between a and b */
const ramp = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a))

export const LIGHTING_DURATION = 2.8

/**
 * Lighting timeline (seconds):
 *  0.0 light core appears / 0.2 spark / 0.4 internal light begins /
 *  0.8 paper begins glowing / 1.4 brighter / 1.8 soft bloom /
 *  2.2 gentle swing / 2.8 stable
 *
 * The dominant channel is `translucent` (light through the paper from the
 * internal bulb); emissive stays a low warm assist so the pattern never
 * reads as a self-lit sticker.
 */
export function computeLightingFrame(t: number): LightingFrame {
  const spark = t < 0.45 ? Math.sin(clamp01(t / 0.45) * Math.PI) : 0
  const core = ramp(t, 0, 0.5)
  const pointIntensity = ramp(t, 0.4, 0.8) * 1.6 + ramp(t, 0.8, 1.4) * 0.9
  const translucent = ramp(t, 0.4, 1.0) * 0.72 + ramp(t, 1.0, 2.0) * 0.28
  const emissive = ramp(t, 0.8, 1.4) * 0.1 + ramp(t, 1.4, 2.4) * 0.06
  const glow = ramp(t, 1.8, 2.2) * 0.6 + ramp(t, 2.2, 2.8) * 0.4
  const swayBoost = 1 + Math.sin(clamp01(ramp(t, 2.0, 2.5)) * Math.PI) * 1.4 * (1 - ramp(t, 2.6, 3.6) * 0.4)
  return { spark, core, pointIntensity, translucent, emissive, glow, swayBoost }
}

export type IdleFrame = { rotX: number; rotZ: number }

/**
 * Steady-state breathing — a dual-frequency swell layered on the fully-lit
 * look once the lighting timeline completes. Two incommensurate periods so
 * the rhythm never feels mechanical. Range ≈ 0.91..1.09.
 */
export function computeBreath(t: number): number {
  return 1 + 0.06 * Math.sin((t * Math.PI * 2) / 5.2) + 0.03 * Math.sin((t * Math.PI * 2) / 2.3 + 1.7)
}

/**
 * Ignition swell — the lantern-native "pop" the moment the lighting
 * timeline completes: the transmitted light surges PAST its steady level
 * (as if exhaled alight) then settles back. Asymmetric bump: fast rise
 * (~0.7s), slow decay (~1.9s), window 2.6s. Returns a multiplier (1 at
 * rest, peak ≈ 1.38). `over` = seconds since the timeline completed.
 */
const SWELL_WINDOW = 2.6
const SWELL_RISE = 0.27 // fraction of the window spent rising
export function computeIgnitionSwell(over: number): number {
  if (over <= 0) return 1
  const p = Math.min(1, over / SWELL_WINDOW)
  const bump =
    p < SWELL_RISE
      ? Math.sin((Math.PI * p) / (2 * SWELL_RISE))
      : Math.sin((Math.PI * (1 - p)) / (2 * (1 - SWELL_RISE)))
  return 1 + 0.38 * bump * bump
}

/** almost imperceptible hanging-in-air sway, 4–7s periods, ±2–4° max */
export function computeIdleSway(time: number, boost: number): IdleFrame {
  return {
    rotZ: Math.sin(time * ((Math.PI * 2) / 6)) * 0.032 * boost,
    rotX: Math.sin(time * ((Math.PI * 2) / 7.4) + 1.3) * 0.024 * boost,
  }
}

// ---- 风过事件 ----------------------------------------------------------------
// A steady loop never feels alive; "alive" is event-driven. Every ~26s a
// night gust passes: the lantern leans, the wick flickers, the rising motes
// are blown sideways. All components sample the SAME shared clock so the
// sway and the ember advection happen together.

/** shared wall clock for gust sampling (all components see the same gust) */
export function gustNow(): number {
  return typeof performance !== "undefined" ? performance.now() / 1000 : 0
}

/** deterministic hash → 0..1 (gust phase / duration / direction per cell) */
function hash1(n: number): number {
  const s = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b) >>> 0
  return ((s ^ (s >>> 13)) >>> 0) / 4294967296
}

const GUST_PERIOD = 26

/** gust envelope 0..1 (sin bump) and direction -1|1 for the gust active at time t */
export function computeGust(t: number): { strength: number; dir: number } {
  const cell = Math.floor(t / GUST_PERIOD)
  const r = hash1(cell)
  const start = cell * GUST_PERIOD + r * GUST_PERIOD * 0.55
  const dur = 2.2 + hash1(cell + 977) * 1.4
  const local = t - start
  if (local < 0 || local > dur) return { strength: 0, dir: 1 }
  const p = local / dur
  const strength = Math.pow(Math.sin(p * Math.PI), 1.5)
  return { strength, dir: hash1(cell + 4241) > 0.5 ? 1 : -1 }
}

export function lerpColor(current: THREE.Color, target: THREE.Color, delta: number, speed = 5): void {
  current.lerp(target, 1 - Math.exp(-speed * delta))
}

export function lerpNumber(current: number, target: number, delta: number, speed = 5): number {
  return current + (target - current) * (1 - Math.exp(-speed * delta))
}
