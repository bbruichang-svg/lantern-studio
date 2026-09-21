"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { BODY_TOP_Y, RING_CAP_HEIGHT, RING_RADIUS, buildLanternGeometry } from "@/lib/lantern/geometry"
import { ensureFace } from "@/lib/lantern/faces"
import { LanternCanvas } from "./LanternCanvas"
import { computeIdleSway, computeLightingFrame } from "./LanternLighting"
import type { FacePreset, LanternColor, LanternPhase } from "@/lib/lantern/types"

type LanternModelProps = {
  color: LanternColor
  face: FacePreset | null
  phase: LanternPhase
  onCoreClick: () => void
}

const RING_COLOR = "#24201D"
const CAP_COLOR = "#181512"

function makeBloomTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
    g.addColorStop(0, "rgba(255,255,255,0.9)")
    g.addColorStop(0.35, "rgba(255,255,255,0.28)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function LanternModel({ color, face, phase, onCoreClick }: LanternModelProps) {
  const lanternTexture = useMemo(() => new LanternCanvas(), [])
  const geometry = useMemo(() => buildLanternGeometry(), [])
  const bloomTexture = useMemo(() => makeBloomTexture(), [])

  const facingGroup = useRef<THREE.Group>(null)
  const swayGroup = useRef<THREE.Group>(null)
  const paperMaterial = useRef<THREE.MeshStandardMaterial>(null)
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const bloomMaterial = useRef<THREE.SpriteMaterial>(null)
  const coreLight = useRef<THREE.PointLight>(null)
  const coreBulb = useRef<THREE.MeshBasicMaterial>(null)
  const sparkMesh = useRef<THREE.Mesh>(null)
  const sparkMaterial = useRef<THREE.MeshBasicMaterial>(null)

  // per-frame accumulation (kept out of React state, spec §38)
  const timeRef = useRef(0)
  const lightTimeRef = useRef(-1)
  const prevPhaseRef = useRef<LanternPhase>(phase)

  const targetBase = useMemo(() => new THREE.Color(color.base), [color.base])
  const targetGlow = useMemo(() => new THREE.Color(color.glow), [color.glow])

  useEffect(() => {
    const src = face?.src ?? null
    if (!src) {
      lanternTexture.setFaceImage(null)
      return
    }
    let cancelled = false
    void ensureFace(src).then(() => {
      if (!cancelled) lanternTexture.setFaceImage(src)
    })
    // DEBUG: expose texture layers for inspection (remove before V2)
    if (typeof window !== "undefined") {
      ;(window as unknown as Record<string, unknown>).__lanternDebug = lanternTexture
    }
    return () => {
      cancelled = true
    }
  }, [face, lanternTexture])

  useEffect(() => {
    return () => {
      geometry.dispose()
      lanternTexture.texture.dispose()
      bloomTexture.dispose()
    }
  }, [geometry, lanternTexture, bloomTexture])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    timeRef.current += dt

    // reset the timeline if the user goes back to the studio
    if (prevPhaseRef.current !== phase) {
      if (phase === "studio" || phase === "ready") lightTimeRef.current = -1
      if (phase === "lighting" && lightTimeRef.current < 0) lightTimeRef.current = 0
      prevPhaseRef.current = phase
    }
    const lit = lightTimeRef.current >= 0
    if (lit) lightTimeRef.current += dt

    const frame = lit ? computeLightingFrame(lightTimeRef.current) : null

    // gentle hanging sway, boosted briefly while lighting up
    if (swayGroup.current) {
      const boost = frame ? frame.swayBoost : 1
      const idle = computeIdleSway(timeRef.current, boost)
      swayGroup.current.rotation.z = idle.rotZ
      swayGroup.current.rotation.x = idle.rotX
    }

    const k = 1 - Math.exp(-6 * dt)
    if (paperMaterial.current) {
      paperMaterial.current.color.lerp(targetBase, k)
      paperMaterial.current.emissive.lerp(targetGlow, k)
      paperMaterial.current.emissiveIntensity = frame ? frame.emissive : 0
    }
    if (coreLight.current) {
      coreLight.current.color.lerp(targetGlow, k)
      coreLight.current.intensity = frame ? frame.pointIntensity : 0
    }
    if (glowMaterial.current) {
      glowMaterial.current.color.lerp(targetGlow, k)
      glowMaterial.current.opacity = frame ? frame.glow * 0.4 : 0
    }
    if (bloomMaterial.current) {
      bloomMaterial.current.color.lerp(targetGlow, k)
      bloomMaterial.current.opacity = frame ? frame.glow * 0.5 : 0
    }
    if (coreBulb.current) {
      coreBulb.current.color.lerp(targetGlow, k)
      coreBulb.current.opacity = frame ? 0.05 + frame.core * 0.95 : 0.05
    }
    if (sparkMesh.current && sparkMaterial.current) {
      const s = frame ? frame.spark : 0
      const scale = 0.4 + s * 2.2
      sparkMesh.current.scale.setScalar(scale)
      sparkMaterial.current.opacity = s
    }
  })

  const coreInteractive = phase === "ready"

  return (
    <group>
      {/* soft bloom sprite — drawn behind the lantern, halo spills around the silhouette */}
      <sprite renderOrder={-1} position={[0, 0, 0]} scale={[6.2, 6.2, 1]}>
        <spriteMaterial
          ref={bloomMaterial}
          map={bloomTexture}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </sprite>

      {/* outer halo — backside additive sphere, the "air around the lantern" */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[1.95, 32, 24]} />
        <meshBasicMaterial
          ref={glowMaterial}
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>

      <group ref={facingGroup} rotation={[0, Math.PI, 0]}>
        <group ref={swayGroup}>
          {/* paper body */}
          <mesh geometry={geometry}>
            <meshStandardMaterial
              ref={paperMaterial}
              map={lanternTexture.texture}
              emissiveMap={lanternTexture.texture}
              emissive={color.glow}
              emissiveIntensity={0}
              color={color.base}
              roughness={0.82}
              metalness={0}
            />
          </mesh>

          {/* top & bottom structure — small rings where the sphere meets the opening */}
          <mesh position={[0, BODY_TOP_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RING_RADIUS, 0.022, 10, 48]} />
            <meshStandardMaterial color={RING_COLOR} roughness={0.62} metalness={0.05} />
          </mesh>
          <mesh position={[0, -BODY_TOP_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RING_RADIUS, 0.022, 10, 48]} />
            <meshStandardMaterial color={RING_COLOR} roughness={0.62} metalness={0.05} />
          </mesh>
          {/* caps so the openings never reveal the hollow inside */}
          <mesh position={[0, BODY_TOP_Y + RING_CAP_HEIGHT - 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[RING_RADIUS - 0.008, 48]} />
            <meshStandardMaterial color={CAP_COLOR} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -(BODY_TOP_Y + RING_CAP_HEIGHT - 0.015), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[RING_RADIUS - 0.008, 48]} />
            <meshStandardMaterial color={CAP_COLOR} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>

          {/* light core: wick + bulb, small and quiet */}
          <group position={[0, -(BODY_TOP_Y + RING_CAP_HEIGHT) + 0.1, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.028, 0.034, 0.09, 12]} />
              <meshStandardMaterial color="#2A241F" roughness={0.7} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.055, 16, 12]} />
              <meshBasicMaterial ref={coreBulb} color="#FFF6DE" transparent opacity={0.05} />
            </mesh>
            <pointLight ref={coreLight} color={color.glow} intensity={0} distance={4.5} decay={2} />
            <mesh ref={sparkMesh} scale={0.4}>
              <sphereGeometry args={[0.1, 12, 10]} />
              <meshBasicMaterial
                ref={sparkMaterial}
                color="#FFE9B8"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            {/* click target for the lighting interaction */}
            <mesh
              visible={false}
              onClick={(e) => {
                e.stopPropagation()
                if (coreInteractive) onCoreClick()
              }}
              onPointerOver={() => {
                if (coreInteractive) document.body.style.cursor = "pointer"
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto"
              }}
            >
              <sphereGeometry args={[0.3, 12, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
