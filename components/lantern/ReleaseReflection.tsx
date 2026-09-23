"use client"

import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

/**
 * Wet-ground reflection for the release route: a cool, dim, elongated glow
 * streak on the ground that mirrors the lantern's sway WITH a lag (~150ms,
 * the "water" feel), brightens when the lantern is lit — and as the lantern
 * soars it fades while SHATTERING into a handful of drifting light motes
 * that scatter, flicker and die. It never pops away (方案 §8).
 *
 * Pure sprite/canvas trickery on the ground plane — no geometry changes.
 */

function makeStreakTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 6, 128, 128, 128)
    g.addColorStop(0, "rgba(255,255,255,0.55)")
    g.addColorStop(0.4, "rgba(255,255,255,0.22)")
    g.addColorStop(0.75, "rgba(255,255,255,0.07)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/** stateless hash → [0,1) — deterministic, no mutable PRNG state */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

type ReleaseReflectionProps = {
  /** 0 (grounded) → 1 (apex), written every frame by SoarController */
  soarProgress: { current: number }
  /** lantern is lit → the reflection carries its warm light */
  lit: boolean
  /** the lantern's own glow colour — reflection reads cooler than this */
  glow: string
}

const MOTE_COUNT = 12

export default function ReleaseReflection({ soarProgress, lit, glow }: ReleaseReflectionProps) {
  const streakTex = useMemo(() => makeStreakTexture(), [])
  const streak = useRef<THREE.Mesh>(null)
  const motes = useRef<THREE.InstancedMesh>(null)
  /** lagged x of the reflection (the lantern sways, the water answers late) */
  const lagX = useRef(0)
  /** scratch object for instance matrix updates — mutable via ref path */
  const dummyRef = useRef(new THREE.Object3D())

  // reflection reads COOLER than the lamp itself (方案: 颜色偏冷)
  const streakColor = useMemo(
    () => new THREE.Color(glow).lerp(new THREE.Color("#7FA0C8"), 0.55),
    [glow],
  )
  // shatter motes keep the lamp's warmth — embers of the light it left behind
  const moteColor = useMemo(
    () => new THREE.Color(glow).lerp(new THREE.Color("#FFD9A6"), 0.6),
    [glow],
  )

  const moteDirs = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) => ({
        dx: (hash(i * 2 + 1) - 0.5) * 2.6,
        dz: (hash(i * 2 + 2) - 0.5) * 2.0,
        delay: hash(i * 3 + 7) * 0.18,
        size: 0.05 + hash(i * 5 + 11) * 0.06,
        flick: 5 + hash(i * 7 + 13) * 4,
        phase: hash(i * 11 + 17) * Math.PI * 2,
      })),
    [],
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const p = soarProgress.current
    const dt = Math.min(delta, 0.05)

    // ---- streak: lagged mirror of the lantern's idle sway ----
    if (streak.current) {
      const targetX = Math.sin(t * 0.55) * 0.2
      lagX.current += (targetX - lagX.current) * (1 - Math.exp(-2.4 * dt))
      streak.current.position.x = lagX.current

      const mat = streak.current.material as THREE.MeshBasicMaterial
      const fade = 1 - THREE.MathUtils.smoothstep(p, 0, 0.45)
      const base = lit
        ? 0.3 + Math.sin(t * 1.3) * 0.05
        : 0.09 + Math.sin(t * 0.8) * 0.02
      mat.opacity = Math.max(base * fade, 0)
      streak.current.visible = mat.opacity > 0.004
    }

    // ---- shatter: the streak breaks into drifting motes as the lamp leaves ----
    if (motes.current) {
      const mat = motes.current.material as THREE.MeshBasicMaterial
      const gate = p > 0.03 && p < 0.95
      motes.current.visible = gate
      if (gate) {
        // motes are born as the streak dies, peak mid-flight, die near apex
        const life =
          THREE.MathUtils.smoothstep(p, 0.03, 0.35) *
          (1 - THREE.MathUtils.smoothstep(p, 0.55, 0.92))
        mat.opacity = life * 0.75
        const dummy = dummyRef.current
        for (let i = 0; i < MOTE_COUNT; i++) {
          const m = moteDirs[i]
          const local = Math.max(0, p - m.delay)
          dummy.position.set(
            m.dx * (0.2 + local * 2.1),
            -1.13 + Math.sin(t * 0.9 + m.phase) * 0.02,
            m.dz * (0.2 + local * 2.1),
          )
          const s = m.size * (0.7 + local * 1.4) * (0.8 + 0.2 * Math.sin(t * m.flick + m.phase))
          dummy.scale.set(s, s, 1)
          dummy.rotation.z = t * 0.4 + m.phase
          dummy.updateMatrix()
          motes.current.setMatrixAt(i, dummy.matrix)
        }
        motes.current.instanceMatrix.needsUpdate = true
      }
    }
  })

  return (
    <group>
      {/* the reflected glow — elongated along depth like light on wet ground */}
      <mesh ref={streak} rotation-x={-Math.PI / 2} position={[0, -1.145, 0]} renderOrder={3}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={streakTex}
          color={streakColor}
          transparent
          depthWrite={false}
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* shatter motes */}
      <instancedMesh
        ref={motes}
        args={[undefined, undefined, MOTE_COUNT]}
        frustumCulled={false}
        renderOrder={4}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={moteColor}
          transparent
          depthWrite={false}
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </group>
  )
}
