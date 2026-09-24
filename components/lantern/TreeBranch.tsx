"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

/**
 * Silhouette bare branch for the hang finale (挂树终幕). A dark branch
 * reaches in from off-screen left; its tip is the hang point where the
 * lantern settles. Purely procedural — a Catmull-Rom tube for the main
 * branch, thinner tubes for twigs, small spheres for buds.
 *
 * The colour (#120E0B) is a near-black slightly warmer than the night
 * gradient (#060B16/#0A1322), so it reads as a silhouette while the
 * lantern's point light still kisses the tip with a warm rim. All meshes
 * share ONE material whose opacity fades in (exponential approach).
 */

type TreeBranchProps = {
  /** fade the branch in when true (hang/dissolve/memory/share) */
  reveal: boolean
}

// main branch control points (world coords) — last point is the hang tip
const MAIN_PTS: [number, number, number][] = [
  [-2.7, 2.3, -1.7],
  [-1.95, 2.7, -1.42],
  [-1.3, 2.95, -1.12],
  [-0.88, 3.1, -0.92],
  [-0.5, 3.05, -0.8],
]

// twigs: [points, tube radius]
const TWIGS: { pts: [number, number, number][]; r: number }[] = [
  {
    // upward fork near the mid section
    pts: [
      [-1.32, 2.96, -1.1],
      [-1.18, 3.18, -1.06],
      [-1.02, 3.38, -1.0],
    ],
    r: 0.02,
  },
  {
    // drooping twig below the mid section
    pts: [
      [-0.92, 3.07, -0.9],
      [-1.02, 2.9, -0.94],
      [-1.14, 2.72, -0.98],
    ],
    r: 0.016,
  },
  {
    // small fork at the tip section
    pts: [
      [-0.62, 3.055, -0.82],
      [-0.45, 3.13, -0.78],
      [-0.3, 3.16, -0.75],
    ],
    r: 0.012,
  },
]

// buds: [position, radius]
const BUDS: [[number, number, number], number][] = [
  [[-1.3, 2.99, -1.11], 0.03],
  [[-1.02, 3.4, -1.0], 0.024],
  [[-1.16, 2.7, -0.99], 0.022],
  [[-0.3, 3.17, -0.75], 0.02],
  [[-0.86, 3.13, -0.9], 0.018],
]

function tubeFrom(pts: [number, number, number][], radius: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, 56, radius, 8, false)
}

export default function TreeBranch({ reveal }: TreeBranchProps) {
  // ref onto the shared material (primitive forwards it) — opacity is
  // written through the ref because react-hooks/immutability forbids
  // mutating the useMemo'd object directly
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#120E0B",
        roughness: 0.95,
        metalness: 0,
        transparent: true,
        opacity: 0,
      }),
    [],
  )

  const geos = useMemo(
    () => ({
      main: tubeFrom(MAIN_PTS, 0.045),
      cap: new THREE.SphereGeometry(0.045, 10, 8),
      twigs: TWIGS.map((t) => tubeFrom(t.pts, t.r)),
      buds: BUDS.map(([, r]) => new THREE.SphereGeometry(r, 10, 8)),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      geos.main.dispose()
      geos.cap.dispose()
      geos.twigs.forEach((g) => g.dispose())
      geos.buds.forEach((g) => g.dispose())
    }
  }, [material, geos])

  useFrame((_, delta) => {
    const mat = matRef.current
    if (!mat) return
    // exponential approach — ~1.2s to 95% once reveal flips true
    const target = reveal ? 1 : 0
    const k = 1 - Math.exp(-2.5 * Math.min(delta, 0.05))
    mat.opacity = mat.opacity + (target - mat.opacity) * k
  })

  return (
    <group>
      {/* main branch — its material carries the shared ref */}
      <mesh geometry={geos.main}>
        <primitive object={material} attach="material" ref={matRef} />
      </mesh>
      {/* cap over the open tube end at the hang tip */}
      <mesh geometry={geos.cap} position={MAIN_PTS[MAIN_PTS.length - 1]}>
        <primitive object={material} attach="material" />
      </mesh>
      {/* twigs */}
      {geos.twigs.map((g, i) => (
        <mesh key={`twig${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* buds */}
      {geos.buds.map((g, i) => (
        <mesh key={`bud${i}`} geometry={g} position={BUDS[i][0]}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
    </group>
  )
}
