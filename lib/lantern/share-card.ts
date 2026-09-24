/**
 * Share card composer — 1080 × 1440 (3:4, PRD F4), pure Canvas 2D.
 *
 * Visual contract: night + one lantern + minimal words.
 * Lantern > light > text > sky. No festival poster decoration.
 * The lantern itself is the LIVE capture of the user's own lit lantern
 * (colour + pattern + inner light), never a redrawn variant.
 *
 * PRD F4-E1 content: lantern design, blessing, lantern number,
 * activity name + site info. F4-E2: if the dark plate fails, a light
 * (paper) plate with the SAME layout is generated instead.
 */

export const CARD_WIDTH = 1080
export const CARD_HEIGHT = 1440

export type ShareCardOptions = {
  /** PNG data URL captured from the live WebGL canvas (frozen frame) */
  lanternCapture: string
  songTitle: string
  artist: string
  /** one moon-lit lyric line, printed between the headline and the song credit */
  moonLyric?: string
  /** the user's own blessing (寄语), quoted above the headline */
  blessing?: string
  /** formatted lantern number, e.g. "No.00042" */
  lanternNo?: string
  /** headline above the lyric (default 「今晚，灯亮了。」 — the MVP light-up;
   * the release route passes its hang-finale variant) */
  headline?: string
  /** shown in the footer line (default 2026) */
  year?: number
  /**
   * Reserved for the QR module: no stable production URL yet,
   * so nothing is drawn. When provided later, render a 120px QR above
   * the footer line with 「点一盏灯」 beside it.
   */
  qrUrl?: string
}

type CardTheme = {
  /** radial background stops, centre → mid → edge */
  bg: [string, string, string]
  ink: string
  /** dim variant of ink, as rgba string */
  inkDim: (a: number) => string
  /** warm accent for the headline glow shadow */
  warm: string
  /** star opacity multiplier (0 = no stars on the light plate) */
  stars: number
}

const DARK: CardTheme = {
  bg: ["#101B30", "#0A1322", "#060B16"],
  ink: "#E8E4DA",
  inkDim: (a) => `rgba(232,228,218,${a})`,
  warm: "rgba(255,216,170,0.45)",
  stars: 1,
}

const LIGHT: CardTheme = {
  bg: ["#F8F2E7", "#F0E7D6", "#E3D7BF"],
  ink: "#2A2622",
  inkDim: (a) => `rgba(42,38,34,${a})`,
  warm: "rgba(181,101,30,0.4)",
  stars: 0,
}

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

/** greedy word-wrap for a quoted line — max 2 rows */
function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
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

