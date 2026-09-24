"use client"

import { useRef } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import type { ReleaseStage } from "@/lib/lantern/types"
import { BODY_TOP_Y, RING_CAP_HEIGHT } from "@/lib/lantern/geometry"

/**
 * Hang finale timeline (挂树终幕) — drives the lantern group from its
 * apex hover to the bare branch: a short arcing flight, the catch, then
 * a gentle decaying pendulum around the branch tip. The camera drifts
 * a little toward the branch so the composition centres on the hung
 * lantern. Same self-written pattern as SoarController (no library).
 *
 * Phases (total 4.5s):
 *   A  flight    1.8s   quadratic bezier apex → hang point, ease-in-out,
 *                       with a soft "settle" dip in the last 15%
 *   B  pendulum  2.7s   rigid swing around the tip: θ = θ₀·cos(ωτ)·e^(−λτ)
 *
 * The lantern's top ring (local y ≈ 1.0817) hangs on the tip, so the
 * group position = tip + R(θ)·(0, −HANG_LEN, 0) and rotation.z = θ.
 */

/** branch tip in world coords (TreeBranch's last main-branch point) */
export const HANG_POINT = { x: -0.5, y: 3.05, z: -0.8 }
/** distance from group origin (lantern centre) down to the top ring */
export const HANG_LEN = BODY_TOP_Y + RING_CAP_HEIGHT // ≈ 1.0817
/** where the lantern GROUP rests while hung (top ring on the tip) */
export const HANG_LANTERN_POS = {
  x: HANG_POINT.x,
  y: HANG_POINT.y - HANG_LEN,
  z: HANG_POINT.z,
} // ≈ (-0.5, 1.9683, -0.8)

const FLIGHT_S = 1.8
const SWAY_S = 2.7
const HANG_TOTAL_S = FLIGHT_S + SWAY_S // 4.5

const THETA0 = 0.065 // initial swing amplitude ≈ 3.7°
const OMEGA = 2.6 // slightly slower than the physical pendulum — more graceful
const LAMBDA = 0.3 // decay: amplitude ≈ 0.029 (1.7°) at hand-off to dissolve

// bezier control: apex hover → arc peak (lifted above the chord) → hang pos
const P0 = new THREE.Vector3(0, 2.7, 0)
const P1 = new THREE.Vector3(-0.25, 2.83, -0.7)
const P2 = new THREE.Vector3(
  HANG_POINT.x + HANG_LEN * Math.sin(THETA0),
  HANG_POINT.y - HANG_LEN * Math.cos(THETA0),
  HANG_POINT.z,
)

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function smoothstep(t: number): number {
  const c = Math.min(Math.max(t, 0), 1)
  return c * c * (3 - 2 * c)
}

type HangControllerProps = {
  stage: ReleaseStage
  groupRef: React.RefObject<THREE.Group | null>
  onHangComplete?: () => void
}

export default function HangController({ stage, groupRef, onHangComplete }: HangControllerProps) {
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null
  const camera = useThree((s) => s.camera)
  const prevStage = useRef<ReleaseStage | null>(null)
  const elapsed = useRef(0)
  const fired = useRef(false)

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return

    if (stage === "hang" && prevStage.current !== "hang") {
      elapsed.current = 0
      fired.current = false
    }
    prevStage.current = stage

    if (stage !== "hang") return

    elapsed.current = Math.min(elapsed.current + Math.min(delta, 0.05), HANG_TOTAL_S)
    const t = elapsed.current

    if (t <= FLIGHT_S) {
      // phase A — arcing flight from apex to the branch tip
      const p = t / FLIGHT_S
      const e = easeInOutCubic(p)
      const u = 1 - e
      g.position.set(
        u * u * P0.x + 2 * u * e * P1.x + e * e * P2.x,
        u * u * P0.y + 2 * u * e * P1.y + e * e * P2.y - 0.06 * smoothstep((p - 0.85) / 0.15),
        u * u * P0.z + 2 * u * e * P1.z + e * e * P2.z,
      )
      // lean into the arrival, reaching θ₀ exactly at the catch
      g.rotation.z = THETA0 * e
    } else {
      // phase B — rigid pendulum around the branch tip
      const tau = t - FLIGHT_S
      const theta = THETA0 * Math.cos(OMEGA * tau) * Math.exp(-LAMBDA * tau)
      g.position.set(
        HANG_POINT.x + HANG_LEN * Math.sin(theta),
        HANG_POINT.y - HANG_LEN * Math.cos(theta),
        HANG_POINT.z,
      )
      g.rotation.z = theta
    }

    // camera drift toward the branch — subtle, exponential approach
    const kf = 1 - Math.exp(-1.8 * Math.min(delta, 0.05))
    const kc = 1 - Math.exp(-1.5 * Math.min(delta, 0.05))
    if (controls) {
      controls.target.setX(controls.target.x + (-0.3 - controls.target.x) * kf)
      controls.target.setY(controls.target.y + (2.0 - controls.target.y) * kf)
    }
    const cam = camera as THREE.PerspectiveCamera
    cam.position.setX(cam.position.x + (-0.15 - cam.position.x) * kc)

    if (process.env.NODE_ENV !== "production") {
      ;(window as unknown as { __hang?: unknown }).__hang = {
        pos: g.position.toArray(),
        rotZ: g.rotation.z,
        t,
      }
    }

    if (t >= HANG_TOTAL_S && !fired.current) {
      fired.current = true
      onHangComplete?.()
    }
  })

  return null
}
