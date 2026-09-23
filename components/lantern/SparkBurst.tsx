"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { BODY_TOP_Y, RING_CAP_HEIGHT } from "@/lib/lantern/geometry"

type SparkBurstProps = {
  /** true once the lantern is fully lit (finished / share stages) */
  active: boolean
  /** freeze all animation — used while capturing the share card */
  paused?: boolean
}

/**
 * Sparkler ("hand-held firework") burn above the lit lantern:
 *  - thin pastel light-rays shoot out of the top opening, stretch, droop
 *    under gravity and fade (LineSegments pool, additive blending)
 *  - a handful of "faller" rays arc down past the lantern; when a tip
 *    crosses the ground plane it fades into a soft ripple ring there
 *  - four-point stars twinkle in a shell around the burst
 *  - a small bright core marks the emission point
 *
 * Everything is driven by useFrame against mutable pools — nothing enters
 * React state. `paused` freezes the whole timeline for share-card capture.
 */

// emission point: just above the top ring cap — the lantern's chimney
const ORIGIN_Y = BODY_TOP_Y + RING_CAP_HEIGHT + 0.02
// invisible ground plane where fallers land (slightly below the lantern)
const GROUND_Y = -(BODY_TOP_Y + RING_CAP_HEIGHT + 0.45)

const RAY_COUNT = 64 // pool size
const RAY_SEG = 7 // line segments per ray
const BURST_ON_ACTIVATE = 32
const SPAWN_RATE = 22 // sustained rays / second
const RIPPLE_COUNT = 7
const RIPPLE_LIFE = 1.4
const STAR_COUNT = 20

// saturated bases — ACES tonemapping washes additive lines toward white,
// so the hue must be strong pre-tonemap to read as pastel on screen
const PASTELS = ["#FF6FB0", "#4EE6DF", "#F2E884", "#95EC7E", "#86AEFF", "#FFE9C9"].map(
  (hex) => new THREE.Color(hex),
)

const clamp01 = (v: number): number => Math.min(Math.max(v, 0), 1)
const smoothstep = (a: number, b: number, t: number): number => {
  const x = clamp01((t - a) / (b - a))
  return x * x * (3 - 2 * x)
}

type Ray = {
  age: number
  life: number
  reach: number // final length of the ray
  grow: number // seconds to reach full length
  grav: number // droop strength
  dir: THREE.Vector3
  color: THREE.Color
  seed: number
  faller: boolean
  landed: boolean
  alive: boolean
}

function makeStarTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 64
  c.height = 64
  const ctx = c.getContext("2d")
  if (ctx) {
    // four-point sparkle: concave diamond cross
    const star = () => {
      ctx.beginPath()
      ctx.moveTo(32, 3)
      ctx.quadraticCurveTo(36, 28, 61, 32)
      ctx.quadraticCurveTo(36, 36, 32, 61)
      ctx.quadraticCurveTo(28, 36, 3, 32)
      ctx.quadraticCurveTo(28, 28, 32, 3)
      ctx.fill()
    }
    ctx.shadowColor = "rgba(255,255,255,0.9)"
    ctx.shadowBlur = 6
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    star()
    ctx.shadowBlur = 0
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    star()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeCoreTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 128
  c.height = 128
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64)
    g.addColorStop(0, "rgba(255,255,255,0.95)")
    g.addColorStop(0.25, "rgba(255,250,235,0.35)")
    g.addColorStop(0.6, "rgba(255,245,225,0.08)")
    g.addColorStop(1, "rgba(255,245,225,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function SparkBurst({ active, paused = false }: SparkBurstProps) {
  const starTexture = useMemo(() => makeStarTexture(), [])
  const coreTexture = useMemo(() => makeCoreTexture(), [])

  // ---- ray pool (one LineSegments draw call) ------------------------------
  const rayGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(RAY_COUNT * RAY_SEG * 2 * 3)
    const colors = new Float32Array(RAY_COUNT * RAY_SEG * 2 * 3)
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))
    return g
  }, [])

  const rays = useMemo<Ray[]>(
    () =>
      Array.from({ length: RAY_COUNT }, () => ({
        age: 0,
        life: 1,
        reach: 1,
        grow: 0.5,
        grav: 0.8,
        dir: new THREE.Vector3(0, 1, 0),
        color: PASTELS[0],
        seed: 0,
        faller: false,
        landed: false,
        alive: false,
      })),
    [],
  )
  const freeRays = useRef<number[]>([])
  const spawnAcc = useRef(0)
  const wasActive = useRef(false)
  const globalRef = useRef(0)
  const starClock = useRef(0)

  // ---- ripple pool ---------------------------------------------------------
  const rippleRefs = useRef<(THREE.Mesh | null)[]>([])
  const rippleMats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const rippleState = useMemo(
    () => Array.from({ length: RIPPLE_COUNT }, () => ({ age: -1, x: 0, z: 0 })),
    [],
  )
  const rippleCursor = useRef(0)

  const spawnRipple = (x: number, z: number) => {
    const i = rippleCursor.current
    rippleCursor.current = (rippleCursor.current + 1) % RIPPLE_COUNT
    rippleState[i].age = 0
    rippleState[i].x = THREE.MathUtils.clamp(x, -2.6, 2.6)
    rippleState[i].z = THREE.MathUtils.clamp(z, -2.6, 2.6)
  }

  // ---- star pool -----------------------------------------------------------
  const starRefs = useRef<(THREE.Sprite | null)[]>([])
  const starMats = useRef<(THREE.SpriteMaterial | null)[]>([])
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, () => {
        // scattered shell around & above the burst
        const az = Math.random() * Math.PI * 2
        const el = Math.random() * Math.PI * 0.55
        const r = 1.5 + Math.random() * 2.1
        return {
          x: Math.cos(el) * Math.sin(az) * r,
          y: ORIGIN_Y + Math.sin(el) * r * 0.9,
          z: Math.cos(el) * Math.cos(az) * r * 0.6 - 0.4,
          period: 1.6 + Math.random() * 2.6,
          offset: Math.random(),
          maxO: 0.35 + Math.random() * 0.5,
          scale: 0.05 + Math.random() * 0.09,
        }
      }),
    [],
  )

  const groupRef = useRef<THREE.Group>(null)
  const coreMat = useRef<THREE.SpriteMaterial>(null)

  const initRay = (r: Ray, faller: boolean) => {
    const az = Math.random() * Math.PI * 2
    const el = faller
      ? THREE.MathUtils.degToRad(2 + Math.random() * 26)
      : THREE.MathUtils.degToRad(14 + Math.random() * 66)
    r.dir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))
    r.age = 0
    r.life = faller ? 2.4 + Math.random() * 0.5 : 1.1 + Math.random() * 0.9
    r.reach = faller ? 1.6 + Math.random() * 0.8 : 0.9 + Math.random() * 1.0
    r.grow = faller ? 0.7 : 0.45
    r.grav = faller ? 1.9 + Math.random() * 0.6 : 0.5 + Math.random() * 0.6
    r.color = PASTELS[(Math.random() * PASTELS.length) | 0]
    r.seed = Math.random() * 10
    r.faller = faller
    r.landed = false
    r.alive = true
  }

  useEffect(() => {
    return () => {
      rayGeo.dispose()
      starTexture.dispose()
      coreTexture.dispose()
    }
  }, [rayGeo, starTexture, coreTexture])

  useFrame((_, delta) => {
    if (paused) return // frozen for share-card capture
    const dt = Math.min(delta, 0.05)
    starClock.current += dt

    // global fade-in / fade-out
    const target = active ? 1 : 0
    globalRef.current += (target - globalRef.current) * (1 - Math.exp(-4 * dt))
    const g = globalRef.current
    if (groupRef.current) groupRef.current.visible = g > 0.015

    // reset the pool when the effect turns off (re-entry replays the burst)
    if (wasActive.current && !active) {
      wasActive.current = false
      for (const r of rays) r.alive = false
      for (const s of rippleState) s.age = -1
    }
    if (active && !wasActive.current) {
      // ignition: one big pop, then continuous burn
      wasActive.current = true
      freeRays.current = rays.map((_, i) => i)
      for (let n = 0; n < BURST_ON_ACTIVATE && freeRays.current.length > 0; n++) {
        initRay(rays[freeRays.current.pop() as number], Math.random() < 0.22)
      }
      spawnRipple((Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2)
    }

    const positions = rayGeo.attributes.position as THREE.BufferAttribute
    const colors = rayGeo.attributes.color as THREE.BufferAttribute
    const posArr = positions.array as Float32Array
    const colArr = colors.array as Float32Array

    // spawn to keep the burn alive
    if (active) {
      spawnAcc.current += SPAWN_RATE * dt
      while (spawnAcc.current >= 1 && freeRays.current.length > 0) {
        spawnAcc.current -= 1
        initRay(rays[freeRays.current.pop() as number], Math.random() < 0.2)
      }
      if (freeRays.current.length === 0) spawnAcc.current = Math.min(spawnAcc.current, 1)
    }

    // ---- update rays ----
    for (let i = 0; i < RAY_COUNT; i++) {
      const r = rays[i]
      if (!r.alive) {
        // collapse dead rays at the origin, black (invisible under additive)
        const o0 = i * RAY_SEG * 2 * 3
        for (let v = 0; v < RAY_SEG * 2; v++) {
          const o = o0 + v * 3
          posArr[o] = 0
          posArr[o + 1] = 0
          posArr[o + 2] = 0
          colArr[o] = 0
          colArr[o + 1] = 0
          colArr[o + 2] = 0
        }
        continue
      }
      r.age += dt
      const p = r.age / r.life
      if (p >= 1) {
        r.alive = false
        freeRays.current.push(i)
        continue
      }
      const growP = clamp01(r.age / r.grow)
      const reach = r.reach * (1 - Math.pow(1 - growP, 3)) // ease-out cubic
      const env =
        Math.min(1, r.age / 0.08) *
        (1 - smoothstep(0.55, 1, p)) *
        (0.85 + 0.15 * Math.sin(r.age * 38 + r.seed))
      const bright = env * g * 1.9

      // faller tip crosses the ground → ripple + quick fade-out
      if (r.faller && !r.landed) {
        const droopTip = 0.5 * r.grav * r.age * r.age
        if (ORIGIN_Y + r.dir.y * reach - droopTip <= GROUND_Y) {
          r.landed = true
          spawnRipple(r.dir.x * reach, r.dir.z * reach)
          r.life = Math.min(r.life, r.age + 0.25)
        }
      }

      const base = i * RAY_SEG * 2 * 3
      for (let sIdx = 0; sIdx < RAY_SEG; sIdx++) {
        for (let end = 0; end < 2; end++) {
          const u = (sIdx + end) / RAY_SEG
          const s = u * reach
          const droop = 0.5 * r.grav * r.age * r.age * u * u
          const o = base + (sIdx * 2 + end) * 3
          posArr[o] = r.dir.x * s
          posArr[o + 1] = ORIGIN_Y + r.dir.y * s - droop
          posArr[o + 2] = r.dir.z * s
          // taper brightness toward the tip so the root reads hottest
          const taper = 1 - u * 0.45
          colArr[o] = r.color.r * bright * taper
          colArr[o + 1] = r.color.g * bright * taper
          colArr[o + 2] = r.color.b * bright * taper
        }
      }
    }
    positions.needsUpdate = true
    colors.needsUpdate = true

    // ---- update ripples ----
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
      mesh.scale.setScalar(0.5 + p * 1.7)
      mesh.position.set(s.x, GROUND_Y, s.z)
      mat.opacity = 0.4 * Math.pow(1 - p, 1.6) * g
    }

    // ---- update stars ----
    for (let i = 0; i < STAR_COUNT; i++) {
      const st = stars[i]
      const mat = starMats.current[i]
      const sprite = starRefs.current[i]
      if (!mat || !sprite) continue
      const tw = Math.sin((starClock.current / st.period + st.offset) * Math.PI * 2)
      const tw01 = Math.max(0, tw)
      mat.opacity = Math.pow(tw01, 2.4) * st.maxO * g
      sprite.scale.setScalar(st.scale * (0.85 + 0.3 * tw01))
    }

    // ---- bright core at the emission point ----
    if (coreMat.current) {
      const flicker = 0.82 + 0.18 * Math.sin(starClock.current * 13)
      coreMat.current.opacity = 0.75 * g * flicker
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      {/* pastel light-rays — one draw call */}
      <lineSegments geometry={rayGeo} renderOrder={6} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* landing ripples on the invisible ground plane */}
      {Array.from({ length: RIPPLE_COUNT }, (_, i) => (
        <mesh
          key={`rip${i}`}
          ref={(m) => {
            rippleRefs.current[i] = m
          }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_Y, 0]}
          renderOrder={5}
        >
          <ringGeometry args={[0.42, 0.5, 48]} />
          <meshBasicMaterial
            ref={(m) => {
              rippleMats.current[i] = m
            }}
            color="#BFE8FF"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {/* twinkling four-point stars */}
      {stars.map((st, i) => (
        <sprite
          key={`star${i}`}
          ref={(s) => {
            starRefs.current[i] = s
          }}
          position={[st.x, st.y, st.z]}
          scale={[st.scale, st.scale, 1]}
          renderOrder={7}
        >
          <spriteMaterial
            ref={(m) => {
              starMats.current[i] = m
            }}
            map={starTexture}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}

      {/* bright heart of the burst */}
      <sprite position={[0, ORIGIN_Y, 0]} scale={[0.55, 0.55, 1]} renderOrder={7}>
        <spriteMaterial
          ref={coreMat}
          map={coreTexture}
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </group>
  )
}
