"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import LanternModel from "./LanternModel"
import EmberRise from "./EmberRise"
import AwakenedStars from "./AwakenedStars"
import ReleaseGround from "./ReleaseGround"
import SoarController, { APEX_Y } from "./SoarController"
import type { FacePreset, LanternColor, LanternPhase, ReleaseStage } from "@/lib/lantern/types"

type LanternSceneProps = {
  color: LanternColor
  face: FacePreset | null
  phase: LanternPhase
  onCoreClick: () => void
  /** lighting preset: bright studio (full studio page), unlit night, lit night */
  env?: "studio" | "nightDim" | "nightLit"
  /** faint ambient moon (MVP hero scene only) */
  moon?: boolean
  /** freeze animation (share-card capture) */
  paused?: boolean
  /** filled with a capture() function that returns the WebGL canvas as a PNG data URL */
  captureApiRef?: { current: (() => string) | null }
  /** blessing stage with a blessing written — pressing the lantern charges it */
  holdEnabled?: boolean
  /** true while the user is holding the lantern down */
  charging?: boolean
  onHoldStart?: (x: number, y: number) => void
  onHoldCancel?: () => void
  /**
   * Release route only: the current ReleaseStage. When set, the lantern gets
   * a grounded contact shadow and the soar flight timeline drives its
   * transform. Other routes leave it undefined — zero impact.
   */
  releaseStage?: ReleaseStage
  /** fired once when the soar timeline finishes (soar → apex) */
  onSoarComplete?: () => void
}

/** registers a synchronous canvas-capture function for the share card */
function CaptureBridge({
  apiRef,
  targetY = 0,
}: {
  apiRef: { current: (() => string) | null }
  /** vertical center of the lantern at capture time (apex framing on /release) */
  targetY?: number
}) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  useEffect(() => {
    apiRef.current = () => {
      const cam = camera as THREE.PerspectiveCamera
      // reframe for the card: pull back so the lantern spans ~50% of the
      // card height once the square crop (min(w, 0.92h)) is scaled to 1080.
      // freeze → capture → restore, all synchronous (no rAF in between).
      const prevPos = cam.position.clone()
      const prevQuat = cam.quaternion.clone()
      const aspect = cam.aspect
      const fill = Math.min(0.5635, 0.6125 * aspect) // lantern height / capture height
      const d = 1.1 / Math.tan((fill * cam.fov * Math.PI) / 360) + 1.06
      cam.position.set(0, 0.55 + targetY, d)
      cam.lookAt(0, targetY, 0)
      gl.render(scene, cam)
      const url = gl.domElement.toDataURL("image/png")
      cam.position.copy(prevPos)
      cam.quaternion.copy(prevQuat)
      gl.render(scene, cam) // put the live view back immediately
      return url
    }
    return () => {
      apiRef.current = null
    }
  }, [apiRef, gl, scene, camera, targetY])

  return null
}

/**
 * Pull the camera back on narrow (portrait) viewports so the lantern fits
 * the horizontal frustum — at fov 35 a 390-wide phone would otherwise clip
 * the lantern's sides. Wide/desktop viewports keep the original distance.
 * Once the lantern is lit, drift back a further ~10% (one-time, smooth) so
 * the finished-state lyrics get breathing room below the lantern.
 */
function CameraFit({ pullBack }: { pullBack: boolean }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const didFit = useRef(false)
  const didPull = useRef(false)
  const pullTarget = useRef<number | null>(null)

  useEffect(() => {
    if (didFit.current || size.width === 0) return
    didFit.current = true
    const aspect = size.width / size.height
    const vHalf = Math.tan((35 * Math.PI) / 360)
    const hHalf = vHalf * aspect
    // lantern radius ≈1.1 world units, keep it ≤82% of the frame width
    const dH = 1.1 / (0.82 * hHalf) + 1.06
    const d = Math.max(5.4, dH)
    camera.position.set(0, 0.55, d)
    camera.lookAt(0, 0, 0)
  }, [camera, size])

  useEffect(() => {
    if (!pullBack || didPull.current) return
    didPull.current = true
    const cam = camera as THREE.PerspectiveCamera
    // one-time gentle dolly-out when the light comes on
    pullTarget.current = Math.min(cam.position.length() * 1.1, 14)
  }, [pullBack, camera])

  useFrame(() => {
    if (pullTarget.current == null) return
    const cam = camera as THREE.PerspectiveCamera
    const dist = cam.position.length()
    const next = dist + (pullTarget.current - dist) * 0.055
    cam.position.copy(cam.position.clone().normalize().multiplyScalar(next))
    if (Math.abs(next - pullTarget.current) < 0.01) pullTarget.current = null
  })

  return null
}

type EnvPreset = { amb: number; key: number; fill: number; night: number }

const ENV_PRESETS: Record<"studio" | "nightDim" | "nightLit", EnvPreset> = {
  // editing light — paper reads true to its colour
  studio: { amb: 1.0, key: 0.85, fill: 0.25, night: 0 },
  // unlit lantern under moonlight — visible but clearly not glowing
  nightDim: { amb: 0.4, key: 0.1, fill: 0.05, night: 0.28 },
  // lit — environment drops away, the paper light owns the scene
  nightLit: { amb: 0.16, key: 0.06, fill: 0.04, night: 0.55 },
}

