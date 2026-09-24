"use client"

import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { ROPE_LEN } from "./HangController"
import { makeStarTexture } from "./starTexture"

/**
 * Glowing branch for the hang finale (挂树终幕) — v4, restyled after the
 * ethereal illustration references: the silhouette bough becomes a GLOWING
 * WHITE LINE drawing (inner core + soft additive halo tube), and the old
 * speck clusters are replaced by fine threads hanging four-point stars
 * from the twig tips. The lantern still hangs from the tip on a thin rope.
 *
 * Shape notes (geometry unchanged from v3):
 *  - the main bough tapers HARD (0.032 → 0.006) so the tip reads as a
 *    whip-thin twig, not a pipe; the curve dips then lifts gracefully;
 *  - ~12 secondary twigs (0.009 → 0.002) in varied attitudes, plus
 *    a few tertiary forks;
 *  - a thin rope (ROPE_LEN) drops from the tip; the lantern's top ring
 *    hangs at its end (see HangController — HANG_LANTERN_POS).
 *
 * The hang tip stays at (-0.5, 3.05, -0.8) — HANG_POINT depends on it.
 * Do not move the last main-segment point.
 *
 * Layers: every tube gets a low-poly halo twin (radius ×3, additive) that
 * fades in a beat behind the core — "first the line, then the light".
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

/**
 * Hanging stars — fine threads dropping four-point stars from twig/fork
 * tips. Anchors are hand-picked literals (portrait-frustum safe: x ≥ -1.2
 * stays on-screen at 390×844); order = wake order (tip stars first).
 */
const HANGING_STARS: { anchor: V3; len: number; scale: number; delay: number; swayPhase: number }[] = [
  { anchor: [-0.56, 3.3, -0.81], len: 0.26, scale: 0.1, delay: 0.9, swayPhase: 0.0 },
  { anchor: [-0.62, 3.2, -0.82], len: 0.18, scale: 0.07, delay: 1.1, swayPhase: 1.3 },
  { anchor: [-0.44, 3.3, -0.76], len: 0.22, scale: 0.08, delay: 1.3, swayPhase: 2.1 },
  { anchor: [-0.33, 3.24, -0.74], len: 0.15, scale: 0.06, delay: 1.5, swayPhase: 3.2 },
  { anchor: [-0.28, 3.12, -0.72], len: 0.24, scale: 0.09, delay: 1.7, swayPhase: 4.0 },
  { anchor: [-0.3, 2.96, -0.72], len: 0.14, scale: 0.06, delay: 1.9, swayPhase: 5.1 },
  { anchor: [-0.52, 2.84, -0.79], len: 0.2, scale: 0.08, delay: 2.1, swayPhase: 0.8 },
  { anchor: [-0.98, 3.4, -0.99], len: 0.28, scale: 0.11, delay: 2.3, swayPhase: 2.7 },
  { anchor: [-1.13, 3.28, -1.05], len: 0.2, scale: 0.08, delay: 2.5, swayPhase: 3.9 },
  { anchor: [-1.05, 2.98, -1.06], len: 0.16, scale: 0.06, delay: 2.7, swayPhase: 4.6 },
  { anchor: [-1.36, 3.22, -1.19], len: 0.18, scale: 0.07, delay: 2.9, swayPhase: 5.6 },
]

/** core + low-poly halo twin from one curve (halo = radius ×3, additive) */
function tubePair(pts: V3[], radius: number): { core: THREE.TubeGeometry; halo: THREE.TubeGeometry } {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)))
  return {
    core: new THREE.TubeGeometry(curve, 32, radius, 8, false),
    halo: new THREE.TubeGeometry(curve, 16, radius * 3, 6, false),
  }
}

