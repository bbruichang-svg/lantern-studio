/**
 * 本机灯册 — everything lives in localStorage, nothing leaves the device.
 * Falls back to an in-memory array when storage is unavailable (private
 * mode), and trims oldest-first when quota is exhausted.
 */

export type LitLantern = {
  /** 本机自增编号，展示为 No.XXXXX（5 位补零） */
  no: number
  colorId: string
  faceId: string
  blessing: string
  songId: string
  litAt: number
}

const KEY = "moon.lanterns.v1"

let volatile: LitLantern[] | null = null

function storage(): Storage | null {
  try {
    const s = window.localStorage
    s.getItem(KEY) // probe — throws in some private-mode setups
    return s
  } catch {
    return null
  }
}

function readAll(): LitLantern[] {
  const s = storage()
  if (!s) {
    if (!volatile) volatile = []
    return volatile
  }
  try {
    const raw = s.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (x): x is LitLantern =>
        !!x &&
        typeof (x as LitLantern).no === "number" &&
        typeof (x as LitLantern).colorId === "string",
    )
  } catch {
    return []
  }
}

function writeAll(list: LitLantern[]): { ok: boolean; trimmed: boolean } {
  const s = storage()
  if (!s) {
    volatile = list
    return { ok: true, trimmed: false }
  }
  let trimmed = false
  let attempt = [...list]
  // storage full → drop oldest lamps until it fits
  for (;;) {
    try {
      s.setItem(KEY, JSON.stringify(attempt))
      return { ok: true, trimmed }
    } catch {
      if (attempt.length === 0) return { ok: false, trimmed }
      attempt = attempt.slice(1)
      trimmed = true
    }
  }
}

/** 本机累计成功点灯数（删除会同步 -1） */
export function litCount(): number {
  return readAll().length
}

/** 下一盏灯的本机编号：历史最大编号 +1（删除不影响编号递增） */
export function nextNumber(): number {
  const all = readAll()
  return all.reduce((m, x) => Math.max(m, x.no), 0) + 1
}

export function addLantern(
  input: Omit<LitLantern, "no" | "litAt">,
): { ok: boolean; trimmed: boolean; record: LitLantern } {
  const record: LitLantern = { ...input, no: nextNumber(), litAt: Date.now() }
  // newest first keeps later reads sorted without re-sorting
  const res = writeAll([record, ...readAll()])
  return { ...res, record }
}

export function listLanterns(): LitLantern[] {
  return [...readAll()].sort((a, b) => b.litAt - a.litAt)
}

export function removeLantern(no: number): void {
  writeAll(readAll().filter((x) => x.no !== no))
}

export function clearAll(): void {
  const s = storage()
  volatile = []
  if (s) {
    try {
      s.removeItem(KEY)
    } catch {
      // ignore — nothing else to do
    }
  }
}

/** No.XXXXX — 5 位补零 */
export function formatNumber(no: number): string {
  return `No.${String(Math.max(1, no)).padStart(5, "0")}`
}
