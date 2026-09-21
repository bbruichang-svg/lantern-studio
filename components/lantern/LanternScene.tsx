"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import LanternModel from "./LanternModel"
import type { FacePreset, LanternColor, LanternPhase } from "@/lib/lantern/types"

type LanternSceneProps = {
  color: LanternColor
  face: FacePreset | null
  phase: LanternPhase
  onCoreClick: () => void
}

export default function LanternScene({ color, face, phase, onCoreClick }: LanternSceneProps) {
  return (
    <Canvas
      className="!absolute inset-0"
      dpr={[1, 2]}
      camera={{ fov: 35, position: [0, 0.55, 5.4], near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
    >
      {/* bright studio lighting — the paper reads true to its colour */}
      <ambientLight intensity={1.0} color="#FFFFFF" />
      <directionalLight position={[3, 4, 5]} intensity={0.85} color="#FFFDF8" />
      <directionalLight position={[-4, -2, -3]} intensity={0.25} color="#FFF8EE" />

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
