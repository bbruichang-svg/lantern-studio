import * as THREE from "three"

/** Height : Diameter = 1.15 : 1 */
export const LANTERN_HEIGHT = 2.3
/** max body radius (diameter 2.0) */
export const MAX_RADIUS = 1.0
/** top & bottom ring radius — 0.64–0.70 */
export const RING_RADIUS = 0.66

export const LATHE_SEGMENTS = 72
export const PROFILE_POINTS = 40

/** deterministic pseudo noise in [-1, 1] */
function pseudoNoise(a: number, b: number): number {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return (v - Math.floor(v)) * 2 - 1
}

/**
 * Lantern silhouette: bottom ring -> bulged body -> top ring.
 * Built bottom-to-top so texture v=0 is the bottom.
 */
export function buildLanternProfile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= PROFILE_POINTS; i++) {
    const t = i / PROFILE_POINTS
    const y = -LANTERN_HEIGHT / 2 + t * LANTERN_HEIGHT
    const bulge = Math.pow(Math.sin(Math.PI * t), 0.9)
    const r = RING_RADIUS + (MAX_RADIUS - RING_RADIUS) * bulge
    pts.push(new THREE.Vector2(Math.max(r, 0.02), y))
  }
  return pts
}

/**
 * ~80% geometric / ~20% handmade: gentle vertex perturbation,
 * fading to zero at the top & bottom rings so the structure stays clean.
 * 0.5%–2% amplitude — reads as "handmade", not "broken".
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
    // very gentle rib ripples — 14 of them, matching the texture ribs
    const rib = Math.sin(angle * 14) * 0.0045

    const radial = 1 + (n * 0.011 + rib) * bodyWeight
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
