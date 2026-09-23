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

/** almost imperceptible hanging-in-air sway, 4–7s periods, ±2–4° max */
export function computeIdleSway(time: number, boost: number): IdleFrame {
  return {
    rotZ: Math.sin(time * ((Math.PI * 2) / 6)) * 0.032 * boost,
    rotX: Math.sin(time * ((Math.PI * 2) / 7.4) + 1.3) * 0.024 * boost,
  }
}

export function lerpColor(current: THREE.Color, target: THREE.Color, delta: number, speed = 5): void {
  current.lerp(target, 1 - Math.exp(-speed * delta))
}

export function lerpNumber(current: number, target: number, delta: number, speed = 5): number {
  return current + (target - current) * (1 - Math.exp(-speed * delta))
}
