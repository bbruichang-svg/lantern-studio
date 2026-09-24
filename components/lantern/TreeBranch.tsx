"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { ROPE_LEN } from "./HangController"
import { makeStarTexture } from "./starTexture"

/**
 * Glowing branch for the hang finale (挂树终幕) — v4.1, hairline restyle.
 * User feedback on v4: the bough read as a white glow-stick — too wide
 * (radius + fat additive halo ≈ 荧光棒) with knuckle bulges at the joints
 * and straight-stick twigs. This pass:
 *  - radii cut ~55% across the board → the bough reads as a fine luminous
 *    line drawing (白描) against the night, no halo twin needed;
 *  - joint spheres matched to the adjacent tube radii (no bulges);
 *  - twigs rebuilt as longer two-bend curves that droop or lift naturally
 *    (no straight dashes), ~9 secondary + 4 hair-fine forks;
 *  - hanging four-point stars re-anchored to the new twig tips.
 *
 * The hang tip stays at (-0.5, 3.05, -0.8) — HANG_POINT depends on it.
 * Do not move the last main-segment point.
 *
 * Materials fade through refs (react-hooks/immutability safe).
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
    r: 0.014,
  },
  {
    pts: [
      [-1.95, 2.62, -1.42],
      [-1.62, 2.8, -1.28],
      [-1.3, 2.94, -1.12],
    ],
    r: 0.011,
  },
  {
    // gentle dip — the bough settles under its own weight
    pts: [
      [-1.3, 2.94, -1.12],
      [-1.05, 3.05, -1.0],
      [-0.82, 3.09, -0.9],
    ],
    r: 0.0075,
  },
  {
    // final whip-thin reach to the hang tip
    pts: [
      [-0.82, 3.09, -0.9],
      [-0.66, 3.1, -0.85],
      [-0.5, 3.05, -0.8],
    ],
    r: 0.004,
  },
]

// secondary twigs — v4.1: longer two-bend curves (droop or lift), never
// straight dashes. Order: trunk → tip. Radii 0.0032 → 0.0015.
const TWIGS: Seg[] = [
  {
    // low lifting fork near the trunk — rises with a soft backward bow
    pts: [
      [-1.95, 2.62, -1.42],
      [-1.88, 2.76, -1.39],
      [-1.87, 2.92, -1.38],
    ],
    r: 0.0032,
  },
  {
    // long drooper — hangs below the bough in a gravity arc
    pts: [
      [-1.82, 2.66, -1.38],
      [-1.77, 2.52, -1.36],
      [-1.64, 2.4, -1.32],
    ],
    r: 0.0028,
  },
  {
    // level reach, sagging slightly mid-way
    pts: [
      [-1.6, 2.72, -1.3],
      [-1.42, 2.76, -1.22],
      [-1.24, 2.86, -1.14],
    ],
    r: 0.003,
  },
  {
    // rising fork off the second joint — reaches high with a lean
    pts: [
      [-1.3, 2.94, -1.12],
      [-1.22, 3.08, -1.09],
      [-1.12, 3.26, -1.05],
    ],
    r: 0.0028,
  },
  {
    // back twig — angles away from the camera with a gentle curl
    pts: [
      [-1.15, 2.98, -1.08],
      [-1.28, 3.05, -1.13],
      [-1.38, 3.1, -1.18],
    ],
    r: 0.0022,
  },
  {
    // drooping curl below the mid section
    pts: [
      [-1.0, 3.03, -0.98],
      [-1.05, 2.9, -1.0],
      [-1.14, 2.74, -1.03],
    ],
    r: 0.0022,
  },
  {
    // forward level twig near the dip, almost flat with a slow rise
    pts: [
      [-0.9, 3.08, -0.92],
      [-0.78, 3.12, -0.88],
      [-0.62, 3.14, -0.83],
    ],
    r: 0.002,
  },
  {
    // upward flick just before the tip
    pts: [
      [-0.72, 3.1, -0.86],
      [-0.64, 3.18, -0.84],
      [-0.56, 3.28, -0.81],
    ],
    r: 0.0018,
  },
  {
    // fine twig past the hang point, droops forward
    pts: [
      [-0.55, 3.05, -0.81],
      [-0.44, 3.0, -0.77],
      [-0.3, 2.94, -0.72],
    ],
    r: 0.0015,
  },
]

// tertiary forks — off the tips of some twigs, one bowed bend each, hair-fine
const FORKS: Seg[] = [
  {
    pts: [
      [-1.87, 2.92, -1.38],
      [-1.8, 2.99, -1.35],
      [-1.72, 3.04, -1.32],
    ],
    r: 0.0012,
  },
  {
    pts: [
      [-1.24, 2.86, -1.14],
      [-1.14, 2.9, -1.1],
      [-1.05, 2.93, -1.07],
    ],
    r: 0.001,
  },
  {
    pts: [
      [-1.12, 3.26, -1.05],
      [-1.04, 3.33, -1.02],
      [-0.96, 3.38, -0.99],
    ],
    r: 0.001,
  },
  {
    pts: [
      [-0.56, 3.28, -0.81],
      [-0.49, 3.32, -0.79],
      [-0.42, 3.35, -0.77],
    ],
    r: 0.0008,
  },
]

// sphere joints where the tapering main segments meet — radii matched to
// the adjacent tube ends so the seam reads as continuous taper, no bulge
const JOINTS: [V3, number][] = [
  [[-1.95, 2.62, -1.42], 0.012],
  [[-1.3, 2.94, -1.12], 0.008],
  [[-0.82, 3.09, -0.9], 0.0045],
]

/**
 * Hanging stars — fine threads dropping four-point stars from twig/fork
 * tips. Anchors are hand-picked literals matched to the v4.1 twig ends
 * (portrait-frustum safe, ≤ ~1.4 left of centre at 390×844); order =
 * wake order (tip stars first).
 */
