/**
 * 分享链接内嵌手绘图 (P2) — 把 1024px 手绘 dataURL 压成可随 URL 走的
 * 小图。链路：缩到 128×128 → alpha 阈值化（硬边，PNG 行程压缩友好）→
 * 不透明像素量化到调色板最近色（彩笔画通常只用了其中 2~4 色）→
 * PNG dataURL。实测线稿 ≈ 0.5–2KB，base64url 后 ~0.7–2.7KB —— 远低于
 * 单条 URL 的实用上限（无 QR 负担，卡上链接是纯文本复制）。
 *
 * 超过 EMBED_MAX_CHARS 一律返回 null：链接退回 faceId 字段（收灯人
 * 按 本机画廊 → 最新一张 → 城市默认 的既有回退链恢复），绝不发一条
 * 被聊天软件截断的巨长链接。
 */

import { getColorById } from "./colors"
import { inkPalette } from "@/components/lantern/FacePainter"

/** 缩略图边长 — 灯笼纸面很小，128px 足够读出笔画 */
const EMBED_SIZE = 128
/** alpha 高于该值的像素才算落墨（阈值化去掉抗锯齿灰边，压体积） */
const ALPHA_THRESHOLD = 140
/** dataURL 字符上限（超限放弃内嵌） */
export const EMBED_MAX_CHARS = 6000

function dist2(r: number, g: number, b: number, hex: string): number {
  const v = parseInt(hex.slice(1), 16)
  const dr = r - ((v >> 16) & 0xff)
  const dg = g - ((v >> 8) & 0xff)
  const db = b - (v & 0xff)
  return dr * dr + dg * dg + db * db
}

/** 加载一张 dataURL/URL 图。失败返回 null（调用点走无图回退）。 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/**
 * 生成随链接内嵌的小图 dataURL。非手绘/加载失败/超限都返回 null。
 * 调用方应在 face 变化时预计算（异步），不要在同步渲染路径上等它。
 */
export async function embedFaceData(src: string, colorId: string): Promise<string | null> {
  const img = await loadImage(src)
  if (!img) return null
  const canvas = document.createElement("canvas")
  canvas.width = EMBED_SIZE
  canvas.height = EMBED_SIZE
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, EMBED_SIZE, EMBED_SIZE)

  const data = ctx.getImageData(0, 0, EMBED_SIZE, EMBED_SIZE)
  const px = data.data
  // 调色板 = 首色随城市线色 + 固定彩笔（与 FacePainter 同源）
  const palette = inkPalette(getColorById(colorId).line)
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < ALPHA_THRESHOLD) {
      px[i + 3] = 0
      continue
    }
    px[i + 3] = 255
    // 量化到最近调色板色 — 颜色数骤减是 PNG 变小的关键
    let best = palette[0]
    let bestD = Infinity
    for (const hex of palette) {
      const d = dist2(px[i], px[i + 1], px[i + 2], hex)
      if (d < bestD) {
        bestD = d
        best = hex
      }
    }
    const v = parseInt(best.slice(1), 16)
    px[i] = (v >> 16) & 0xff
    px[i + 1] = (v >> 8) & 0xff
    px[i + 2] = v & 0xff
  }
  ctx.putImageData(data, 0, 0)
  const out = canvas.toDataURL("image/png")
  return out.length <= EMBED_MAX_CHARS ? out : null
}
