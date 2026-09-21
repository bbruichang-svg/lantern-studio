export type LanternColor = {
  id: string
  name: string
  base: string
  /** stroke colour of the drawn face — a darker (or lighter) shade of base, per the DTZ design system */
  line: string
  glow: string
}

export type FaceId =
  | "happy"
  | "smile"
  | "squint"
  | "surprised"
  | "shy"
  | "sleepy"
  | "laugh"
  | "neutral"

export type FacePreset = {
  id: FaceId
  name: string
}

export type StudioMode = "color" | "face"

export type LanternPhase = "studio" | "ready" | "lighting" | "finished"
