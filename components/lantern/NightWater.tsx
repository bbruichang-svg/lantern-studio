"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

type NightWaterProps = {
  /** true once the lantern is lit (lighting / finished / share stages) */
  active: boolean
  /** pool & ripple tint — the lantern's own warm city colour */
  tint: THREE.Color
  /** freeze all animation — used while capturing the share card */
  paused?: boolean
}

/**
 * 夜色水面 — the water-lamp narrative: the lantern floats above a dark
 * night sea, and light "drips" into it as slow expanding ripple rings
 * above a faint warm pool (the sea surface lit by the lantern) with a
 * soft reflection right under the light. Sending a water lamp adrift is
 * the ritual of letting a blessing go — the same story the product tells.
 *
 * Deliberately NO full water plane: at a near-horizontal camera any
 * horizon line slices straight through the lantern. The night sea is
 * black anyway — all it ever shows is the patch the lantern lights up.
 * The canvas is alpha-composited over the DOM night gradient.
 */

const WATER_Y = -1.9
const RIPPLE_COUNT = 5
const RIPPLE_LIFE = 2.8
const POOL_OPACITY = 0.14
const REFLECTION_OPACITY = 0.13

const WARM_ANCHOR = new THREE.Color("#FFD9A6")

function makeRadialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
    g.addColorStop(0, "rgba(255,255,255,0.9)")
    g.addColorStop(0.4, "rgba(255,255,255,0.22)")
    g.addColorStop(0.75, "rgba(255,255,255,0.05)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function NightWater({ active, tint, paused = false }: NightWaterProps) {
  const glowTexture = useMemo(() => makeRadialTexture(), [])
  const tintRef = useRef(tint)
  tintRef.current = tint

  const groupRef = useRef<THREE.Group>(null)
  const poolMat = useRef<THREE.MeshBasicMaterial>(null)
  const reflectMat = useRef<THREE.MeshBasicMaterial>(null)
  const globalRef = useRef(0)
  const rippleClock = useRef(0)
  const nextRipple = useRef(1.2)
  const timeRef = useRef(0)

  // ---- ripple pool ---------------------------------------------------------
  const rippleRefs = useRef<(THREE.Mesh | null)[]>([])
  const rippleMats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const rippleState = useMemo(
    () => Array.from({ length: RIPPLE_COUNT }, () => ({ age: -1, x: 0, z: 0, maxScale: 1 })),
    [],
  )
  const rippleCursor = useRef(0)

  const spawnRipple = () => {
    const i = rippleCursor.current
    rippleCursor.current = (rippleCursor.current + 1) % RIPPLE_COUNT
    const s = rippleState[i]
    s.age = 0
    const r = Math.sqrt(Math.random()) * 1.7
    const a = Math.random() * Math.PI * 2
    s.x = Math.cos(a) * r
    s.z = Math.sin(a) * r * 0.6
    s.maxScale = 0.9 + Math.random() * 1.1
  }

  useEffect(() => {
    return () => {
      glowTexture.dispose()
    }
  }, [glowTexture])

  useFrame((_, delta) => {
    if (paused) return // frozen for share-card capture
    const dt = Math.min(delta, 0.05)
    timeRef.current += dt

    const target = active ? 1 : 0
    globalRef.current += (target - globalRef.current) * (1 - Math.exp(-1.4 * dt))
    const g = globalRef.current
    if (groupRef.current) groupRef.current.visible = g > 0.015

    // light pool & reflection breathe gently with the lantern's own rhythm
    const wobble = 0.85 + 0.15 * Math.sin(timeRef.current * 0.9)
    if (poolMat.current) poolMat.current.opacity = POOL_OPACITY * g * wobble
    if (reflectMat.current) reflectMat.current.opacity = REFLECTION_OPACITY * g * wobble

    // schedule ripples — light dripping into the sea
    if (active && g > 0.5) {
      rippleClock.current += dt
      if (rippleClock.current >= nextRipple.current) {
        rippleClock.current = 0
        nextRipple.current = 2.5 + Math.random() * 1.5
        spawnRipple()
      }
    }

    for (let i = 0; i < RIPPLE_COUNT; i++) {
      const s = rippleState[i]
      const mesh = rippleRefs.current[i]
      const mat = rippleMats.current[i]
      if (!mesh || !mat) continue
      if (s.age < 0) {
        mat.opacity = 0
        continue
      }
      s.age += dt
      const p = s.age / RIPPLE_LIFE
      if (p >= 1) {
        s.age = -1
        mat.opacity = 0
        continue
      }
      mesh.scale.setScalar((0.5 + p * 1.7) * s.maxScale)
      mesh.position.set(s.x, WATER_Y + 0.01, s.z)
      mat.opacity = 0.35 * Math.pow(1 - p, 1.5) * g
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      {/* wide warm pool — the patch of sea the lantern lights up (soft radial
          fade, no hard horizon) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, -0.5]} renderOrder={1}>
        <planeGeometry args={[9, 5]} />
        <meshBasicMaterial
          ref={poolMat}
          map={glowTexture}
          color="#22354E"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* reflection — warm elongated pool right under the light */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y + 0.005, 0.2]} renderOrder={2}>
        <planeGeometry args={[2.2, 2.8]} />
        <meshBasicMaterial
          ref={reflectMat}
          map={glowTexture}
          color={WARM_ANCHOR}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ripple rings */}
      {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
        <mesh
          key={`rip${i}`}
          ref={(m) => {
            rippleRefs.current[i] = m
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, WATER_Y + 0.01, 0]}
          renderOrder={3}
        >
          <ringGeometry args={[0.46, 0.52, 48]} />
          <meshBasicMaterial
            ref={(m) => {
              rippleMats.current[i] = m
            }}
            color="#BFD9F2"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}
