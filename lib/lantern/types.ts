export type LanternColor = {
  id: string
  name: string
  base: string
  /** stroke colour of the DTZ design (kept for reference / glow tweaks) */
  line: string
  glow: string
}

export type FacePreset = {
  id: string
  name: string
  /** /faces/<slug>.png — preprocessed DTZ artwork (strokes on transparent disc) */
  src: string
  /** the city colour this face belongs to */
  colorId: string
}

export type StudioMode = "color" | "face"

export type LanternPhase = "studio" | "ready" | "lighting" | "finished"
