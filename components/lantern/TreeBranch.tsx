"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"

/**
 * Silhouette bare branch for the hang finale (挂树终幕). A dark branch
 * reaches in from off-screen left; its tip is the hang point where the
 * lantern settles. Purely procedural.
 *
 * Shape notes (v2 — the v1 single-radius tube read as a stiff pipe):
 *  - the main branch is built from FOUR tapering segments (0.05 → 0.021)
 *    with sphere joints at the seams, so it thickens toward the trunk
 *    and fines toward the tip like real wood;
 *  - two upward forks and two drooping twigs break the silhouette line;
 *  - small buds cap the fork tips.
 *
 * The hang tip stays at (-0.5, 3.05, -0.8) — HANG_LANTERN_POS depends on
 * it (枝梢 y − HANG_LEN). Do not move the last main-segment point.
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

type V3 = [number, number, number]

type Seg = {
  /** control points (3 = ends + a gently bowed midpoint) */
  pts: V3[]
  /** tube radius for this segment */
  r: number
}

// main branch, tip → trunk split into tapering segments (trunk side first)
const MAIN_SEGS: Seg[] = [
  {
    // thickest section, mostly off-screen — the "trunk" entering the frame
    pts: [
      [-2.7, 2.3, -1.7],
      [-2.3, 2.48, -1.57],
      [-1.95, 2.7, -1.42],
    ],
    r: 0.05,
  },
  {
    pts: [
      [-1.95, 2.7, -1.42],
      [-1.62, 2.84, -1.28],
      [-1.3, 2.95, -1.12],
    ],
    r: 0.04,
  },
  {
    pts: [
      [-1.3, 2.95, -1.12],
      [-1.08, 3.04, -1.02],
      [-0.88, 3.1, -0.92],
    ],
    r: 0.031,
  },
  {
    // final reach to the hang tip — thinnest, slight downward settle
    pts: [
      [-0.88, 3.1, -0.92],
      [-0.7, 3.09, -0.86],
      [-0.5, 3.05, -0.8],
    ],
    r: 0.021,
  },
]

// sphere joints where tapering segments meet — hides the radius steps
const JOINTS: [V3, number][] = [
  [[-1.95, 2.7, -1.42], 0.046],
  [[-1.3, 2.95, -1.12], 0.036],
  [[-0.88, 3.1, -0.92], 0.027],
]

// secondary growth — two upward forks, two drooping twigs
const TWIGS: Seg[] = [
  {
    // upward fork off the first joint
    pts: [
      [-1.95, 2.7, -1.42],
      [-1.82, 2.9, -1.37],
      [-1.74, 3.12, -1.33],
    ],
    r: 0.02,
  },
  {
    // upward fork off the second joint (reaches highest)
    pts: [
      [-1.3, 2.95, -1.12],
      [-1.22, 3.14, -1.08],
      [-1.17, 3.34, -1.05],
    ],
    r: 0.017,
  },
  {
    // small back-thorn off the third joint
    pts: [
      [-0.88, 3.1, -0.92],
      [-0.97, 3.17, -0.97],
      [-1.04, 3.23, -1.03],
    ],
    r: 0.012,
  },
  {
    // drooping twig below the mid section
    pts: [
      [-0.92, 3.07, -0.9],
      [-1.02, 2.9, -0.94],
      [-1.14, 2.72, -0.98],
    ],
    r: 0.014,
  },
  {
    // fine fork at the tip section, beside the hang point
    pts: [
      [-0.62, 3.055, -0.82],
      [-0.45, 3.13, -0.78],
      [-0.3, 3.16, -0.75],
    ],
    r: 0.011,
  },
]

// buds: [position, radius] — capped fork tips, never near the hang point
const BUDS: [V3, number][] = [
  [[-1.74, 3.14, -1.33], 0.022],
  [[-1.17, 3.37, -1.05], 0.019],
  [[-1.04, 3.24, -1.03], 0.014],
  [[-1.15, 2.71, -0.98], 0.016],
  [[-0.29, 3.17, -0.75], 0.013],
]

function tubeFrom(pts: V3[], radius: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, 32, radius, 8, false)
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
      main: MAIN_SEGS.map((s) => tubeFrom(s.pts, s.r)),
      joints: JOINTS.map(([, r]) => new THREE.SphereGeometry(r, 10, 8)),
      twigs: TWIGS.map((t) => tubeFrom(t.pts, t.r)),
      buds: BUDS.map(([, r]) => new THREE.SphereGeometry(r, 10, 8)),
      // cap over the open tube end at the hang tip
      cap: new THREE.SphereGeometry(0.021, 10, 8),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      geos.main.forEach((g) => g.dispose())
      geos.joints.forEach((g) => g.dispose())
      geos.twigs.forEach((g) => g.dispose())
      geos.buds.forEach((g) => g.dispose())
      geos.cap.dispose()
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
      {/* main branch segments — the first mesh carries the shared ref */}
      {geos.main.map((g, i) => (
        <mesh key={`m${i}`} geometry={g}>
          <primitive object={material} attach="material" ref={i === 0 ? matRef : undefined} />
        </mesh>
      ))}
      {/* taper joints */}
      {geos.joints.map((g, i) => (
        <mesh key={`j${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* twigs & forks */}
      {geos.twigs.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* buds */}
      {geos.buds.map((g, i) => (
        <mesh key={`b${i}`} geometry={g} position={BUDS[i][0]}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* cap at the hang tip */}
      <mesh geometry={geos.cap} position={MAIN_SEGS[MAIN_SEGS.length - 1].pts[2]}>
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}