async function composeCard(
  capture: HTMLImageElement,
  options: ShareCardOptions,
  theme: CardTheme,
): Promise<HTMLCanvasElement> {
  const { songTitle, artist, moonLyric, blessing, lanternNo, year = 2026 } = options

  const canvas = document.createElement("canvas")
  canvas.width = CARD_WIDTH
  canvas.height = CARD_HEIGHT
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("2d context unavailable")

  // ---- background: one quiet radial falloff ----
  const bg = ctx.createRadialGradient(
    CARD_WIDTH / 2,
    CARD_HEIGHT * 0.3,
    60,
    CARD_WIDTH / 2,
    CARD_HEIGHT * 0.3,
    CARD_HEIGHT * 0.88,
  )
  bg.addColorStop(0, theme.bg[0])
  bg.addColorStop(0.6, theme.bg[1])
  bg.addColorStop(1, theme.bg[2])
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT)

  // ---- sparse stars (top corners only — the lantern owns the centre) ----
  if (theme.stars > 0) {
    ctx.fillStyle = theme.ink
    for (const s of STARS) {
      ctx.globalAlpha = s.o * theme.stars
      ctx.beginPath()
      ctx.arc(s.x * CARD_WIDTH, s.y * CARD_HEIGHT, s.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  // ---- the lantern: live capture composited over the plate ----
  // the WebGL buffer has a transparent background, so the plate's own
  // ground shows through. Crop a square around the lantern (slightly
  // above centre); the side is capped by the capture's WIDTH so portrait
  // phones (tall narrow canvases) never sample outside the image.
  const crop = Math.round(Math.min(capture.width, capture.height * 0.92) * 0.98)
  const sx = Math.min(Math.max(Math.round(capture.width / 2 - crop / 2), 0), capture.width - crop)
  const sy = Math.min(Math.max(Math.round(capture.height * 0.47 - crop / 2), 0), capture.height - crop)
  const drawSize = CARD_WIDTH // full-bleed square, lantern ≈ 50% of card height

  // feather the crop edges with a radial alpha mask — the lantern's glow
  // fades into the plate instead of showing a hard square boundary
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

  ctx.drawImage(feather, 0, Math.round(CARD_HEIGHT * 0.29 - drawSize / 2), drawSize, drawSize)

  // ---- words ----
  ctx.textAlign = "center"
  ctx.fillStyle = theme.ink

  // blessing (寄语) — the user's own words, quoted, above the headline
  const headlineY = CARD_HEIGHT * 0.655
  if (blessing && blessing.trim()) {
    ctx.font = '300 34px "PingFang SC", "Microsoft YaHei", sans-serif'
    setLetterSpacing(ctx, 6)
    const rows = wrapLine(ctx, blessing.trim(), CARD_WIDTH * 0.74)
    ctx.fillStyle = theme.inkDim(0.88)
    rows.forEach((row, i) => {
      const prefix = i === 0 ? "“" : ""
      const suffix = i === rows.length - 1 ? "”" : ""
      ctx.fillText(`${prefix}${row}${suffix}`, CARD_WIDTH / 2, CARD_HEIGHT * 0.575 + i * 48)
    })
    setLetterSpacing(ctx, 0)
  }

  ctx.fillStyle = theme.ink
  ctx.font = '300 52px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 14)
  ctx.shadowColor = theme.warm
  ctx.shadowBlur = 26
  ctx.fillText(options.headline ?? "今晚，灯亮了。", CARD_WIDTH / 2, headlineY)
  ctx.shadowBlur = 0
  setLetterSpacing(ctx, 0)

  // ---- the moon lyric: quiet line between the headline and the song ----
  let creditY = CARD_HEIGHT * 0.76
  if (moonLyric) {
    ctx.font = '300 28px "PingFang SC", "Microsoft YaHei", sans-serif'
    setLetterSpacing(ctx, 4)
    const rows = wrapLine(ctx, moonLyric, CARD_WIDTH * 0.74)
    ctx.fillStyle = theme.inkDim(0.48)
    rows.forEach((row, i) => {
      const prefix = i === 0 ? "“" : ""
      const suffix = i === rows.length - 1 ? "”" : ""
      ctx.fillText(`${prefix}${row}${suffix}`, CARD_WIDTH / 2, CARD_HEIGHT * 0.712 + i * 46)
    })
    setLetterSpacing(ctx, 0)
    creditY = CARD_HEIGHT * 0.712 + rows.length * 46 + 40
  }

  ctx.fillStyle = theme.inkDim(0.55)
  ctx.font = '300 30px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 6)
  ctx.fillText(artist, CARD_WIDTH / 2, creditY)
  ctx.fillStyle = theme.inkDim(0.82)
  ctx.font = '300 42px "PingFang SC", "Microsoft YaHei", sans-serif'
  ctx.fillText(`《${songTitle}》`, CARD_WIDTH / 2, creditY + 54)
  setLetterSpacing(ctx, 0)

  // ---- footer: lantern number + activity name (PRD F4-E1) ----
  ctx.fillStyle = theme.inkDim(0.5)
  ctx.font = '300 28px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 6)
  const no = lanternNo && lanternNo.trim() ? lanternNo.trim() : null
  ctx.fillText(
    no ? `${no} · 月球上的人 · ${year}` : `月球上的人 · ${year}`,
    CARD_WIDTH / 2,
    CARD_HEIGHT * 0.9,
  )
  setLetterSpacing(ctx, 0)

  // site info — small, quiet, last thing on the card
  ctx.fillStyle = theme.inkDim(0.35)
  ctx.font = '300 22px "PingFang SC", "Microsoft YaHei", sans-serif'
  setLetterSpacing(ctx, 3)
  ctx.fillText("moon-lantern.app.workbuddy.host", CARD_WIDTH / 2, CARD_HEIGHT * 0.938)
  setLetterSpacing(ctx, 0)

  // qrUrl intentionally unused for now — see ShareCardOptions.qrUrl
  return canvas
}

/**
 * Compose the share card. The dark (night) plate is the default; if it
 * fails for any reason, the light (paper) plate with the same layout is
 * generated instead (PRD F4-E2). Only when both fail does the error
 * propagate to the caller's copy-text fallback.
 */
export async function renderShareCard(options: ShareCardOptions): Promise<HTMLCanvasElement> {
  const capture = await loadImage(options.lanternCapture)
  try {
    return await composeCard(capture, options, DARK)
  } catch (darkError) {
    try {
      return await composeCard(capture, options, LIGHT)
    } catch {
      throw darkError
    }
  }
}
