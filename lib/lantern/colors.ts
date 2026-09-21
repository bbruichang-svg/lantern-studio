import type { LanternColor } from "./types"

export const LANTERN_COLORS: readonly LanternColor[] = [
  { id: "cinnabar", name: "朱砂红", base: "#C94A48", glow: "#F06A55" },
  { id: "persimmon", name: "柿子橙", base: "#D97832", glow: "#F39A54" },
  { id: "sakura", name: "樱粉", base: "#D98EA9", glow: "#F2AFC2" },
  { id: "osmanthus", name: "桂花黄", base: "#D5A93B", glow: "#FFD66B" },
  { id: "nightviolet", name: "夜紫", base: "#75608F", glow: "#A98BC5" },
  { id: "moonceladon", name: "月青", base: "#83AEB4", glow: "#B4E1E0" },
  { id: "mint", name: "薄荷绿", base: "#91B69B", glow: "#BDE0BA" },
  { id: "xuanpaper", name: "宣纸白", base: "#D8D0B9", glow: "#FFF1C4" },
] as const

export const DEFAULT_COLOR_ID = "xuanpaper"

export function getColorById(id: string): LanternColor {
  return LANTERN_COLORS.find((c) => c.id === id) ?? LANTERN_COLORS[0]
}
