"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { BODY_TOP_Y, RING_CAP_HEIGHT } from "@/lib/lantern/geometry"

type AwakenedStarsProps = {
  /** true while the lantern is lit (lighting + finished stages) */
  active: boolean
  /** freeze all animation — used while capturing the share card */
  paused?: boolean
}

/**
 * Stars answering the lantern: invisible in the dark, once the lantern is
 * lit the stars wake up one by one — nearest first, the wake spreading
 * outward over ~6s — then hold a slow, low-amplitude twinkle. The night
 * sky responds to the user's light.
 *
 * 26 sprites, per-star awaken clock in refs, no React state.
 */

const ORIGIN_Y = BODY_TOP_Y + RING_CAP_HEIGHT
const STAR_COUNT = 26

/** deterministic PRNG (mulberry32) — pure, so the star layout is stable
    across renders and the react-hooks purity rule stays satisfied */
function makeRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

export default function AwakenedStars({ active, paused = false }: AwakenedStarsProps) {
  const texture = useMemo(() => makeStarTexture(), [])
  const groupRef = useRef<THREE.Group>(null)
  const matRefs = useRef<(THREE.SpriteMaterial | null)[]>([])
  const spriteRefs = useRef<(THREE.Sprite | null)[]>([])
  const clock = useRef(-1) // -1 = not awakened yet
  const wasActive = useRef(false)

  // stars scattered in a shell above & around the lantern, sorted near→far
  // so the wake spreads outward from the light
  const stars = useMemo(() => {
    const rand = makeRng(20260923)
    const list = Array.from({ length: STAR_COUNT }, () => {
      const az = rand() * Math.PI * 2
      const el = 0.08 + rand() * 0.95
      const r = 1.6 + rand() * 2.0
      return {
        x: Math.cos(el) * Math.sin(az) * r,
        y: ORIGIN_Y + Math.sin(el) * r * 1.05,
        z: Math.cos(el) * Math.cos(az) * r * 0.7 - 0.3,
        delay: 0,
        maxO: 0.5 + rand() * 0.4,
        scale: 0.06 + rand() * 0.08,
        freq: 0.35 + rand() * 0.5,
        phase: rand() * Math.PI * 2,
      }
    })
    const dx0 = 0
    const dy0 = ORIGIN_Y
    const dz0 = 0
    list.forEach((st) => {
      const d = Math.hypot(st.x - dx0, st.y - dy0, st.z - dz0)
      st.delay = 0.4 + (d / 5) * 5.2 + rand() * 0.35
    })
    return list
  }, [])

  useEffect(() => {
    return () => {
      texture.dispose()
    }
  }, [texture])

  useFrame((_, delta) => {
    if (paused) return // frozen for share-card capture
    const dt = Math.min(delta, 0.05)

    if (!active) {
      wasActive.current = false
      clock.current = -1
      if (groupRef.current) groupRef.current.visible = false
      return
    }
    if (!wasActive.current) {
      wasActive.current = true
      clock.current = 0
    }
    clock.current += dt
    if (groupRef.current) groupRef.current.visible = true

    for (let i = 0; i < STAR_COUNT; i++) {
      const st = stars[i]
      const mat = matRefs.current[i]
      const sprite = spriteRefs.current[i]
      if (!mat || !sprite) continue
      const wake = Math.min(1, Math.max(0, (clock.current - st.delay) / 1.2))
      if (wake <= 0) {
        mat.opacity = 0
        continue
      }
      const env = 1 - Math.pow(1 - wake, 2.2) // ease-out awaken
      const twinkle = 0.65 + 0.35 * Math.sin(clock.current * st.freq * Math.PI * 2 + st.phase)
      mat.opacity = env * st.maxO * twinkle
      sprite.scale.setScalar(st.scale * (0.9 + 0.25 * twinkle))
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      {stars.map((st, i) => (
        <sprite
          key={`awake${i}`}
          ref={(s) => {
            spriteRefs.current[i] = s
          }}
          position={[st.x, st.y, st.z]}
          scale={[st.scale, st.scale, 1]}
          renderOrder={4}
        >
          <spriteMaterial
            ref={(m) => {
              matRefs.current[i] = m
            }}
            map={texture}
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  )
}
