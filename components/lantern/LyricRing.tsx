"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

type LyricRingProps = {
  /** true once the lantern is fully lit (finished / share stages) */
  active: boolean
  /** the moon lyric that circles the lantern; null/empty → no ring */
  text: string | null
  /** freeze all animation — used while capturing the share card */
  paused?: boolean
}

/**
 * 走马灯词环 — a revolving lyric band around the lantern.
 *
 * The lantern's own Text texture layer can't be used: spinning the lantern
 * would carry the face away with it. A real 走马灯 has its revolving shade
 * OUTSIDE the light source, so this is a separate open cylinder slightly
 * larger than the paper (r 1.02), band sitting below the chin so the
 * glyphs never cross the face.
 *
 * The visible arc is the FRONT one (the back arc is occluded by the opaque
 * paper via depth test) — ink-dark glyphs over the glowing paper, the same
 * ink-blocks-light language as the DTZ strokes.
 */

const RING_RADIUS_TOP = 0.92 // the silhouette narrows low on the sphere —
const RING_RADIUS_BOTTOM = 0.72 // a tapered band hugs it evenly
const BAND_HEIGHT = 0.22
const BAND_Y = -0.72
const SPIN_SPEED = 0.1 // rad/s — one revolution ≈ 63s
const START_DELAY = 1.5 // seconds after activation (let the swell have the stage)
const FADE_TIME = 2.0
const TARGET_OPACITY = 0.5

const INK = "#3A2A1C"

function makeRingTexture(text: string): THREE.CanvasTexture {
  const W = 2048
  const H = 128
  const c = document.createElement("canvas")
  c.width = W
  c.height = H
  const ctx = c.getContext("2d")
  if (ctx) {
    const phrase = `${text}　✦　`
    ctx.font = "500 46px 'Songti SC', 'Noto Serif SC', 'SimSun', serif"
    ctx.textBaseline = "middle"
    ctx.fillStyle = "#FFFFFF"
    // tile the phrase across the full width so the wrap seam is invisible
    const w = ctx.measureText(phrase).width
    let x = 0
    while (x < W + w) {
      ctx.fillText(phrase, x, H * 0.54)
      x += w
    }
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

export default function LyricRing({ active, text, paused = false }: LyricRingProps) {
  const texture = useMemo(() => (text ? makeRingTexture(text) : null), [text])

  const groupRef = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const activeAge = useRef(0)
  const wasActive = useRef(false)
  const opacityRef = useRef(0)

  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  useFrame((_, delta) => {
    if (paused) return // frozen for share-card capture
    const dt = Math.min(delta, 0.05)

    if (active && !wasActive.current) {
      wasActive.current = true
      activeAge.current = 0
    }
    if (!active) wasActive.current = false
    if (active) activeAge.current += dt

    // fade in after the delay, fade out quickly when deactivated
    const target = active && activeAge.current > START_DELAY ? TARGET_OPACITY : 0
    const speed = target > opacityRef.current ? dt / FADE_TIME : dt / 0.6
    opacityRef.current += (target - opacityRef.current) * Math.min(1, speed * 4)
    if (mat.current) mat.current.opacity = opacityRef.current

    if (groupRef.current) {
      groupRef.current.rotation.y += dt * SPIN_SPEED
      groupRef.current.visible = opacityRef.current > 0.01
    }
  })

  if (!texture) return null

  return (
    <group ref={groupRef} visible={false}>
      <mesh position={[0, BAND_Y, 0]} renderOrder={8}>
        <cylinderGeometry args={[RING_RADIUS_TOP, RING_RADIUS_BOTTOM, BAND_HEIGHT, 64, 1, true]} />
        <meshBasicMaterial
          ref={mat}
          map={texture}
          color={INK}
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
