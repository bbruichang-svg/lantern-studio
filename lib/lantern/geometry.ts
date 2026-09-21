import * as THREE from "three"

/** max body radius (diameter 2.0) */
export const MAX_RADIUS = 1.0
/** small top/bottom opening radius — matches the reference photo (~22%) */
export const RING_RADIUS = 0.23
/** slight vertical stretch: the reference lantern is a touch taller than wide */
export const BODY_STRETCH = 1.06
/** height of the small straight ring lip at top & bottom */
export const RING_CAP_HEIGHT = 0.05

export const LATHE_SEGMENTS = 72
export const PROFILE_POINTS = 48

const THETA0 = Math.asin(RING_RADIUS)
/** y where the spherical body meets the ring opening */
export const BODY_TOP_Y = Math.cos(THETA0) * BODY_STRETCH
/** overall height including the ring lips */
export const LANTERN_HEIGHT = 2 * (BODY_TOP_Y + RING_CAP_HEIGHT)

/** deterministic pseudo noise in [-1, 1] */
function pseudoNoise(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}

/**
 * Lantern silhouette — a true sphere, slightly stretched vertically,
 * cut at a small ring opening top & bottom, with short straight lips.
 * Built bottom-to-top so texture v=0 is the bottom.
 */
export function buildLanternProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  // bottom lip (slight inward taper)
  pts.push(new THREE.Vector2(RING_RADIUS * 0.86, -(BODY_TOP_Y + RING_CAP_HEIGHT)))
  pts.push(new THREE.Vector2(RING_RADIUS, -BODY_TOP_Y))
  // spherical body: φ from θ0 (bottom) to π-θ0 (top)
  for (let i = 0; i <= PROFILE_POINTS; i++) {
    const t = i / PROFILE_POINTS
    const phi = THETA0 + t * (Math.PI - 2 * THETA0)
    const r = Math.sin(phi)
    const y = -Math.cos(phi) * BODY_STRETCH
    pts.push(new THREE.Vector2(r, y))
  }
  // top lip
  pts.push(new THREE.Vector2(RING_RADIUS, BODY_TOP_Y))
  pts.push(new THREE.Vector2(RING_RADIUS * 0.86, BODY_TOP_Y + RING_CAP_HEIGHT))
  return pts
}

/**
 * ~80% geometric / ~20% handmade: gentle vertex perturbation,
 * fading to zero at the top & bottom rings so the structure stays clean.
 */
export function applyHandmadeIrregularity(geometry: THREE.BufferGeometry): void {
  const pos = geometry.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const t = (v.y + LANTERN_HEIGHT / 2) / LANTERN_HEIGHT
    // 0 at the rings, 1 through the belly
    const bodyWeight = Math.pow(Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)), 1.4)
    const r = Math.hypot(v.x, v.z)
    if (r < 0.001) continue
    const angle = Math.atan2(v.z, v.x)

    // random handmade wobble, keyed on (y, angle) so the UV seam stays welded
    const n = pseudoNoise(v.y * 4.2, angle * 1.9)
    const radial = 1 + n * 0.011 * bodyWeight
    const nr = r * radial
    pos.setX(i, Math.cos(angle) * nr)
    pos.setZ(i, Math.sin(angle) * nr)
    pos.setY(i, v.y * (1 + n * 0.004 * bodyWeight))
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
}

export function buildLanternGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.LatheGeometry(buildLanternProfile(), LATHE_SEGMENTS)
  applyHandmadeIrregularity(geometry)
  return geometry
}

/**
 * Inverse of the lathe UV mapping (vertical axis).
 *
 * LatheGeometry distributes texture v linearly along the profile POINT
 * indices, and our profile spaces those points uniformly in the polar
 * angle φ — so world height y = -cos(φ)·BODY_STRETCH is strongly
 * NON-linear in v (1px near the equator covers ~4.3× the world height
 * of 1px near the rims). Anything painted straight onto the texture in
 * linear pixel space comes out distorted; use this to remap.
 *
 * Returns the world-space y for a texture v, or null on the ring lips
 * (v outside the spherical body) where no face art should appear.
 */
export function worldYForV(v: number): number | null {
  const lip = 2 / (PROFILE_POINTS + 4)
  if (v < lip || v > 1 - lip) return null
  const t = (v - lip) / (1 - 2 * lip)
  const phi = THETA0 + t * (Math.PI - 2 * THETA0)
  return -Math.cos(phi) * BODY_STRETCH
}
