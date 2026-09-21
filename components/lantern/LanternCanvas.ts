import * as THREE from "three"
import { getCachedFace } from "@/lib/lantern/faces"
import { worldYForV } from "@/lib/lantern/geometry"

export const TEXTURE_SIZE = 1024
/** horizontal bamboo-style ribs baked into the paper texture (like the reference photo) */
export const RIB_COUNT = 20

/**
 * The DTZ artwork is an ORTHOGRAPHIC front view of a sphere: a disc of
 * radius R whose planar point (px, py) sits on the sphere at azimuth
 * asin(px / R). Wrapping the disc LINEARLY around the lantern (px →
 * arc length) squashes the face horizontally and smears the side
 * elements — so instead we paint the face onto a flat disc, then remap
 * every lantern-texel back through the inverse projection.
 */
const FACE_PATCH_WORLD_R = 0.85

function makeCanvas(size: number): HTMLCanvasElement {
  const c = document.createElement("canvas")
  c.width = size
  c.height = size
  return c
}

/**
 * Layered lantern texture.
 *
 * LanternCanvas (composite, drives the THREE.CanvasTexture)
 * ├── Paper Layer   — neutral paper + horizontal grain + vertical ribs
 * ├── Face Layer    — hand-drawn ink face
 * ├── Drawing Layer — empty in V1, ready for V2 free drawing
 * └── Text Layer    — empty in V1
 *
 * The paper layer is deliberately neutral/light: the lantern colour
 * lives on the material tint (smoothly lerped at runtime), so colour
 * changes never require a texture re-upload.
 */
export class LanternCanvas {
  readonly texture: THREE.CanvasTexture

  private compositeCanvas: HTMLCanvasElement
  private paperCanvas: HTMLCanvasElement
  private facePlanarCanvas: HTMLCanvasElement
  private faceCanvas: HTMLCanvasElement
  private drawingCanvas: HTMLCanvasElement
  private textCanvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.compositeCanvas = makeCanvas(TEXTURE_SIZE)
    this.paperCanvas = makeCanvas(TEXTURE_SIZE)
    this.facePlanarCanvas = makeCanvas(TEXTURE_SIZE)
    this.faceCanvas = makeCanvas(TEXTURE_SIZE)
    this.drawingCanvas = makeCanvas(TEXTURE_SIZE)
    this.textCanvas = makeCanvas(TEXTURE_SIZE)

    const ctx = this.compositeCanvas.getContext("2d")
    if (!ctx) throw new Error("LanternCanvas: 2d context unavailable")
    this.ctx = ctx

    this.drawPaperLayer()
    this.composite()

    this.texture = new THREE.CanvasTexture(this.compositeCanvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4
  }

  /**
   * Paint the preprocessed DTZ disc (strokes on transparent, disc
   * inscribed in the canvas) onto the planar face layer, then remap it
   * onto the lantern UV through the inverse orthographic projection.
   * No-op until the image is cached — callers await ensureFace(src).
   */
  setFaceImage(src: string | null): void {
    const sctx = this.facePlanarCanvas.getContext("2d")
    if (!sctx) return
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    if (src) {
      const img = getCachedFace(src)
      if (img) sctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    }
    this.remapFaceLayer()
    this.composite()
  }

  /** V2 hook: draw free strokes onto the drawing layer. */
  getDrawingContext(): CanvasRenderingContext2D | null {
    return this.drawingCanvas.getContext("2d")
  }

  /** V2 hook: draw text onto the text layer. */
  getTextContext(): CanvasRenderingContext2D | null {
    return this.textCanvas.getContext("2d")
  }

