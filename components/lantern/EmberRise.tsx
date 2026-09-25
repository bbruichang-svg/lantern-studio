"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { BODY_TOP_Y, RING_CAP_HEIGHT } from "@/lib/lantern/geometry"
import { computeGust, gustNow } from "./LanternLighting"

type EmberRiseProps = {
  /** true once the lantern is fully lit (finished / share stages) */
  active: boolean
  /** ember colour — derived from the lantern's own glow (city colour) */
  tint: THREE.Color
  /** freeze all animation — used while capturing the share card */
  paused?: boolean
  /** prefers-reduced-motion: keep the slow rise, drop the wind advection */
  reduceMotion?: boolean
}

/**
 * Warm light-motes rising from the top opening — the lantern's steady
 * state. The lantern's verb is "rise", not "burn": sparse motes drift up
 * like incense warmth, each tinted by the city colour the user chose.
 *
 * One THREE.Points draw call; per-particle alpha lives in the colour
 * attribute (additive blending — black is invisible). At activation it
 * surges (a dense column of motes lifted at once — the ignition moment),
 * then settles into the sparse steady rise.
 */

const ORIGIN_Y = BODY_TOP_Y + RING_CAP_HEIGHT + 0.06
const COUNT = 120
const SPAWN_RATE = 3.8 // motes / second, steady state (v2 微调: 2.6→3.8, 存活约 14→21 颗仍克制)
const SURGE_RATE = 30 // motes / second during the ignition surge
const SURGE_WINDOW = 1.4 // seconds of surge after activation
const START_DELAY = 0 // motes take over the moment the lantern is lit

const WARM = new THREE.Color("#FFD9A6")

type Mote = {
  age: number
  life: number
  vy: number
  amp: number
  freq: number
  phase: number
  x0: number
  z0: number
  whiten: number
  alive: boolean
}

function createMotes(): Mote[] {
  return Array.from({ length: COUNT }, () => ({
    age: 0,
    life: 0,
    vy: 0.3,
    amp: 0.12,
    freq: 1.2,
    phase: 0,
    x0: 0,
    z0: 0,
    whiten: 0,
    alive: false,
  }))
}

function makeMoteTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 64
  c.height = 64
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32)
    g.addColorStop(0, "rgba(255,255,255,1)")
    g.addColorStop(0.35, "rgba(255,255,255,0.4)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function EmberRise({ active, tint, paused = false, reduceMotion = false }: EmberRiseProps) {
  const texture = useMemo(() => makeMoteTexture(), [])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage))
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage))
    return g
  }, [])

  // All mutable particle state lives behind refs — the react-hooks
  // immutability rules forbid in-place mutation of values returned from
  // hooks, so per-frame writes go through ref paths instead.
  const stateRef = useRef<Mote[] | null>(null)
  const free = useRef<number[]>([])
  const spawnAcc = useRef(0)
  const activeAge = useRef(0)
  const wasActive = useRef(false)
  const globalRef = useRef(0)
  const tintRef = useRef(tint)
  const groupRef = useRef<THREE.Group>(null)
  const pointsRef = useRef<THREE.Points>(null)

  useEffect(() => {
    tintRef.current = tint
  }, [tint])

  useEffect(() => {
    return () => {
      geo.dispose()
      texture.dispose()
    }
  }, [geo, texture])

  useFrame((_, delta) => {
    if (paused) return // frozen for share-card capture
    const dt = Math.min(delta, 0.05)

    if (!stateRef.current) stateRef.current = createMotes()
    const state = stateRef.current

    const target = active ? 1 : 0
    globalRef.current += (target - globalRef.current) * (1 - Math.exp(-1.8 * dt))
    const g = globalRef.current
    if (groupRef.current) groupRef.current.visible = g > 0.015

    if (wasActive.current && !active) {
      wasActive.current = false
      for (const s of state) s.alive = false
    }
    if (active && !wasActive.current) {
      wasActive.current = true
      activeAge.current = 0
      free.current = state.map((_, i) => i)
    }
    if (active) activeAge.current += dt

    // buffer arrays are read from the mounted points object (ref path)
    const pgeo = pointsRef.current?.geometry
    if (!pgeo) return
    const positions = pgeo.attributes.position as THREE.BufferAttribute
    const colors = pgeo.attributes.color as THREE.BufferAttribute
    const posArr = positions.array as Float32Array
    const colArr = colors.array as Float32Array

    const initMote = (i: number) => {
      const s = state[i]
      const r = Math.sqrt(Math.random()) * 0.12
      const a = Math.random() * Math.PI * 2
      s.x0 = Math.cos(a) * r
      s.z0 = Math.sin(a) * r
      s.age = 0
      s.life = 4 + Math.random() * 3
      s.vy = 0.24 + Math.random() * 0.26
      s.amp = 0.06 + Math.random() * 0.14
      s.freq = 0.6 + Math.random() * 1.2
      s.phase = Math.random() * Math.PI * 2
      s.whiten = Math.random() * 0.45
      s.alive = true
    }

    // ignition surge: a dense column lifts at once, then the rise settles
    // into the sparse steady state
    if (active && activeAge.current > START_DELAY) {
      const rate = activeAge.current < SURGE_WINDOW ? SURGE_RATE : SPAWN_RATE
      spawnAcc.current += rate * dt
      while (spawnAcc.current >= 1 && free.current.length > 0) {
        spawnAcc.current -= 1
        initMote(free.current.pop() as number)
      }
      if (free.current.length === 0) spawnAcc.current = Math.min(spawnAcc.current, 1)
    }

    const tint = tintRef.current
    // 风过事件: the passing gust advects the motes sideways (shared clock
    // with the lantern's sway, so the wind reads as one event).
    // reduced-motion: the wind is purely decorative — no advection.
    const gust = reduceMotion ? { strength: 0, dir: 1 } : computeGust(gustNow())
    const windDrift = gust.dir * gust.strength * 0.35 * dt
    for (let i = 0; i < COUNT; i++) {
      const s = state[i]
      const o = i * 3
      if (!s.alive) {
        posArr[o] = 0
        posArr[o + 1] = 0
        posArr[o + 2] = 0
        colArr[o] = 0
        colArr[o + 1] = 0
        colArr[o + 2] = 0
        continue
      }
      s.age += dt
      const p = s.age / s.life
      if (p >= 1) {
        s.alive = false
        free.current.push(i)
        posArr[o] = 0
        posArr[o + 1] = 0
        posArr[o + 2] = 0
        colArr[o] = 0
        colArr[o + 1] = 0
        colArr[o + 2] = 0
        continue
      }
      // 风过事件: sideways advection
      s.x0 += windDrift
      const x = s.x0 + Math.sin(s.age * s.freq * Math.PI + s.phase) * s.amp
      const y = ORIGIN_Y + s.vy * s.age
      const z = s.z0 + Math.cos(s.age * s.freq * Math.PI * 0.8 + s.phase) * s.amp * 0.7
      posArr[o] = x
      posArr[o + 1] = y
      posArr[o + 2] = z

      // fade in over the first 20%, fade out over the last 35%
      const env = Math.min(1, p / 0.2) * (1 - Math.max(0, (p - 0.65) / 0.35))
      const bright = env * g * 1.5
      colArr[o] = (tint.r + (1 - tint.r) * s.whiten) * bright
      colArr[o + 1] = (tint.g + (1 - tint.g) * s.whiten) * bright
      colArr[o + 2] = (tint.b + (1 - tint.b) * s.whiten) * bright
    }
    positions.needsUpdate = true
    colors.needsUpdate = true
  })

  return (
    <group ref={groupRef} visible={false}>
      <points ref={pointsRef} geometry={geo} renderOrder={6} frustumCulled={false}>
        <pointsMaterial
          size={0.085}
          map={texture}
          vertexColors
          transparent
          opacity={1}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

// keep the WARM constant referenced for future tint mixing at the call site
export const EMBER_WARM_ANCHOR = WARM