const HANGING_STARS: { anchor: V3; len: number; scale: number; delay: number; swayPhase: number }[] = [
  { anchor: [-0.56, 3.28, -0.81], len: 0.26, scale: 0.1, delay: 0.9, swayPhase: 0.0 },
  { anchor: [-0.62, 3.14, -0.83], len: 0.18, scale: 0.07, delay: 1.1, swayPhase: 1.3 },
  { anchor: [-0.42, 3.35, -0.77], len: 0.22, scale: 0.08, delay: 1.3, swayPhase: 2.1 },
  { anchor: [-0.3, 2.94, -0.72], len: 0.15, scale: 0.06, delay: 1.5, swayPhase: 3.2 },
  { anchor: [-0.96, 3.38, -0.99], len: 0.24, scale: 0.09, delay: 1.7, swayPhase: 4.0 },
  { anchor: [-1.05, 2.93, -1.07], len: 0.14, scale: 0.06, delay: 1.9, swayPhase: 5.1 },
  { anchor: [-1.14, 2.74, -1.03], len: 0.2, scale: 0.08, delay: 2.1, swayPhase: 0.8 },
  { anchor: [-1.38, 3.1, -1.18], len: 0.24, scale: 0.1, delay: 2.3, swayPhase: 2.7 },
  { anchor: [-1.12, 3.26, -1.05], len: 0.2, scale: 0.08, delay: 2.5, swayPhase: 3.9 },
  { anchor: [-1.64, 2.4, -1.32], len: 0.14, scale: 0.06, delay: 2.7, swayPhase: 4.6 },
  { anchor: [-1.3, 2.94, -1.12], len: 0.2, scale: 0.07, delay: 2.9, swayPhase: 5.6 },
]

/** one CatmullRom tube per segment — hairline cores need no halo twin */
function tube(pts: V3[], radius: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  return new THREE.TubeGeometry(curve, 32, radius, 8, false)
}

