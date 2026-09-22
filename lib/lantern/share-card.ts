/**
 * Share card composer — 1080 × 1350 (4:5), pure Canvas 2D, no dependencies.
 *
 * Visual contract (spec §6-§12): night + one lantern + minimal words.
 * Lantern > light > text > sky. No festival poster decoration.
 * The lantern itself is the LIVE capture of the user's own lit lantern
 * (colour + DTZ pattern + inner light), never a redrawn variant.
 */

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1350

export type ShareCardOptions = {
  /** PNG data URL captured from the live WebGL canvas (frozen frame) */
  lanternCapture: string
  songTitle: string
  artist: string
  /** one moon-lit lyric line, printed between the headline and the song credit */
  moonLyric?: string
  /** shown as 「我的灯笼 · <year>」 (default 2026) */
  year?: number
  /**
   * Reserved for the QR module (spec §11): no stable production URL yet,
   * so nothing is drawn. When provided later, render a 120px QR above
   * the footer line with 「点一盏灯」 beside it.
   */
  qrUrl?: string
}

const NIGHT_TOP = "#101B30"
const NIGHT_BOTTOM = "#060B16"
const INK = "#E8E4DA"
const WARM = "255,216,170"

/** deterministic star positions (no hydration/canvas randomness) */
const STARS: readonly { x: number; y: number; r: number; o: number }[] = [
  { x: 0.07, y: 0.05, r: 1.6, o: 0.4 },
  { x: 0.16, y: 0.11, r: 1.1, o: 0.3 },
  { x: 0.27, y: 0.045, r: 1.3, o: 0.35 },
  { x: 0.38, y: 0.09, r: 1.0, o: 0.28 },
  { x: 0.52, y: 0.04, r: 1.5, o: 0.4 },
  { x: 0.63, y: 0.1, r: 1.1, o: 0.3 },
  { x: 0.74, y: 0.055, r: 1.4, o: 0.36 },
  { x: 0.86, y: 0.1, r: 1.1, o: 0.3 },
  { x: 0.94, y: 0.05, r: 1.5, o: 0.4 },
  { x: 0.11, y: 0.16, r: 1.0, o: 0.24 },
  { x: 0.9, y: 0.17, r: 1.0, o: 0.24 },
]

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("lantern capture failed to load"))
    img.src = src
  })
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number): void {
  // Chromium/Firefox support ctx.letterSpacing; Safari <17 ignores it (graceful)
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ("letterSpacing" in c) c.letterSpacing = `${px}px`
}

/** greedy word-wrap for the lyric line (some lines run long) — max 2 rows */
function wrapLyric(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const rows: string[] = []
  let row = ""
  for (const ch of text) {
    if (ctx.measureText(row + ch).width > maxWidth && row) {
      rows.push(row)
      row = ch
      if (rows.length === 2) break
    } else {
      row += ch
    }
  }
  if (row && rows.length < 2) rows.push(row)
  // ellipsis if the line simply cannot fit in two rows
  if (rows.length === 2 && rows.join("").length < text.replace(/\s/g, "").length) {
    rows[1] = rows[1].replace(/.{1}$/, "") + "…"
  }
  return rows
}

