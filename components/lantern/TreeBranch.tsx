"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { ROPE_LEN } from "./HangController"

/**
 * Silhouette branch for the hang finale (挂树终幕) — v3, redrawn after a
 * visual reference: one slender bough reaches in from off-screen left,
 * forks abundantly into fine twigs, and the twig tips carry small
 * clusters of glowing specks (leaf/star clusters in the reference).
 * The lantern hangs from the tip on a thin rope.
 *
 * Shape notes (v3):
 *  - the main bough tapers HARD (0.032 → 0.006) so the tip reads as a
 *    whip-thin twig, not a pipe; the curve dips then lifts gracefully;
 *  - ~12 secondary twigs (0.009 → 0.002) in varied attitudes — lifting,
 *    level, drooping, curling tips — plus a few tertiary forks;
 *  - ONE THREE.Points cloud (~240 specks) seeded by a pure hash
 *    (render-phase Math.random is forbidden), clustered at twig tips;
 *  - a thin rope (ROPE_LEN) drops from the tip; the lantern's top ring
 *    hangs at its end (see HangController — HANG_LANTERN_POS).
 *
 * The hang tip stays at (-0.5, 3.05, -0.8) — HANG_POINT depends on it.
 * Do not move the last main-segment point.
 *
 * All meshes share ONE MeshStandardMaterial whose opacity fades in
 * (exponential approach, written through a ref); the specks share one
 * PointsMaterial faded in the same way.
 */

type TreeBranchProps = {
  /** fade the branch in when true (hang/dissolve/memory/share) */
  reveal: boolean
}

type V3 = [number, number, number]

type Seg = {
  /** control points (3 = ends + a bowed midpoint) */
  pts: V3[]
  /** tube radius for this segment */
  r: number
}

// main bough, trunk side → hang tip, four tapering segments.
// the curve dips slightly mid-way then lifts into the tip.
const MAIN_SEGS: Seg[] = [
  {
    // thickest section, mostly off-screen — the "trunk" entering the frame
    pts: [
      [-2.7, 2.3, -1.7],
      [-2.3, 2.44, -1.57],
      [-1.95, 2.62, -1.42],
    ],
    r: 0.032,
  },
  {
    pts: [
      [-1.95, 2.62, -1.42],
      [-1.62, 2.8, -1.28],
      [-1.3, 2.94, -1.12],
    ],
    r: 0.024,
  },
  {
    // gentle dip — the bough settles under its own weight
    pts: [
      [-1.3, 2.94, -1.12],
      [-1.05, 3.05, -1.0],
      [-0.82, 3.09, -0.9],
    ],
    r: 0.016,
  },
  {
    // final whip-thin reach to the hang tip
    pts: [
      [-0.82, 3.09, -0.9],
      [-0.66, 3.1, -0.85],
      [-0.5, 3.05, -0.8],
    ],
    r: 0.008,
  },
]

// secondary twigs — varied attitudes along the bough (base → tip order).
// radii run 0.009 → 0.002: fine enough to read as twigs, not pipes.
const TWIGS: Seg[] = [
  {
    // low lifting fork near the trunk
    pts: [
      [-1.95, 2.62, -1.42],
      [-1.86, 2.78, -1.38],
      [-1.8, 2.95, -1.34],
    ],
    r: 0.009,
  },
  {
    // low drooper, hangs below the bough
    pts: [
      [-1.8, 2.68, -1.36],
      [-1.74, 2.5, -1.33],
      [-1.72, 2.34, -1.31],
    ],
    r: 0.007,
  },
  {
    // level reach forward
    pts: [
      [-1.6, 2.72, -1.3],
      [-1.42, 2.82, -1.22],
      [-1.24, 2.88, -1.14],
    ],
    r: 0.008,
  },
  {
    // lifting fork off the second joint — reaches high
    pts: [
      [-1.3, 2.94, -1.12],
      [-1.2, 3.1, -1.08],
      [-1.13, 3.28, -1.05],
    ],
    r: 0.008,
  },
  {
    // back-thorn, points up-left away from the camera
    pts: [
      [-1.15, 2.98, -1.08],
      [-1.26, 3.12, -1.14],
      [-1.36, 3.22, -1.19],
    ],
    r: 0.006,
  },
  {
    // drooping curl below the mid section
    pts: [
      [-1.0, 3.02, -0.98],
      [-1.06, 2.86, -1.0],
      [-1.16, 2.72, -1.04],
    ],
    r: 0.006,
  },
  {
    // forward level twig near the dip
    pts: [
      [-0.9, 3.08, -0.92],
      [-0.76, 3.16, -0.87],
      [-0.62, 3.2, -0.82],
    ],
    r: 0.006,
  },
  {
    // small upward flick just before the tip
    pts: [
      [-0.72, 3.1, -0.86],
      [-0.62, 3.2, -0.83],
      [-0.56, 3.3, -0.81],
    ],
    r: 0.0045,
  },
  {
    // fine twig past the hang point, droops forward
    pts: [
      [-0.55, 3.06, -0.81],
      [-0.42, 3.02, -0.76],
      [-0.3, 2.96, -0.72],
    ],
    r: 0.004,
  },
  {
    // upward curl at the very tip section
    pts: [
      [-0.5, 3.05, -0.8],
      [-0.4, 3.14, -0.77],
      [-0.33, 3.24, -0.74],
    ],
    r: 0.0035,
  },
  {
    // tiny forward dangle below the tip section
    pts: [
      [-0.62, 3.05, -0.83],
      [-0.56, 2.94, -0.8],
      [-0.52, 2.84, -0.79],
    ],
    r: 0.003,
  },
  {
    // last fine hair past the tip
    pts: [
      [-0.48, 3.06, -0.8],
      [-0.38, 3.1, -0.76],
      [-0.28, 3.12, -0.72],
    ],
    r: 0.002,
  },
]

