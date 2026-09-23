/**
 * MVP analytics — anonymous events only, no account system.
 * The MVP sink is console-only; swapping in a real SDK later means
 * editing this file and nothing else.
 */
export type MvpEvent =
  | "page_view"
  | "start_clicked"
  | "color_selected"
  | "face_selected"
  | "light_clicked"
  | "light_hold_started"
  | "light_hold_completed"
  | "light_hold_cancelled"
  | "light_completed"
  | "song_clicked"
  | "share_clicked"
  | "share_link_opened"
  | "share_opened"
  | "share_downloaded"
  | "share_native"
  | "share_closed"
  // release (放灯) route — separate funnel from the root MVP
  | "release_page_view"
  | "release_start"
  | "release_charge_entered"
  | "release_hold_started"
  | "release_hold_short"
  | "release_hold_released"
  | "release_soar_complete"
  | "release_memory"
  | "release_song_clicked"
  | "release_share_opened"
  | "release_share_opened_card"
  | "release_share_native"
  | "release_share_downloaded"

type Payload = Record<string, string | number>
type Sink = (event: MvpEvent, payload?: Payload) => void

const sinks: Sink[] = [
  (event, payload) => {
    console.info(`[track] ${event}`, payload ?? "")
  },
]

export function track(event: MvpEvent, payload?: Payload): void {
  for (const sink of sinks) sink(event, payload)
}
