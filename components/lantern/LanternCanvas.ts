import * as THREE from "three"
import { getCachedFace } from "@/lib/lantern/faces"
import { worldYForV } from "@/lib/lantern/geometry"

export const TEXTURE_SIZE = 1024
/** horizontal bamboo-style ribs baked into the paper texture (like the reference photo) */
export const RIB_COUNT = 20

/** deterministic RNG so the paper looks identical on every reload */
function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

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
  /** grayscale roughness map (linear colour space) for the paper material */
  readonly roughnessTexture: THREE.CanvasTexture
  /** very-low-strength fibre bump map */
  readonly bumpTexture: THREE.CanvasTexture

  private compositeCanvas: HTMLCanvasElement
  private paperCanvas: HTMLCanvasElement
  private roughnessCanvas: HTMLCanvasElement
  private bumpCanvas: HTMLCanvasElement
  private facePlanarCanvas: HTMLCanvasElement
  private faceCanvas: HTMLCanvasElement
  private drawingCanvas: HTMLCanvasElement
  private textCanvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.compositeCanvas = makeCanvas(TEXTURE_SIZE)
    this.paperCanvas = makeCanvas(TEXTURE_SIZE)
    this.roughnessCanvas = makeCanvas(TEXTURE_SIZE)
    this.bumpCanvas = makeCanvas(TEXTURE_SIZE)
    this.facePlanarCanvas = makeCanvas(TEXTURE_SIZE)
    this.faceCanvas = makeCanvas(TEXTURE_SIZE)
    this.drawingCanvas = makeCanvas(TEXTURE_SIZE)
    this.textCanvas = makeCanvas(TEXTURE_SIZE)

    const ctx = this.compositeCanvas.getContext("2d")
    if (!ctx) throw new Error("LanternCanvas: 2d context unavailable")
    this.ctx = ctx

    this.drawPaperLayer()
    this.drawRoughnessLayer()
    this.drawBumpLayer()
    this.composite()

    this.texture = new THREE.CanvasTexture(this.compositeCanvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.anisotropy = 4

    // roughness/bump maps stay linear — no sRGB conversion
    this.roughnessTexture = new THREE.CanvasTexture(this.roughnessCanvas)
    this.roughnessTexture.anisotropy = 4
    this.bumpTexture = new THREE.CanvasTexture(this.bumpCanvas)
    this.bumpTexture.anisotropy = 4
  }

  /**
   * Paint the preprocessed DTZ disc (strokes on transparent, disc
   * inscribed in the canvas) onto the planar face layer, then remap it
   * onto the lantern UV through the inverse orthographic projection.
   * No-op until the image is cached — callers await ensureFace(src).
   *
   * `inkColor` (a city's `line` colour) remaps every stroke to that
   * colour while preserving alpha — including the anti-aliased edges —
   * via a source-in fill. Faces and colours are chosen independently,
   * so without this a dark-ink face would vanish on the ink-black
   * cities (墨黑/墨夜); remapped, any face reads on any base exactly
   * like the DTZ inverted designs do.
   */
  setFaceImage(src: string | null, inkColor?: string): void {
    const sctx = this.facePlanarCanvas.getContext("2d", { willReadFrequently: true })
    if (!sctx) return
    sctx.setTransform(1, 0, 0, 1, 0, 0)
    sctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    if (src) {
      const img = getCachedFace(src)
      if (img) {
        sctx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
        if (inkColor) {
          sctx.globalCompositeOperation = "source-in"
          sctx.fillStyle = inkColor
          sctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
          sctx.globalCompositeOperation = "source-over"
        }
      }
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
   * Neutral handmade paper:
   *  - flat light base (the city colour lives on the material tint)
   *  - large, very-low-contrast mottling (low-frequency colour unevenness)
   *  - short, thin, slightly curved fibres — never full-width lines
   *  - faint wavy bamboo ribs (structure, kept far below visibility threshold)
   */
  private drawPaperLayer(): void {
    const ctx = this.paperCanvas.getContext("2d")
    if (!ctx) return
    const S = TEXTURE_SIZE
    const rng = makeRng(20260921)

    ctx.fillStyle = "#EAE5DA"
    ctx.fillRect(0, 0, S, S)

    // low-frequency mottling — big soft blotches, barely-there contrast,
    // alternating warm/cool so the paper never reads as flat plastic
    for (let i = 0; i < 26; i++) {
      const x = rng() * S
      const y = rng() * S
      const r = 130 + rng() * 200
      const warm = rng() > 0.45
      const a = 0.02 + rng() * 0.026
      const g = ctx.createRadialGradient(x, y, r * 0.12, x, y, r)
      g.addColorStop(0, warm ? `rgba(198,178,150,${a})` : `rgba(230,234,236,${a})`)
      g.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // paper fibres — short strokes with a gentle bend, mostly (not fully)
    // horizontal so there's a grain direction without visible stripes
    for (let i = 0; i < 850; i++) {
      const x = rng() * S
      const y = rng() * S
      const len = 5 + rng() * 20
      const horiz = rng() < 0.7
      const ang = horiz ? (rng() - 0.5) * 0.9 : rng() * Math.PI
      const dx = Math.cos(ang) * len
      const dy = Math.sin(ang) * len
      const light = rng() > 0.5
      const a = 0.02 + rng() * 0.03
      ctx.strokeStyle = light ? `rgba(255,252,244,${a})` : `rgba(122,104,84,${a})`
      ctx.lineWidth = 0.5 + rng() * 0.9
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + dx * 0.5 + (rng() - 0.5) * 4, y + dy * 0.5 + (rng() - 0.5) * 4, x + dx, y + dy)
      ctx.stroke()
    }

    // bamboo ribs — structural latitude bands, much fainter than before and
    // gently wavy so they never read as straight machine lines
    for (let k = 0; k < RIB_COUNT; k++) {
      const cy = ((k + 0.5) / RIB_COUNT) * S
      const g = ctx.createLinearGradient(0, cy - 14, 0, cy + 14)
      g.addColorStop(0, "rgba(60,50,40,0)")
      g.addColorStop(0.5, "rgba(60,50,40,0.05)")
      g.addColorStop(1, "rgba(60,50,40,0)")
      ctx.fillStyle = g
      ctx.fillRect(0, cy - 14, S, 28)
      ctx.strokeStyle = "rgba(60,50,40,0.04)"
      ctx.lineWidth = 1.3
      ctx.beginPath()
      for (let x = 0; x <= S; x += 16) {
        const yy = cy + Math.sin(x * 0.011 + k * 3.1) * 2.6
        if (x === 0) ctx.moveTo(x, yy)
        else ctx.lineTo(x, yy)
      }
      ctx.stroke()
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
   * Roughness map — mid-value ~0.87 with ±0.05 low-frequency drift and a
   * faint fibre-scale jitter, so specular response is uneven like real paper.
   * (roughnessMap reads the green channel; keep it grayscale.)
   */
  private drawRoughnessLayer(): void {
    const ctx = this.roughnessCanvas.getContext("2d")
    if (!ctx) return
    const S = TEXTURE_SIZE
    const rng = makeRng(90210)

    ctx.fillStyle = "rgb(222,222,222)" // ≈0.87
    ctx.fillRect(0, 0, S, S)

    for (let i = 0; i < 22; i++) {
      const x = rng() * S
      const y = rng() * S
      const r = 140 + rng() * 220
      const brighter = rng() > 0.5
      const a = 0.025 + rng() * 0.03
      const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r)
      g.addColorStop(0, brighter ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`)
      g.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // fibre-scale roughness jitter
    for (let i = 0; i < 320; i++) {
      const x = rng() * S
      const y = rng() * S
      const len = 4 + rng() * 16
      const ang = (rng() - 0.5) * 1.1
      const brighter = rng() > 0.5
      ctx.strokeStyle = brighter ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"
      ctx.lineWidth = 0.6 + rng() * 0.9
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
      ctx.stroke()
    }
  }

  /**
   * Bump map — fibres and specks on a flat mid-grey field. Kept on its own
   * canvas so the bump never touches the face artwork. Applied with a very
   * small bumpScale on the material.
   */
  private drawBumpLayer(): void {
    const ctx = this.bumpCanvas.getContext("2d")
    if (!ctx) return
    const S = TEXTURE_SIZE
    const rng = makeRng(40401)

    ctx.fillStyle = "#808080"
    ctx.fillRect(0, 0, S, S)

    for (let i = 0; i < 550; i++) {
      const x = rng() * S
      const y = rng() * S
      const len = 4 + rng() * 18
      const horiz = rng() < 0.7
      const ang = horiz ? (rng() - 0.5) * 0.8 : rng() * Math.PI
      const up = rng() > 0.5
      const a = 0.05 + rng() * 0.06
      ctx.strokeStyle = up ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
      ctx.lineWidth = 0.5 + rng() * 0.8
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5, y + Math.sin(ang) * len * 0.5, x + Math.cos(ang) * len, y + Math.sin(ang) * len)
      ctx.stroke()
    }
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
    const fctx = this.faceCanvas.getContext("2d", { willReadFrequently: true })
    const sctx = this.facePlanarCanvas.getContext("2d", { willReadFrequently: true })
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