// tertiary forks — off the tips of some twigs, one bend each, hair-fine
const FORKS: Seg[] = [
  {
    pts: [
      [-1.8, 2.95, -1.34],
      [-1.72, 3.04, -1.3],
      [-1.66, 3.1, -1.27],
    ],
    r: 0.0035,
  },
  {
    pts: [
      [-1.24, 2.88, -1.14],
      [-1.14, 2.94, -1.1],
      [-1.05, 2.98, -1.06],
    ],
    r: 0.003,
  },
  {
    pts: [
      [-1.13, 3.28, -1.05],
      [-1.05, 3.36, -1.02],
      [-0.98, 3.4, -0.99],
    ],
    r: 0.003,
  },
  {
    pts: [
      [-0.62, 3.2, -0.82],
      [-0.52, 3.26, -0.79],
      [-0.44, 3.3, -0.76],
    ],
    r: 0.002,
  },
]

// sphere joints where the tapering main segments meet — hides radius steps
const JOINTS: [V3, number][] = [
  [[-1.95, 2.62, -1.42], 0.028],
  [[-1.3, 2.94, -1.12], 0.02],
  [[-0.82, 3.09, -0.9], 0.012],
]

/** pure-hash pseudo random in [0,1) — deterministic, render-safe */
function hash(i: number, salt: number): number {
  const v = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453
  return v - Math.floor(v)
}

/** cluster centres: twig tips + fork tips + twig midpoints — dense chains */
const CLUSTER_CENTRES: V3[] = [
  ...FORKS.map((f) => f.pts[2]),
  ...TWIGS.map((t) => t.pts[1]),
  ...TWIGS.map((t) => t.pts[2]),
]

// specks: cluster blobs at twig tips/midpoints (~30 each) + sparse bough
// dust. positions are seeded by the pure hash so every render is identical.
function buildSpeckPositions(): Float32Array {
  const PER_CLUSTER = 48
  const DUST = 60
  const total = CLUSTER_CENTRES.length * PER_CLUSTER + DUST
  const arr = new Float32Array(total * 3)
  let p = 0
  for (let c = 0; c < CLUSTER_CENTRES.length; c++) {
    const [cx, cy, cz] = CLUSTER_CENTRES[c]
    for (let k = 0; k < PER_CLUSTER; k++) {
      const i = c * PER_CLUSTER + k
      // roughly gaussian spread via (r1+r2-1) — slightly elongated along
      // the twig so each cluster reads as a leaf-chain, not a ball
      const dx = (hash(i, 1) + hash(i, 2) - 1) * 0.11
      const dy = (hash(i, 3) + hash(i, 4) - 1) * 0.07
      const dz = (hash(i, 5) + hash(i, 6) - 1) * 0.11
      arr[p++] = cx + dx
      arr[p++] = cy + dy
      arr[p++] = cz + dz
    }
  }
  // sparse dust along the bough between joints
  for (let k = 0; k < DUST; k++) {
    const i = CLUSTER_CENTRES.length * PER_CLUSTER + k
    const t = hash(i, 7)
    // interpolate along the bough centreline (joint x range)
    const x = -2.2 + t * 1.75
    const y = 2.5 + hash(i, 8) * 0.7 + (x + 2.2) * 0.28
    arr[p++] = x + (hash(i, 9) - 0.5) * 0.5
    arr[p++] = y
    arr[p++] = -1.55 + t * 0.75 + (hash(i, 10) - 0.5) * 0.5
  }
  return arr
}

