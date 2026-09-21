import { ALL_FACES } from "./colors"

/**
 * Faces are the REAL DTZ artworks: each source PNG is preprocessed
 * offline (_dtz_faces.py) into a 1024x1024 stroke-only disc — alpha
 * carries the ink, RGB is the design's own stroke colour (near-black
 * for standard cities, white for the inverted ones). The planar disc
 * is remapped onto the lantern by LanternCanvas (inverse orthographic
 * projection), exactly like the hand-drawn faces were before.
 */

const cache = new Map<string, HTMLImageElement>()
const loading = new Map<string, Promise<HTMLImageElement | null>>()

/** Load (and memoize) one face image. Resolves null on failure. */
export function ensureFace(src: string): Promise<HTMLImageElement | null> {
  const hit = cache.get(src)
  if (hit) return Promise.resolve(hit)
  let pending = loading.get(src)
  if (!pending) {
    pending = new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        cache.set(src, img)
        loading.delete(src)
        resolve(img)
      }
      img.onerror = () => {
        loading.delete(src)
        resolve(null)
      }
      img.src = src
    })
    loading.set(src, pending)
  }
  return pending
}

/** Synchronous cache lookup — null until ensureFace(src) resolved. */
export function getCachedFace(src: string): HTMLImageElement | null {
  return cache.get(src) ?? null
}

/** Warm the cache with every design so picker → lantern switches are instant. */
export function preloadAllFaces(): void {
  for (const face of ALL_FACES) void ensureFace(face.src)
}