export default function TreeBranch({ reveal }: TreeBranchProps) {
  // refs onto the shared materials — opacity is written through refs
  // because react-hooks/immutability forbids mutating useMemo'd objects
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const starMatRefs = useRef<(THREE.SpriteMaterial | null)[]>([])
  const starGroupRefs = useRef<(THREE.Group | null)[]>([])
  const clock = useRef(-1)
  const wasReveal = useRef(false)

  // inner core: an emissive-looking flat white (glowing things don't need
  // to be lit); the halo carries the actual glow
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#F5F8FF", transparent: true, opacity: 0 }),
    [],
  )
  const haloMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#FFFFFF",
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const starTexture = useMemo(() => makeStarTexture(), [])

  const geos = useMemo(
    () => ({
      main: MAIN_SEGS.map((s) => tubePair(s.pts, s.r)),
      twigs: TWIGS.map((t) => tubePair(t.pts, t.r)),
      forks: FORKS.map((t) => tubePair(t.pts, t.r)),
      joints: JOINTS.map(([, r]) => new THREE.SphereGeometry(r, 10, 8)),
      // thin rope dropping from the hang tip (lantern ring hangs at its end)
      rope: new THREE.CylinderGeometry(0.0035, 0.0035, ROPE_LEN, 6),
      ropeKnot: new THREE.SphereGeometry(0.009, 8, 6),
      // cap over the open tube end at the hang tip
      cap: new THREE.SphereGeometry(0.008, 10, 8),
      // star threads (one thin cylinder per hanging star)
      starLines: HANGING_STARS.map((s) => new THREE.CylinderGeometry(0.0015, 0.0015, s.len, 5)),
    }),
    [],
  )

  useEffect(() => {
    return () => {
      material.dispose()
      haloMaterial.dispose()
      starTexture.dispose()
      geos.main.forEach((p) => {
        p.core.dispose()
        p.halo.dispose()
      })
      geos.twigs.forEach((p) => {
        p.core.dispose()
        p.halo.dispose()
      })
      geos.forks.forEach((p) => {
        p.core.dispose()
        p.halo.dispose()
      })
      geos.joints.forEach((g) => g.dispose())
      geos.rope.dispose()
      geos.ropeKnot.dispose()
      geos.cap.dispose()
      geos.starLines.forEach((g) => g.dispose())
    }
  }, [material, haloMaterial, starTexture, geos])

  useFrame((_, delta) => {
    const target = reveal ? 1 : 0
    // core leads, halo follows a beat slower — "first the line, then the light"
    const kCore = 1 - Math.exp(-2.5 * Math.min(delta, 0.05))
    const kHalo = 1 - Math.exp(-2.0 * Math.min(delta, 0.05))
    const mat = matRef.current
    if (mat) mat.opacity = mat.opacity + (target - mat.opacity) * kCore
    const hm = haloMatRef.current
    if (hm) hm.opacity = hm.opacity + (target * 0.15 - hm.opacity) * kHalo

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
        halo: hm?.opacity,
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
      {geos.main.map((p, i) => (
        <mesh key={`m${i}`} geometry={p.core}>
          <primitive object={material} attach="material" ref={i === 0 ? matRef : undefined} />
        </mesh>
      ))}
      {/* secondary twigs */}
      {geos.twigs.map((p, i) => (
        <mesh key={`t${i}`} geometry={p.core}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* tertiary forks */}
      {geos.forks.map((p, i) => (
        <mesh key={`f${i}`} geometry={p.core}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* taper joints */}
      {geos.joints.map((g, i) => (
        <mesh key={`j${i}`} geometry={g}>
          <primitive object={material} attach="material" />
        </mesh>
      ))}
      {/* soft additive halo twins — drawn after the core, never write depth */}
      {geos.main.map((p, i) => (
        <mesh key={`mh${i}`} geometry={p.halo} renderOrder={2}>
          <primitive object={haloMaterial} attach="material" ref={i === 0 ? haloMatRef : undefined} />
        </mesh>
      ))}
      {geos.twigs.map((p, i) => (
        <mesh key={`th${i}`} geometry={p.halo} renderOrder={2}>
          <primitive object={haloMaterial} attach="material" />
        </mesh>
      ))}
      {geos.forks.map((p, i) => (
        <mesh key={`fh${i}`} geometry={p.halo} renderOrder={2}>
          <primitive object={haloMaterial} attach="material" />
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