function tubeFrom(pts: V3[], radius: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, 32, radius, 8, false)
}

export default function TreeBranch({ reveal }: TreeBranchProps) {
  // refs onto the shared materials — opacity is written through refs
  // because react-hooks/immutability forbids mutating useMemo'd objects
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const speckMatRef = useRef<THREE.PointsMaterial>(null)

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

  const speckMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#FFF6E8",
        size: 0.12,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  const geos = useMemo(
    () => ({
      main: MAIN_SEGS.map((s) => tubeFrom(s.pts, s.r)),
      joints: JOINTS.map(([, r]) => new THREE.SphereGeometry(r, 10, 8)),
      twigs: TWIGS.map((t) => tubeFrom(t.pts, t.r)),
      forks: FORKS.map((t) => tubeFrom(t.pts, t.r)),
      specks: new THREE.BufferGeometry(),
      // thin rope dropping from the hang tip (lantern ring hangs at its end)
      rope: new THREE.CylinderGeometry(0.0035, 0.0035, ROPE_LEN, 6),
      ropeKnot: new THREE.SphereGeometry(0.009, 8, 6),
      // cap over the open tube end at the hang tip
      cap: new THREE.SphereGeometry(0.008, 10, 8),
    }),
    [],
  )

  // seed the speck buffer once — attribute stays immutable afterwards
  useEffect(() => {
    geos.specks.setAttribute("position", new THREE.BufferAttribute(buildSpeckPositions(), 3))
  }, [geos])

  useEffect(() => {
    return () => {
      material.dispose()
      speckMaterial.dispose()
      geos.main.forEach((g) => g.dispose())
      geos.joints.forEach((g) => g.dispose())
      geos.twigs.forEach((g) => g.dispose())
      geos.forks.forEach((g) => g.dispose())
      geos.specks.dispose()
      geos.rope.dispose()
      geos.ropeKnot.dispose()
      geos.cap.dispose()
    }
  }, [material, speckMaterial, geos])

  useFrame((_, delta) => {
    // exponential approach — ~1.2s to 95% once reveal flips true
    const target = reveal ? 1 : 0
    const k = 1 - Math.exp(-2.5 * Math.min(delta, 0.05))
    const mat = matRef.current
    if (mat) mat.opacity = mat.opacity + (target - mat.opacity) * k
    const sm = speckMatRef.current
    if (sm) sm.opacity = sm.opacity + (target * 0.85 - sm.opacity) * k
    if (process.env.NODE_ENV !== "production") {
      ;(window as unknown as Record<string, unknown>).__branch = {
        mat: mat?.opacity,
        specks: sm?.opacity,
        speckCount: speckMatRef.current ? geos.specks.getAttribute("position")?.count ?? -1 : -2,
      }
    }
  })

  const ropeTop: V3 = [-0.5, 3.05, -0.8]
  const ropeMidY = ropeTop[1] - ROPE_LEN / 2

  return (
    <group>
      {/* main bough segments — the first mesh carries the shared ref */}
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
      {/* secondary twigs */}
      {geos.twigs.map((g, i) => (
        <mesh key={`t${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* tertiary forks */}
      {geos.forks.map((g, i) => (
        <mesh key={`f${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* glowing speck clusters at the twig tips + sparse bough dust */}
      <points geometry={geos.specks}>
        <primitive object={speckMaterial} attach="material" ref={speckMatRef} />
      </points>
      {/* rope from the hang tip + knot at its end */}
      <mesh geometry={geos.rope} position={[ropeTop[0], ropeMidY, ropeTop[2]]}>
        <primitive object={material} attach="material" />
      </mesh>
      <mesh geometry={geos.ropeKnot} position={[ropeTop[0], ropeTop[1] - ROPE_LEN, ropeTop[2]]}>
        <primitive object={material} attach="material" />
      </mesh>
      {/* cap at the hang tip */}
      <mesh geometry={geos.cap} position={MAIN_SEGS[MAIN_SEGS.length - 1].pts[2]}>
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  )
}
