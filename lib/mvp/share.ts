/**
 * 免库分享链接 — the lantern's full config travels inside the URL itself.
 * Zero database, zero network: a visitor's browser restores the lamp
 * locally from `?l=<payload>.<checksum>`.
 * Checksum guards against truncation/tampering; failure falls back to
 * the landing page (the caller shows a soft toast, never an error dump).
 */

export type LanternPayload = {
  /** city colour id */
  c: string
  /** face preset id（手绘为 custom:<id>，旧记录 "custom"） */
  f: string
  /** blessing text (≤20 chars) */
  b: string
  /** song id */
  s: string
  /** local number, displayed No.XXXXX */
  n: number
  /** 内嵌手绘小图 dataURL（可选，P2）——存在时收灯端优先用它还原 */
  fd?: string
}

const PARAM = "l"

function toBase64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(s: string): Uint8Array | null {
  try {
    const b64 = s.replace(/-/g, "+").replace(/_/g, "/")
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

/** djb2 — tiny, stable, enough to catch truncation & hand-edited payloads */
function checksum(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export function encodeLanternPayload(p: LanternPayload): string {
  const json = JSON.stringify(p)
  const body = toBase64Url(new TextEncoder().encode(json))
  return `${body}.${checksum(body)}`
}

/** 相对路径 — 换域名不失效 */
export function lanternLink(p: LanternPayload): string {
  return `/?${PARAM}=${encodeLanternPayload(p)}`
}

export function readLanternFromSearch(search: string): LanternPayload | null {
  try {
    const raw = new URLSearchParams(search).get(PARAM)
    if (!raw) return null
    const dot = raw.lastIndexOf(".")
    if (dot <= 0) return null
    const body = raw.slice(0, dot)
    const chk = raw.slice(dot + 1)
    if (checksum(body) !== chk) return null
    const bytes = fromBase64Url(body)
    if (!bytes) return null
    const json = new TextDecoder().decode(bytes)
    const p: unknown = JSON.parse(json)
    if (
      !!p &&
      typeof (p as LanternPayload).c === "string" &&
      typeof (p as LanternPayload).f === "string" &&
      typeof (p as LanternPayload).b === "string" &&
      typeof (p as LanternPayload).s === "string" &&
      typeof (p as LanternPayload).n === "number" &&
      ((p as LanternPayload).fd === undefined ||
        typeof (p as LanternPayload).fd === "string")
    ) {
      return p as LanternPayload
    }
    return null
  } catch {
    return null
  }
}
