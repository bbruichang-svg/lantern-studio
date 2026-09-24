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
  /** /faces/<slug>.png — preprocessed DTZ artwork (strokes on transparent disc).
   *  Custom hand-drawn faces use a PNG dataURL here; loading is identical. */
  src: string
  /** the city colour this face belongs to */
  colorId: string
  /** true for the user's own hand-drawn face (single local slot) */
  custom?: boolean
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
 * moon-framed · hang: the lamp flies to a bare branch and hangs there,
 * swaying · dissolve: the lantern's light merges into the moon ·
 * memory: blessing surfaces under the moon · share: card/link.
 */
export type ReleaseStage =
  | "arrive"
  | "wish"
  | "charge"
  | "soar"
  | "apex"
  | "hang"
  | "dissolve"
  | "memory"
  | "share"
