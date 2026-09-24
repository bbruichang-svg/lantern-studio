"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import LanternModel from "./LanternModel"
import EmberRise from "./EmberRise"
import AwakenedStars from "./AwakenedStars"
import ReleaseGround from "./ReleaseGround"
import ReleaseReflection from "./ReleaseReflection"
import SoarController, { APEX_Y } from "./SoarController"
import HangController, { HANG_LANTERN_POS } from "./HangController"
import TreeBranch from "./TreeBranch"
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
  /** fired once when the hang timeline finishes (hang → dissolve) */
  onHangComplete?: () => void
  /** fired once when the dissolve merge finishes (dissolve → memory) */
  onDissolveComplete?: () => void
}

/** registers a synchronous canvas-capture function for the share card */
function CaptureBridge({
  apiRef,
  targetY = 0,
  targetX = 0,
  targetZ = 0,
}: {
  apiRef: { current: (() => string) | null }
  /** vertical center of the lantern at capture time (apex/hang framing on /release) */
  targetY?: number
  /** horizontal center of the lantern at capture time (hang framing on /release) */
  targetX?: number
  /** depth of the lantern at capture time (hang framing on /release) */
  targetZ?: number
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
      cam.position.set(targetX, 0.55 + targetY, targetZ + d)
      cam.lookAt(targetX, targetY, targetZ)
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
  }, [apiRef, gl, scene, camera, targetY, targetX, targetZ])

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

/** ambient moon — atmosphere by default; during the dissolve merge it is
 * the destination the lantern's light flows into (boost 0→1, written by
 * DissolveController through moonBoostRef) */
function MoonDisc({ lit, boostRef }: { lit: boolean; boostRef?: { current: number } }) {
  const texture = useMemo(() => makeMoonTexture(), [])
  const group = useRef<THREE.Group>(null)
  const material = useRef<THREE.SpriteMaterial>(null)

  useFrame((_, delta) => {
    const k = 1 - Math.exp(-1.6 * Math.min(delta, 0.05))
    const boost = boostRef?.current ?? 0
    if (material.current) {
      // narrative: the moon only reveals itself once the lantern is lit;
      // the dissolve boost pushes it from ambience to hero brightness
      const o = lit ? Math.min(0.92, 0.38 + boost * 0.54) : 0
      material.current.opacity += (o - material.current.opacity) * k
    }
    if (group.current) {
      // drifts slightly higher & closer once the lantern is lit; during the
      // merge the moon leans IN — closer, larger, near upper-centre — to meet
      // the lantern's light halfway. The end point must sit INSIDE the
      // portrait frustum (±~1.1 world units at that depth), or the merged
      // moon lands off-screen and the whole beat is wasted.
      const x = -3.5 + 2.5 * boost
      const y = (lit ? 2.62 : 2.3) + boost * 0.1
      const z = -5.5 + 3.4 * boost
      group.current.position.setX(group.current.position.x + (x - group.current.position.x) * k)
      group.current.position.setY(group.current.position.y + (y - group.current.position.y) * k)
      group.current.position.setZ(group.current.position.z + (z - group.current.position.z) * k)
      const s = 1 + boost * 0.6
      group.current.scale.setScalar(group.current.scale.x + (s - group.current.scale.x) * k)
      // dev probe: playwright reads this to debug the merge beat
      if (process.env.NODE_ENV !== "production") {
        ;(window as unknown as { __moon?: Record<string, unknown> }).__moon = {
          pos: group.current.position.toArray(),
          scale: group.current.scale.x,
          opacity: material.current?.opacity,
          boost,
          visible: group.current.visible,
        }
      }
    }
  })

  return (
    <group ref={group} position={[-3.5, 2.3, -5.5]}>
      <sprite scale={[1.5, 1.5, 1]}>
        <spriteMaterial ref={material} map={texture} transparent opacity={0} depthWrite={false} />
      </sprite>
    </group>
  )
}

/** dissolve merge duration (s): lantern light → moon */
const DISSOLVE_DURATION_S = 2.8

/**
 * 化月 morph (方案 §10): at apex the lantern's glow swells, the paper shrinks
 * into its own light, and the light drifts toward the moon as the moon
 * brightens to meet it — two lights merging into one. No geometry morph:
 * scale + additive glow sprite + moon boost sell the transition.
 * The "share" stage quietly restores the lantern (behind the full-screen
 * share overlay) so the card capture still frames the lamp.
 */
