"use client"

import { useRef } from "react"
import * as THREE from "three"
import { Canvas, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import LanternModel from "./LanternModel"
import type { FacePreset, LanternColor, LanternPhase } from "@/lib/lantern/types"

type LanternSceneProps = {
  color: LanternColor
  face: FacePreset | null
  phase: LanternPhase
  onCoreClick: () => void
}

/**
 * Studio lighting while editing (paper reads true to its colour); once the
 * lantern is lit the environment drops to a dark night so the paper light
 * clearly comes from INSIDE the lantern, with a faint cool blue fill from
 * behind to keep the night readable.
 */
function EnvironmentLights({ phase }: { phase: LanternPhase }) {
  const ambient = useRef<THREE.AmbientLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const night = useRef<THREE.DirectionalLight>(null)

  const studio = phase === "studio" || phase === "ready"
  const target = studio
    ? { amb: 1.0, key: 0.85, fill: 0.25, night: 0 }
    : { amb: 0.16, key: 0.06, fill: 0.04, night: 0.55 }

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

export default function LanternScene({ color, face, phase, onCoreClick }: LanternSceneProps) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 2]}
      camera={{ fov: 35, position: [0, 0.55, 5.4], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      <EnvironmentLights phase={phase} />

      <LanternModel color={color} face={face} phase={phase} onCoreClick={onCoreClick} />

      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.65}
        zoomSpeed={0.6}
        minDistance={3.4}
        maxDistance={7.5}
        minPolarAngle={0.85}
        maxPolarAngle={2.05}
        target={[0, 0, 0]}
      />
    </Canvas>
  )
}