export async function renderShareCard(options: ShareCardOptions): Promise<HTMLCanvasElement> {
  const { lanternCapture, songTitle, artist, moonLyric, year = 2026 } = options
  const capture = await loadImage(lanternCapture)

  const canvas = document.createElement("canvas")
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("2d context unavailable")

  // ---- night sky: very deep, single quiet radial falloff ----
  const bg = ctx.createRadialGradient(CARD_WIDTH / 2, CARD_HEIGHT * 0.34, 60, CARD_WIDTH / 2, CARD_HEIGHT * 0.34, CARD_HEIGHT * 0.85)
  bg.addColorStop(0, NIGHT_TOP)
  bg.addColorStop(0.6, "#0A1322")
  bg.addColorStop(1, NIGHT_BOTTOM)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // ---- sparse stars (top corners only — the lantern owns the centre) ----
  ctx.fillStyle = INK
  for (const s of STARS) {
    ctx.globalAlpha = s.o
    ctx.beginPath()
    ctx.arc(s.x * CARD_WIDTH, s.y * CARD_HEIGHT, s.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1

  // ---- the lantern: live capture composited over the night ----
  // the WebGL buffer has a transparent background, so the card's own night
  // shows through. Crop a square around the lantern (slightly above centre);
  // the side is capped by the capture's WIDTH so portrait phones (tall
  // narrow canvases) never sample outside the image.
  const crop = Math.round(Math.min(capture.width, capture.height * 0.92) * 0.98)
  const sx = Math.min(Math.max(Math.round(capture.width / 2 - crop / 2), 0), capture.width - crop)
  const sy = Math.min(Math.max(Math.round(capture.height * 0.47 - crop / 2), 0), capture.height - crop)
  const drawSize = CARD_WIDTH // full-bleed square, lantern ≈ 50% of card height

  // feather the crop edges with a radial alpha mask — the lantern's glow
  // fades into the card's night instead of showing a hard square boundary
  const feather = document.createElement("canvas")
  feather.width = crop
  feather.height = crop
  const fctx = feather.getContext("2d")
  if (!fctx) throw new Error("2d context unavailable")
  fctx.drawImage(capture, sx, sy, crop, crop, 0, 0, crop, crop)
  const mask = fctx.createRadialGradient(crop / 2, crop / 2, crop * 0.3, crop / 2, crop / 2, crop * 0.5)
  mask.addColorStop(0, "rgba(0,0,0,1)")
  mask.addColorStop(1, "rgba(0,0,0,0)")
  fctx.globalCompositeOperation = "destination-in"
  fctx.fillStyle = mask
  fctx.fillRect(0, 0, crop, crop)

  ctx.drawImage(feather, 0, Math.round(CARD_HEIGHT * 0.3 - drawSize / 2), drawSize, drawSize)

  // ---- words ----
  ctx.textAlign = "center"
  ctx.fillStyle = INK

  ctx.font = '300 52px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 14)
  ctx.shadowColor = `rgba(${WARM},0.45)`
  ctx.shadowBlur = 26
  ctx.fillText("今晚，灯亮了。", CARD_WIDTH / 2, CARD_HEIGHT * 0.7)
  ctx.shadowBlur = 0
  setLetterSpacing(ctx, 0)

  // ---- the moon lyric: quiet line between the headline and the song ----
  let creditY = CARD_HEIGHT * 0.795
  if (moonLyric) {
    ctx.font = '300 28px "PingFang SC", "Microsoft YaHei", sans-serif'
    setLetterSpacing(ctx, 4)
    const rows = wrapLyric(ctx, moonLyric, CARD_WIDTH * 0.74)
    ctx.fillStyle = "rgba(232,228,218,0.48)"
    rows.forEach((row, i) => {
      const prefix = i === 0 ? "“" : ""
      const suffix = i === rows.length - 1 ? "”" : ""
      ctx.fillText(`${prefix}${row}${suffix}`, CARD_WIDTH / 2, CARD_HEIGHT * 0.752 + i * 46)
    })
    setLetterSpacing(ctx, 0)
    creditY = CARD_HEIGHT * 0.752 + rows.length * 46 + 34
  }

  ctx.fillStyle = "rgba(232,228,218,0.55)"
  ctx.font = '300 30px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 6)
  ctx.fillText(artist, CARD_WIDTH / 2, creditY)
  ctx.fillStyle = "rgba(232,228,218,0.82)"
  ctx.font = '300 42px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(`《${songTitle}》`, CARD_WIDTH / 2, creditY + 54)
  setLetterSpacing(ctx, 0)

  // ---- quiet footer ----
  ctx.fillStyle = "rgba(232,228,218,0.4)"
  ctx.font = '300 26px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 8)
  ctx.fillText(`我的灯笼 · ${year}`, CARD_WIDTH / 2, CARD_HEIGHT * 0.935)
  setLetterSpacing(ctx, 0)

  // qrUrl intentionally unused for now — see ShareCardOptions.qrUrl (spec §11)

  return canvas
}
