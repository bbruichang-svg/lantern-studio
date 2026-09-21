export type LanternColor = {
  id: string
  name: string
  base: string
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