export default function TreeBranch({ reveal }: TreeBranchProps) {
  // ref onto the shared material — opacity is written through the ref
  // because react-hooks/immutability forbids mutating useMemo'd objects
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const starMatRefs = useRef<(THREE.SpriteMaterial | null)[]>([])
  const starGroupRefs = useRef<(THREE.Group | null)[]>([])
  const clock = useRef(-1)
  const wasReveal = useRef(false)

  // inner core: an emissive-looking flat white — against the dark night a
  // hairline reads as luminous on its own (v4's halo twin is gone)
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#F5F8FF", transparent: true, opacity: 0 }),
    [],
  )
  const starTexture = useMemo(() => makeStarTexture(), [])

  const geos = useMemo(
    () => ({
      main: MAIN_SEGS.map((s) => tube(s.pts, s.r)),
      twigs: TWIGS.map((t) => tube(t.pts, t.r)),
      forks: FORKS.map((t) => tube(t.pts, t.r)),
      joints: JOINTS.map(([, r]) => new THREE.SphereGeometry(r, 10, 8)),
      // thin rope dropping from the hang tip (lantern ring hangs at its end)
      rope: new THREE.CylinderGeometry(0.0022, 0.0022, ROPE_LEN, 6),
      ropeKnot: new THREE.SphereGeometry(0.006, 8, 6),
      // cap over the open tube end at the hang tip
      cap: new THREE.SphereGeometry(0.0045, 10, 8),
      // star threads (one thin cylinder per hanging star)
      starLines: HANGING_STARS.map((s) => new THREE.CylinderGeometry(0.0012, 0.0012, s.len, 5)),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      starTexture.dispose()
      geos.main.forEach((g) => g.dispose())
      geos.twigs.forEach((g) => g.dispose())
      geos.forks.forEach((g) => g.dispose())
      geos.joints.forEach((g) => g.dispose())
      geos.rope.dispose()
      geos.ropeKnot.dispose()
      geos.cap.dispose()
      geos.starLines.forEach((g) => g.dispose())
    }
  }, [material, starTexture, geos])

  useFrame((_, delta) => {
    const target = reveal ? 1 : 0
    const kCore = 1 - Math.exp(-2.5 * Math.min(delta, 0.05))
    const mat = matRef.current
    if (mat) mat.opacity = mat.opacity + (target - mat.opacity) * kCore

    // hanging stars wake one by one after the branch starts revealing
    if (!reveal) {
      wasReveal.current = false
      clock.current = -1
    } else {
      if (!wasReveal.current) {
        wasReveal.current = true
        clock.current = 0
      }
      clock.current += Math.min(delta, 0.05)
      for (let i = 0; i < HANGING_STARS.length; i++) {
        const st = HANGING_STARS[i]
        const m = starMatRefs.current[i]
        const grp = starGroupRefs.current[i]
        if (!m || !grp) continue
        const wake = Math.min(1, Math.max(0, (clock.current - st.delay) / 0.6))
        const twinkle = 0.75 + 0.25 * Math.sin(clock.current * 0.5 + st.swayPhase)
        m.opacity = wake * twinkle
        // gentle pendulum sway around the anchor (rotation moves the
        // star at the thread's end; the sprite itself stays camera-faced)
        grp.rotation.z = Math.sin(clock.current * 0.6 + st.swayPhase) * 0.04
      }
    }

    if (process.env.NODE_ENV !== "production") {
      ;(window as unknown as Record<string, unknown>).__branch = {
        mat: mat?.opacity,
        star0: starMatRefs.current[0]?.opacity,
        starCount: HANGING_STARS.length,
      }
    }
  })

  const ropeTop: V3 = [-0.5, 3.05, -0.8]
  const ropeMidY = ropeTop[1] - ROPE_LEN / 2

  return (
    <group>
      {/* main bough segments — the first mesh carries the shared core ref */}
      {geos.main.map((g, i) => (
        <mesh key={`m${i}`} geometry={g}>
          <primitive object={material} attach="material" ref={i === 0 ? matRef : undefined} />
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
      {/* taper joints */}
      {geos.joints.map((g, i) => (
        <mesh key={`j${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
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
      {/* hanging four-point stars — thread + star sway around the anchor */}
      {HANGING_STARS.map((st, i) => (
        <group
          key={`hs${i}`}
          position={st.anchor}
          ref={(g) => {
            starGroupRefs.current[i] = g
          }}
        >
          <mesh geometry={geos.starLines[i]} position={[0, -st.len / 2, 0]}>
            <primitive object={material} attach="material" />
          </mesh>
          <sprite position={[0, -st.len, 0]} scale={[st.scale, st.scale, 1]} renderOrder={4}>
            <spriteMaterial
              ref={(m) => {
                starMatRefs.current[i] = m
              }}
              map={starTexture}
              color="#FFF8E8"
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </sprite>
        </group>
      ))}
    </group>
  )
}