function DissolveController({
  stage,
  groupRef,
  glowRef,
  moonBoostRef,
  hangPos,
  onComplete,
}: {
  stage: ReleaseStage
  groupRef: React.RefObject<THREE.Group | null>
  glowRef: React.RefObject<THREE.Sprite | null>
  moonBoostRef: { current: number }
  /** where the lantern rests when the merge starts (apex hover or hang point) */
  hangPos?: { x: number; y: number; z: number }
  onComplete: () => void
}) {
  const start = hangPos ?? { x: 0, y: APEX_Y, z: 0 }
  const elapsed = useRef(0)
  const fired = useRef(false)

  useEffect(() => {
    if (stage === "dissolve") {
      elapsed.current = 0
      fired.current = false
    } else if (stage === "memory") {
      // merged state — lantern stays gone, moon stays bright (boost holds 1)
      const g = groupRef.current
      if (g) g.visible = false
      const glow = glowRef.current
      if (glow) glow.visible = false
    } else if (stage === "share") {
      // restore the lamp behind the share overlay for the card capture
      const g = groupRef.current
      if (g) {
        g.visible = true
        g.scale.setScalar(1)
      }
      moonBoostRef.current = 0
      const glow = glowRef.current
      if (glow) glow.visible = false
    }
  }, [stage, groupRef, glowRef, moonBoostRef])

  useFrame((_, delta) => {
    if (stage !== "dissolve") return
    elapsed.current = Math.min(elapsed.current + Math.min(delta, 0.05), DISSOLVE_DURATION_S)
    const e = elapsed.current / DISSOLVE_DURATION_S
    const s = THREE.MathUtils.smoothstep(e, 0, 1)

    const g = groupRef.current
    if (g) {
      g.visible = true
      g.scale.setScalar(1 - 0.85 * s)
    }

    const glow = glowRef.current
    if (glow) {
      glow.visible = true
      // drift from the lantern's resting point toward the moon's merge point
      // (moon ends near [-1.0, 2.7, -2.1])
      glow.position.set(
        start.x + (-1.05 - start.x) * s,
        start.y + (2.72 - start.y) * s,
        start.z + (-2.1 - start.z) * s,
      )
      const sc = 0.5 + 2.3 * s
      glow.scale.set(sc, sc, 1)
      const mat = glow.material as THREE.SpriteMaterial
      // swell … then hand the light over to the moon in the last stretch
      mat.opacity = s < 0.72 ? Math.min(1, s * 1.5) * 0.9 : 0.9 * (1 - (s - 0.72) / 0.28)
    }

    moonBoostRef.current = s

    if (e >= 1 && !fired.current) {
      fired.current = true
      if (g) g.visible = false
      onComplete()
    }
  })

  return null
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
  onHangComplete,
  onDissolveComplete,
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
  // dissolve merge: moon brightness boost (written by DissolveController,
  // read by MoonDisc every frame) + the lantern's own light sprite
  const moonBoostRef = useRef(0)
  const dissolveGlowRef = useRef<THREE.Sprite>(null)
  const dissolveGlowTex = useMemo(() => makeMoonTexture(), [])
  const dissolveGlowColor = useMemo(
    () => new THREE.Color(color.glow).lerp(new THREE.Color("#FFF3DC"), 0.45),
    [color.glow],
  )

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
      {moon && <MoonDisc lit={lit} boostRef={releaseStage ? moonBoostRef : undefined} />}
      {releaseStage && <ReleaseGround soarProgress={soarProgress} lit={lit} />}
      {releaseStage && (
        <ReleaseReflection soarProgress={soarProgress} lit={lit} glow={color.glow} />
      )}
      {/* the lantern's light, set free during the dissolve merge */}
      {releaseStage && (
        <sprite ref={dissolveGlowRef} position={[0, APEX_Y, 0]} scale={[0.5, 0.5, 1]} visible={false}>
          <spriteMaterial
            map={dissolveGlowTex}
            color={dissolveGlowColor}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      )}

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
        {/* steady state — warm motes rising from the top opening. Inside the
            group so they follow the lantern through flight/hang/dissolve
            (the group sits at the origin on every other route — no change). */}
        <EmberRise active={phase === "finished"} tint={emberTint} paused={paused} />
      </group>
      {releaseStage && (
        <SoarController
          stage={releaseStage}
          groupRef={lanternGroup}
          progressRef={soarProgress}
          onSoarComplete={onSoarComplete}
        />
      )}
      {/* 挂树终幕 — fly to the bare branch, catch, sway, then hand off */}
      {releaseStage && (
        <HangController stage={releaseStage} groupRef={lanternGroup} onHangComplete={onHangComplete} />
      )}
      {/* the bare branch reaches in for the hang finale and stays for the card */}
      {releaseStage && (
        <TreeBranch
          reveal={
            releaseStage === "hang" ||
            releaseStage === "dissolve" ||
            releaseStage === "memory" ||
            releaseStage === "share"
          }
        />
      )}
      {releaseStage && (
        <DissolveController
          stage={releaseStage}
          groupRef={lanternGroup}
          glowRef={dissolveGlowRef}
          moonBoostRef={moonBoostRef}
          hangPos={HANG_LANTERN_POS}
          onComplete={onDissolveComplete ?? (() => {})}
        />
      )}
      {/* the night sky answers: stars wake near→far once the lantern is lit */}
      <AwakenedStars active={lit} paused={paused} />
      <CameraFit pullBack={lit} />
      {captureApiRef && (
        <CaptureBridge
          apiRef={captureApiRef}
          targetY={releaseStage ? HANG_LANTERN_POS.y : 0}
          targetX={releaseStage ? HANG_LANTERN_POS.x : 0}
          targetZ={releaseStage ? HANG_LANTERN_POS.z : 0}
        />
      )}

      <OrbitControls
        makeDefault
        enabled={releaseStage !== "soar" && releaseStage !== "hang"}
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
