"use client"

import { useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

/**
 * Release-route ground layer: a soft radial ground pool (fades to nothing at
 * the edges so no hard horizon line against the CSS night gradient), a
 * contact shadow that grounds the lantern, and a warm light pool that blooms
 * on the ground once the lantern is lit.
 *
 * The shadow is the "it really left the ground" signal: as the lantern soars
 * (soarProgress 0→1, written by SoarController) the shadow fades out while
 * spreading — it never pops away.
 */

function makeGroundTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 512
  c.height = 512
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(256, 256, 40, 256, 256, 256)
    g.addColorStop(0, "rgba(17,27,46,0.92)")
    g.addColorStop(0.55, "rgba(11,18,32,0.7)")
    g.addColorStop(1, "rgba(8,13,24,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 512, 512)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128)
    g.addColorStop(0, "rgba(0,0,0,0.6)")
    g.addColorStop(0.5, "rgba(0,0,0,0.3)")
    g.addColorStop(1, "rgba(0,0,0,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makePoolTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
    g.addColorStop(0, "rgba(255,214,160,0.5)")
    g.addColorStop(0.55, "rgba(255,200,140,0.16)")
    g.addColorStop(1, "rgba(255,200,140,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

type ReleaseGroundProps = {
  /** 0 (grounded) → 1 (apex), written every frame by SoarController */
  soarProgress: { current: number }
  /** lantern is lit → warm pool blooms on the ground */
  lit: boolean
}

export default function ReleaseGround({ soarProgress, lit }: ReleaseGroundProps) {
  const groundTex = useMemo(() => makeGroundTexture(), [])
  const shadowTex = useMemo(() => makeShadowTexture(), [])
  const poolTex = useMemo(() => makePoolTexture(), [])
  const shadow = useRef<THREE.Mesh>(null)
  const pool = useRef<THREE.Mesh>(null)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const p = soarProgress.current
    const k = 1 - Math.exp(-3 * Math.min(delta, 0.05))

    if (shadow.current) {
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      // grounded: faint breathing presence · airborne: fade out while spreading
      const base = 0.52 + Math.sin(t * 1.1) * 0.06
      const target = base * (1 - p)
      mat.opacity += (target - mat.opacity) * k
      const s = 2.6 + p * 1.8
      shadow.current.scale.set(s, s, 1)
    }
    if (pool.current) {
      const mat = pool.current.material as THREE.MeshBasicMaterial
      // warm pool lives at the takeoff point and dims as the lamp departs
      const target = lit ? 0.26 * (1 - p) : 0
      mat.opacity += (target - mat.opacity) * k
    }
  })

  return (
    <group>
      {/* ground — soft radial disc, no hard horizon against the page gradient */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -1.16, 0]} renderOrder={0}>
        <planeGeometry args={[26, 26]} />
        <meshBasicMaterial map={groundTex} transparent depthWrite={false} />
      </mesh>
      {/* contact shadow */}
      <mesh ref={shadow} rotation-x={-Math.PI / 2} position={[0, -1.155, 0]} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} opacity={0.52} />
      </mesh>
      {/* warm pool once lit */}
      <mesh ref={pool} rotation-x={-Math.PI / 2} position={[0, -1.15, 0]} renderOrder={2}>
        <planeGeometry args={[3.8, 3.8]} />
        <meshBasicMaterial
          map={poolTex}
          transparent
          depthWrite={false}
          opacity={0}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}
