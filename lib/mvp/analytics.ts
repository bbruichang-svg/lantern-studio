/**
 * MVP analytics — anonymous events only, no account system (PRD §12).
 *
 * P0 sink: events go into a local queue (localStorage ring buffer) plus
 * console for dev visibility. No server reporting. When a stats service
 * is wired up later (P1), the stored queue is drained from here and the
 * rest of the app never changes (track() signature is stable).
 *
 * Each record carries: event name, payload, timestamp, anonymous device
 * UUID, coarse device class and app version. No IP, no blessing text.
 */
export type MvpEvent =
  | "page_view"
  | "start_clicked"
  | "color_selected"
  | "face_selected"
  | "face_draw_opened"
  | "face_draw_saved"
  | "face_draw_cancelled"
  | "face_custom_deleted"
  | "light_clicked"
  | "light_hold_started"
  | "light_hold_completed"
  | "light_hold_cancelled"
  | "light_completed"
  | "light_auto_release"
  | "song_clicked"
  | "go_release_clicked"
  | "share_clicked"
  | "share_link_opened"
  | "share_opened"
  | "share_downloaded"
  | "share_native"
  | "share_closed"
  // release (放灯) route — separate funnel from the root MVP
  | "release_page_view"
  | "release_prefilled"
  | "release_start"
  | "release_charge_entered"
  | "release_hold_started"
  | "release_hold_short"
  | "release_hold_released"
  | "release_soar_complete"
  | "release_hang"
  | "release_dissolve_complete"
  | "release_memory"
  | "release_song_clicked"
  | "release_share_opened"
  | "release_share_opened_card"
  | "release_share_native"
  | "release_share_downloaded"

export type Payload = Record<string, string | number>

/** one stored analytics record (PRD §12: user_id/timestamp/device/version) */
export type TrackRecord = {
  e: MvpEvent
  p?: Payload
  /** epoch ms */
  t: number
  /** anonymous per-device UUID, generated once and kept in localStorage */
  u: string
  /** coarse device class: "m" mobile / "d" desktop */
  d: "m" | "d"
  /** app version of the analytics schema */
  v: "1"
}

const QUEUE_KEY = "ml_track_v1"
const UID_KEY = "ml_uid"
/** ring-buffer cap — old events fall off the front, never grow unbounded */
const QUEUE_MAX = 200
const APP_VERSION = "1"

/** in-memory fallback when localStorage is unavailable/quota-dead */
const memoryQueue: TrackRecord[] = []

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function deviceClass(): "m" | "d" {
  if (!isBrowser()) return "d"
  return window.matchMedia("(pointer: coarse)").matches ? "m" : "d"
}

/** one anonymous UUID per device, generated on first use */
function anonId(): string {
  if (!isBrowser()) return "ssr"
  try {
    let id = window.localStorage.getItem(UID_KEY)
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(UID_KEY, id)
    }
    return id
  } catch {
    return "anon"
  }
}

function readQueue(): TrackRecord[] {
  if (!isBrowser()) return [...memoryQueue]
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    if (!raw) return [...memoryQueue]
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TrackRecord[]) : []
  } catch {
    return [...memoryQueue]
  }
}

function writeQueue(records: TrackRecord[]): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(records.slice(-QUEUE_MAX)))
  } catch {
    // quota/private mode — keep the tail in memory for this session only
    memoryQueue.length = 0
    memoryQueue.push(...records.slice(-QUEUE_MAX))
  }
}

function consoleSink(event: MvpEvent, payload?: Payload): void {
  console.info(`[track] ${event}`, payload ?? "")
}

export function track(event: MvpEvent, payload?: Payload): void {
  consoleSink(event, payload)
  const record: TrackRecord = {
    e: event,
    ...(payload ? { p: payload } : {}),
    t: Date.now(),
    u: anonId(),
    d: deviceClass(),
    v: APP_VERSION,
  }
  const queue = readQueue()
  queue.push(record)
  writeQueue(queue)
}

/** debug export (PRD §12: 提供调试导出接口) — full queue, oldest first */
export function exportAnalytics(): TrackRecord[] {
  return readQueue()
}

/** debug export as a JSON string, ready to copy/save */
export function exportAnalyticsJson(): string {
  return JSON.stringify(readQueue(), null, 2)
}

/** drop everything (合规「清除数据」按钮可接这个) */
export function clearAnalytics(): void {
  memoryQueue.length = 0
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(QUEUE_KEY)
  } catch {
    /* ignore */
  }
}