  /**
   * Neutral paper: light warm grey base so the material tint shows the
   * true lantern colour, plus horizontal grain and faint vertical ribs.
   */
  private drawPaperLayer(): void {
    const ctx = this.paperCanvas.getContext("2d")
    if (!ctx) return
    const S = TEXTURE_SIZE

    ctx.fillStyle = "#EAE5DA"
    ctx.fillRect(0, 0, S, S)

    // horizontal paper grain — faint bands of light & shadow, never black lines
    for (let i = 0; i < 240; i++) {
      const y = (i / 240) * S + Math.sin(i * 91.7) * 6
      const light = Math.sin(i * 33.7) > 0
      ctx.fillStyle = light ? "rgba(255,255,255,0.05)" : "rgba(60,50,40,0.045)"
      ctx.fillRect(0, y, S, 1 + (Math.sin(i * 57.3) * 0.5 + 0.5) * 2.2)
    }
    // fibre specks
    for (let i = 0; i < 500; i++) {
      const x = Math.abs(Math.sin(i * 12.9898) * 43758.5453) % S
      const y = Math.abs(Math.sin(i * 78.233) * 12345.6789) % S
      ctx.fillStyle = Math.sin(i * 3.3) > 0 ? "rgba(255,255,255,0.05)" : "rgba(60,50,40,0.05)"
      ctx.fillRect(x, y, 2, 1)
    }

    // horizontal ribs — latitude bands wrapping around the body, soft not black
    for (let k = 0; k < RIB_COUNT; k++) {
      const cy = ((k + 0.5) / RIB_COUNT) * S
      const g = ctx.createLinearGradient(0, cy - 16, 0, cy + 16)
      g.addColorStop(0, "rgba(60,50,40,0)")
      g.addColorStop(0.5, "rgba(60,50,40,0.07)")
      g.addColorStop(1, "rgba(60,50,40,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, cy - 16, S, 32)
      ctx.fillStyle = "rgba(60,50,40,0.05)"
      ctx.fillRect(0, cy - 1, S, 2)
    }

    // slightly darker toward top & bottom rims
    const shade = ctx.createLinearGradient(0, 0, 0, S)
    shade.addColorStop(0, "rgba(40,32,26,0.16)")
    shade.addColorStop(0.2, "rgba(40,32,26,0)")
    shade.addColorStop(0.8, "rgba(40,32,26,0)")
    shade.addColorStop(1, "rgba(40,32,26,0.2)")
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, S, S)
  }

  /**
   * Disc -> lantern UV remap.
   *
   * For every face-layer texel (x, y):
   *   u = (x+0.5)/S            → azimuth θ = (u−½)·2π  (face centred at u=0.5)
   *   v = 1−(y+0.5)/S          → world height via worldYForV (non-linear lathe UV)
   *   planar px = sin(θ)/F     (inverse orthographic: disc x = sin θ · R)
   *   planar py = −worldY/F    (orthographic preserves the vertical axis;
   *                             minus flips world-up to image-down)
   * then samples the flat DTZ disc at (px, py). Texels outside the disc
   * or on the ring lips stay transparent.
   */
  private remapFaceLayer(): void {
    const S = TEXTURE_SIZE
    const fctx = this.faceCanvas.getContext("2d")
    const sctx = this.facePlanarCanvas.getContext("2d")
    if (!fctx || !sctx) return

    fctx.setTransform(1, 0, 0, 1, 0, 0)
    fctx.clearRect(0, 0, S, S)
    const src = sctx.getImageData(0, 0, S, S)
    const out = fctx.getImageData(0, 0, S, S)
    const sd = src.data
    const dst = out.data

    // per-column planar x; per-row world height
    const pxCol = new Float32Array(S)
    for (let x = 0; x < S; x++) {
      const theta = ((x + 0.5) / S - 0.5) * Math.PI * 2
      pxCol[x] = Math.sin(theta) / FACE_PATCH_WORLD_R
    }
    const pyRow = new Float32Array(S)
    for (let y = 0; y < S; y++) {
      const wy = worldYForV(1 - (y + 0.5) / S)
      pyRow[y] = wy === null ? 2 : -wy / FACE_PATCH_WORLD_R
    }

    for (let y = 0; y < S; y++) {
      const py = pyRow[y]
      if (py < -1 || py > 1) continue
      const syi = Math.min(S - 1, Math.max(0, Math.floor((0.5 + py * 0.5) * S)))
      const srcRow = syi * S * 4
      const rowBase = y * S * 4
      for (let x = 0; x < S; x++) {
        const px = pxCol[x]
        if (px < -1 || px > 1) continue
        const sxi = Math.min(S - 1, Math.max(0, Math.floor((0.5 + px * 0.5) * S)))
        const si = srcRow + sxi * 4
        const di = rowBase + x * 4
        dst[di] = sd[si]
        dst[di + 1] = sd[si + 1]
        dst[di + 2] = sd[si + 2]
        dst[di + 3] = sd[si + 3]
      }
    }
    fctx.putImageData(out, 0, 0)
  }

  private composite(): void {
    this.ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    this.ctx.drawImage(this.paperCanvas, 0, 0)
    this.ctx.drawImage(this.drawingCanvas, 0, 0)
    this.ctx.drawImage(this.textCanvas, 0, 0)
    this.ctx.drawImage(this.faceCanvas, 0, 0)
    if (this.texture) this.texture.needsUpdate = true
  }
}
