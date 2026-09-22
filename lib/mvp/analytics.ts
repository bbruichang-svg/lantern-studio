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
  | "light_completed"
  | "song_clicked"
  | "share_clicked"
  | "share_opened"
  | "share_downloaded"
  | "share_native"
  | "share_closed"

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
