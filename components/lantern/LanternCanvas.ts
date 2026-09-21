import * as THREE from "three"
import { renderFaceToCanvas } from "@/lib/lantern/faces"
import type { FacePreset } from "@/lib/lantern/types"

export const TEXTURE_SIZE = 1024
/** vertical ribs baked into the paper texture */
export const RIB_COUNT = 14

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
  private faceCanvas: HTMLCanvasElement
  private drawingCanvas: HTMLCanvasElement
  private textCanvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D

  constructor() {
    this.compositeCanvas = makeCanvas(TEXTURE_SIZE)
    this.paperCanvas = makeCanvas(TEXTURE_SIZE)
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

  setFace(face: FacePreset | null): void {
    renderFaceToCanvas(this.faceCanvas, face)
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

    // vertical ribs — soft structural shading, not bamboo strips
    for (let k = 0; k < RIB_COUNT; k++) {
      const cx = ((k + 0.5) / RIB_COUNT) * S
      const g = ctx.createLinearGradient(cx - 30, 0, cx + 30, 0)
      g.addColorStop(0, "rgba(60,50,40,0)")
      g.addColorStop(0.5, "rgba(60,50,40,0.07)")
      g.addColorStop(1, "rgba(60,50,40,0)")
      ctx.fillStyle = g
      ctx.fillRect(cx - 30, 0, 60, S)
      ctx.fillStyle = "rgba(60,50,40,0.05)"
      ctx.fillRect(cx - 1, 0, 2, S)
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

  private composite(): void {
    this.ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE)
    this.ctx.drawImage(this.paperCanvas, 0, 0)
    this.ctx.drawImage(this.drawingCanvas, 0, 0)
    this.ctx.drawImage(this.textCanvas, 0, 0)
    this.ctx.drawImage(this.faceCanvas, 0, 0)
    if (this.texture) this.texture.needsUpdate = true
  }
}