/**
 * Crossfading environment lights. The lantern is never re-lit by the
 * environment once lit; the night preset keeps a cool blue fill so the
 * warm paper reads against it.
 */
function EnvironmentLights({ env }: { env: "studio" | "nightDim" | "nightLit" }) {
  const ambient = useRef<THREE.AmbientLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const night = useRef<THREE.DirectionalLight>(null)
  const target = ENV_PRESETS[env]

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-2.2 * Math.min(delta, 0.05))
    if (ambient.current) ambient.current.intensity += (target.amb - ambient.current.intensity) * k
    if (key.current) key.current.intensity += (target.key - key.current.intensity) * k
    if (fill.current) fill.current.intensity += (target.fill - fill.current.intensity) * k
    if (night.current) night.current.intensity += (target.night - night.current.intensity) * k
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={1.0} color="#FFFFFF" />
      <directionalLight ref={key} position={[3, 4, 5]} intensity={0.85} color="#FFFDF8" />
      <directionalLight ref={fill} position={[-4, -2, -3]} intensity={0.25} color="#FFF8EE" />
      {/* cool night fill from behind-left — keeps the lit silhouette readable
          against the dark background without warming the whole scene */}
      <directionalLight ref={night} position={[-2, 1.6, -4.5]} intensity={0} color="#33507E" />
    </>
  )
}

function makeMoonTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 30, 128, 128, 128)
    g.addColorStop(0, "rgba(238,235,220,0.95)")
    g.addColorStop(0.45, "rgba(238,235,220,0.55)")
    g.addColorStop(0.75, "rgba(238,235,220,0.12)")
    g.addColorStop(1, "rgba(238,235,220,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** ambient moon — atmosphere only, never the hero (≤5% visual weight) */
function MoonDisc({ lit }: { lit: boolean }) {
  const texture = useMemo(() => makeMoonTexture(), [])
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.SpriteMaterial>(null)

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-1.6 * Math.min(delta, 0.05))
    if (material.current) {
      // narrative: the moon only reveals itself once the lantern is lit
      const o = lit ? 0.38 : 0
      material.current.opacity += (o - material.current.opacity) * k
    }
    if (group.current) {
      // drifts slightly higher & closer once the lantern is lit
      const y = lit ? 2.62 : 2.3
      group.current.position.y += (y - group.current.position.y) * k
    }
  })

  return (
    <group ref={group} position={[-3.5, 2.3, -5.5]}>
      <sprite scale={[1.5, 1.5, 1]}>
        <spriteMaterial map={texture} transparent opacity={0} depthWrite={false} />
      </sprite>
    </group>
  )
}

export default function LanternScene({
  color,
  face,
  phase,
  onCoreClick,
  env,
  moon,
  paused,
  captureApiRef,
  holdEnabled,
  charging,
  onHoldStart,
  onHoldCancel,
  releaseStage,
  onSoarComplete,
}: LanternSceneProps) {
  const resolvedEnv: "studio" | "nightDim" | "nightLit" =
    env ?? (phase === "studio" || phase === "ready" ? "studio" : "nightLit")
  const lit = phase === "lighting" || phase === "finished"
  // ember colour grows out of the lantern's own glow — each city colour
  // gets its own warm motes (never a generic palette)
  const emberTint = useMemo(
    () => new THREE.Color(color.glow).lerp(new THREE.Color("#FFD9A6"), 0.6),
    [color.glow],
  )
  // release-route extras — inert on every other route
  const lanternGroup = useRef<THREE.Group>(null)
  const soarProgress = useRef(0)

  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 2]}
      camera={{ fov: 35, position: [0, 0.55, 5.4], near: 0.1, far: 60 }}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        // keep the drawing buffer readable so the share card can capture it
        preserveDrawingBuffer: true,
      }}
    >
      <EnvironmentLights env={resolvedEnv} />
      {moon && <MoonDisc lit={lit} />}
      {releaseStage && <ReleaseGround soarProgress={soarProgress} lit={lit} />}

      <group ref={lanternGroup}>
        <LanternModel
          color={color}
          face={face}
          phase={phase}
          onCoreClick={onCoreClick}
          paused={paused}
          holdEnabled={holdEnabled}
          charging={charging}
          onHoldStart={onHoldStart}
          onHoldCancel={onHoldCancel}
        />
      </group>
      {releaseStage && (
        <SoarController
          stage={releaseStage}
          groupRef={lanternGroup}
          progressRef={soarProgress}
          onSoarComplete={onSoarComplete}
        />
      )}
      {/* steady state — warm motes rising from the top opening */}
      <EmberRise active={phase === "finished"} tint={emberTint} paused={paused} />
      {/* the night sky answers: stars wake near→far once the lantern is lit */}
      <AwakenedStars active={lit} paused={paused} />
      <CameraFit pullBack={lit} />
      {captureApiRef && <CaptureBridge apiRef={captureApiRef} targetY={releaseStage ? APEX_Y : 0} />}

      <OrbitControls
        makeDefault
        enabled={releaseStage !== "soar"}
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.65}
        zoomSpeed={0.6}
        minDistance={3.4}
        maxDistance={14}
        minPolarAngle={0.85}
        maxPolarAngle={2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
