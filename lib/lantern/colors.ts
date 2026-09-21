import type { FacePreset, LanternColor } from "./types"

/**
 * DTZ palette — extracted from the 28 big-head (大头仔) city designs.
 * Standard rule: near-black ink strokes; a few designs invert to
 * light strokes on dark/grey bases (kept explicit below).
 */
function mixHex(hex: string, target: string, ratio: number): string {
  const h = hex.replace("#", "")
  const t = target.replace("#", "")
  const out = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16)
    const tv = parseInt(t.slice(i, i + 2), 16)
    return Math.round(v * (1 - ratio) + tv * ratio)
  })
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`
}

const lighten = (hex: string, ratio = 0.42) => mixHex(hex, "#FFFFFF", ratio)

/**
 * DTZ source artwork draws every standard design with near-black ink —
 * the stroke is NOT a darkened shade of the base. Only the inverted
 * designs (dark bases / white faces) specify their own line colour.
 */
const DEFAULT_LINE = "#221A14"

type ColorSeed = {
  id: string
  name: string
  base: string
  /** explicit stroke colour for the inverted designs */
  line?: string
}

const SEEDS: readonly ColorSeed[] = [
  { id: "chengdu", name: "成都", base: "#E03860" },
  { id: "guangzhou", name: "广州", base: "#E86078" },
  { id: "xiamen", name: "厦门", base: "#F86038" },
  { id: "xian", name: "西安", base: "#F09070" },
  { id: "nanjing", name: "南京", base: "#F8C840" },
  { id: "wuhan", name: "武汉", base: "#F8E830" },
  { id: "hangzhou", name: "杭州", base: "#C8F800" },
  { id: "ningbo", name: "宁波", base: "#60F860" },
  { id: "dalian", name: "大连", base: "#A8E8D0" },
  { id: "hangzhou20", name: "墨黑", base: "#262626", line: "#C9C9C9" },
  { id: "quanzhou", name: "泉州", base: "#50B8E0" },
  { id: "suzhou", name: "苏州", base: "#9838D0" },
  { id: "shenzhen", name: "深圳", base: "#B8A0E8" },
  { id: "hefei", name: "合肥", base: "#B0D0F8" },
  { id: "foshan", name: "佛山", base: "#B0F0E0" },
  { id: "sydney", name: "悉尼", base: "#D8D0C0", line: "#907868" },
  { id: "chongqing", name: "重庆", base: "#B0E0A0" },
  { id: "london", name: "伦敦", base: "#B0D0F8", line: "#0A2C50" },
  { id: "yokohama", name: "横滨", base: "#909090" },
  { id: "kaohsiung", name: "高雄", base: "#F8E8B0" },
  { id: "haikou", name: "海口", base: "#F8B8B0" },
  { id: "beijing", name: "北京", base: "#F8B0C8" },
  { id: "macau-pink", name: "澳门粉", base: "#F0B8C0", line: "#FFFFFF" },
  { id: "macau-gray", name: "澳门灰", base: "#A09898", line: "#FFFFFF" },
  { id: "macau-olive", name: "澳门橄榄", base: "#808048" },
  { id: "mono", name: "墨夜", base: "#141414", line: "#F5F5F5" },
  { id: "xuan", name: "宣纸白", base: "#F2EDE0" },
] as const

export const LANTERN_COLORS: readonly LanternColor[] = SEEDS.map((s) => ({
  id: s.id,
  name: s.name,
  base: s.base,
  line: s.line ?? DEFAULT_LINE,
  glow: lighten(s.base),
}))

export const DEFAULT_COLOR_ID = "xuan"

export function getColorById(id: string): LanternColor {
  return LANTERN_COLORS.find((c) => c.id === id) ?? LANTERN_COLORS[0]
}

/* ------------------------------------------------------------------ */
/* Faces — the real DTZ artwork, preprocessed into stroke-only discs   */
/* (one PNG per design under /public/faces). Every city colour owns    */
/* its matching face; 苏州 ships two expressions (black & white ink).  */
/* ------------------------------------------------------------------ */

export const FACE_SRC_PREFIX = "/faces"

export function faceSrc(id: string): string {
  return `${FACE_SRC_PREFIX}/${id}.png`
}

export const ALL_FACES: readonly FacePreset[] = [
  ...SEEDS.map((s) => ({ id: s.id, name: s.name, src: faceSrc(s.id), colorId: s.id })),
  { id: "suzhou2", name: "苏州·惊讶", src: faceSrc("suzhou2"), colorId: "suzhou" },
]

export function getDefaultFace(colorId: string): FacePreset {
  return ALL_FACES.find((f) => f.id === colorId) ?? ALL_FACES[0]
}

export function getFaceById(id: string): FacePreset | null {
  return ALL_FACES.find((f) => f.id === id) ?? null
}
