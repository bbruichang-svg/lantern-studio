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

/**
 * MVP state machine (root page). Kept separate from LanternPhase so the
 * full studio at /lantern stays untouched.
 */
export type MvpStage =
  | "landing"
  | "make"
  | "blessing"
  | "lighting"
  | "finished"
  | "share"

/**
 * Release (放灯) route state machine — separate from MvpStage so the root
 * MVP stays untouched. The lantern is charged by holding, then released to
 * soar; lighting & finished are folded into the charge→release moment.
 * arrive: idle grounded lantern · wish: write a blessing · charge: hold to
 * charge (chargeRef drives the glow) · soar: rising · apex: high & still,
 * moon-framed · memory: blessing surfaces · share: card/link.
 */
export type ReleaseStage =
  | "arrive"
  | "wish"
  | "charge"
  | "soar"
  | "apex"
  | "memory"
  | "share"
