import * as THREE from "three"

/**
 * Four-point sparkle texture — shared by AwakenedStars (sky stars) and
 * TreeBranch (hanging star ornaments). White core; tint via spriteMaterial
 * color when a warmer tone is wanted.
 */
export function makeStarTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 64
  c.height = 64
  const ctx = c.getContext("2d")
  if (ctx) {
    // four-point sparkle: concave diamond cross
    const star = () => {
      ctx.beginPath()
      ctx.moveTo(32, 3)
      ctx.quadraticCurveTo(36, 28, 61, 32)
      ctx.quadraticCurveTo(36, 36, 32, 61)
      ctx.quadraticCurveTo(28, 36, 3, 32)
      ctx.quadraticCurveTo(28, 28, 32, 3)
      ctx.fill()
    }
    ctx.shadowColor = "rgba(255,255,255,0.9)"
    ctx.shadowBlur = 6
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    star()
    ctx.shadowBlur = 0
    ctx.fillStyle = "rgba(255,255,255,0.55)"
    star()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
