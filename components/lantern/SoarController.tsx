"use client"

import { useRef } from "react"
import * as THREE from "three"
import { useFrame, useThree } from "@react-three/fiber"
import type { ReleaseStage } from "@/lib/lantern/types"
import { HANG_LANTERN_POS } from "./HangController"

/**
 * Release-route flight timeline (self-written, same pattern as
 * computeLightingFrame — no animation library). Drives the lantern group from
 * the ground to its apex and carries the camera with it.
 *
 * Trajectory: slow lift-off → steady climb with lateral drift (sin envelope,
 * so the lamp arrives back over its takeoff point) → decelerate into a still
 * apex. The camera looks up with the lantern (OrbitControls target) and gains
 * partial vertical parallax, so the lamp visibly climbs into the upper frame
 * where the moon waits.
 */

export const SOAR_DURATION_S = 4.2
/** apex height of the lantern group (world units) — moon sits at y≈2.6 upper-left */
export const APEX_Y = 2.7

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

type SoarControllerProps = {
  stage: ReleaseStage
  groupRef: React.RefObject<THREE.Group | null>
  /** shared with ReleaseGround so the contact shadow knows when to let go */
  progressRef: { current: number }
  onSoarComplete?: () => void
}

export default function SoarController({
  stage,
  groupRef,
  progressRef,
  onSoarComplete,
}: SoarControllerProps) {
  // registered by OrbitControls makeDefault in LanternScene
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3 } | null
  const camera = useThree((s) => s.camera)
  const prevStage = useRef<ReleaseStage | null>(null)
  const elapsed = useRef(0)
  const fired = useRef(false)

  useFrame((_, delta) => {
    const g = groupRef.current
    if (!g) return

    // fresh flight — reset the clock the moment we enter soar
    if (stage === "soar" && prevStage.current !== "soar") {
      elapsed.current = 0
      fired.current = false
    }
    prevStage.current = stage

    if (stage === "soar") {
      elapsed.current = Math.min(elapsed.current + delta, SOAR_DURATION_S)
      const p = elapsed.current / SOAR_DURATION_S
      progressRef.current = p
      const e = easeInOutCubic(p)
      // drift envelope: grows in, dies out at apex so the lamp ends centered
      const env = Math.pow(Math.sin(Math.PI * Math.min(p, 1)), 0.7)

      g.position.set(
        0.35 * Math.sin(elapsed.current * 1.7) * env,
        e * APEX_Y,
        0.16 * Math.cos(elapsed.current * 1.25) * env,
      )
      g.rotation.z = -0.07 * Math.cos(elapsed.current * 1.7) * env
      g.rotation.y = 0.22 * Math.sin(elapsed.current * 0.9) * env

      // camera follow — look up with the lantern, plus partial parallax
      // (method-call form: react-hooks/immutability forbids property writes
      // on objects returned by hooks; method calls pass, as in CameraFit)
      const kf = 1 - Math.exp(-3 * Math.min(delta, 0.05))
      if (controls) {
        controls.target.setY(controls.target.y + (APEX_Y * 0.72 * e - controls.target.y) * kf)
      }
      const cam = camera as THREE.PerspectiveCamera
      const camY = 0.55 + APEX_Y * 0.42 * e
      const kc = 1 - Math.exp(-2.4 * Math.min(delta, 0.05))
      cam.position.setY(cam.position.y + (camY - cam.position.y) * kc)

      if (p >= 1 && !fired.current) {
        fired.current = true
        onSoarComplete?.()
      }
    } else if (stage === "apex") {
      // snapped state (share-link restore lands straight on apex): hold still
      // at the apex hover — the branch only appears in the hang stage
      if (progressRef.current < 1) {
        progressRef.current = 1
        g.position.set(0, APEX_Y, 0)
        g.rotation.set(0, 0, 0)
        if (controls) controls.target.setY(APEX_Y * 0.72)
      }
    } else if (stage === "hang" || stage === "dissolve" || stage === "memory" || stage === "share") {
      // post-flight states rest at the HANG position (safety net only — in
      // the normal flow progressRef is already 1 by the time these stages
      // run, and HangController drives the lantern during "hang"; without
      // this branch "hang" would fall into the grounded else below and be
      // yanked back to the ground origin every frame)
      if (progressRef.current < 1) {
        progressRef.current = 1
        g.position.set(HANG_LANTERN_POS.x, HANG_LANTERN_POS.y, HANG_LANTERN_POS.z)
        g.rotation.set(0, 0, 0)
        if (controls) controls.target.set(-0.3, 2.0, 0)
      }
    } else {
      // grounded stages — make sure the lantern rests at origin
      if (progressRef.current !== 0) {
        progressRef.current = 0
        g.position.set(0, 0, 0)
        g.rotation.set(0, 0, 0)
        if (controls) controls.target.setY(0)
        const cam = camera as THREE.PerspectiveCamera
        cam.position.setY(0.55)
      }
    }
  })

  return null
}
