import { getColorById, getDefaultFace } from "@/lib/lantern/colors"
import type { FacePreset, LanternColor } from "@/lib/lantern/types"

/**
 * MVP palette — four curations drawn from the existing 28-city colour
 * system (colour + face stay bound, so picking a colour picks that
 * city's artwork; no new material or pattern system is introduced).
 */
export type MvpColorOption = {
  /** lantern colour id (city) in the existing colour system */
  id: string
  /** spec key */
  key: "siennaRed" | "osmanthusYellow" | "nightPurple" | "moonGreen"
  label: string
  swatch: string
}

export const MVP_COLORS: readonly MvpColorOption[] = [
  { id: "chengdu", key: "siennaRed", label: "赭红", swatch: "#E03860" },
  { id: "nanjing", key: "osmanthusYellow", label: "桂黄", swatch: "#F8C840" },
  { id: "suzhou", key: "nightPurple", label: "夜紫", swatch: "#9838D0" },
  { id: "chongqing", key: "moonGreen", label: "月绿", swatch: "#B0E0A0" },
]

export function getMvpColor(id: string): LanternColor {
  return getColorById(id)
}

export function getMvpFace(id: string): FacePreset {
  return getDefaultFace(id)
}
