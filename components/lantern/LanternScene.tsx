"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Sparkles } from "@react-three/drei"
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
      {/* quiet night lighting — the paper stays readable but dim before lighting */}
      <ambientLight intensity={0.34} color="#46506A" />
      <directionalLight position={[3, 4, 5]} intensity={0.55} color="#AAB6CC" />
      <directionalLight position={[-4, -2, -3]} intensity={0.12} color="#3A4358" />

      {/* a few barely-there dust motes */}
      <Sparkles count={16} scale={[9, 5, 5]} size={2.2} speed={0.15} opacity={0.3} color="#9A927E" />

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
