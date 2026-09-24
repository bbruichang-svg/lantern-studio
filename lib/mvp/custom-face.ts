/**
 * 本机手绘表情 — 多张画廊 (v2)。灯记录通过 faceId "custom:<id>" 引用
 * 具体某一张；旧的 faceId "custom"（单槽时代）解析为最新一张。画本身存
 * 在独立 localStorage key（1024px 线稿 PNG dataURL ≈ 30–120KB/张，上限
 * 6 张把配额留在安全区，超出时淘汰最旧）。
 *
 * v1（moon.customFace.v1 单槽）首次读取时自动迁移进画廊。
 * 隐私模式同样回退内存数组。分享链接无法承载原图 — 恢复手绘灯时回退
 * 本机同 id 画廊 → 最新一张 → 城市默认（见 resolveFaceById 与调用点）；
 * 带内嵌图的链接走 LanternPayload.fd，不经过这里。
 */

import type { FacePreset } from "@/lib/lantern/types"
import { getFaceById } from "@/lib/lantern/colors"

const KEY = "moon.customFaces.v2"
/** 上一代单槽 key — 只为迁移而读 */
const LEGACY_KEY = "moon.customFace.v1"
/** 配额安全上限：6 × ~120KB ≈ 720KB，localStorage（~5MB）余量充足 */
export const CUSTOM_FACE_CAP = 6

export type StoredCustomFace = {
  /** 画廊内唯一 id；灯记录/分享 payload 里写作 custom:<id> */
  id: string
  /** PNG dataURL, 1024×1024 stroke disc (transparent outside the disc) */
  src: string
  /** city colour the ink was matched to (line colour follows the design) */
  colorId: string
  savedAt: number
}

let volatileFaces: StoredCustomFace[] | null = null

function storage(): Storage | null {
  try {
    const s = window.localStorage
    s.getItem(KEY) // probe — throws in some private-mode setups
    return s
  } catch {
    return null
  }
}

function isFace(x: unknown): x is StoredCustomFace {
  const f = x as StoredCustomFace
  return (
    !!f &&
    typeof f.id === "string" &&
    typeof f.src === "string" &&
    typeof f.colorId === "string" &&
    typeof f.savedAt === "number"
  )
}

/** v1 单槽 → v2 画廊：读取旧 key，转成一条记录（成功后清掉旧 key） */
function migrateLegacy(s: Storage): StoredCustomFace[] {
  try {
    const raw = s.getItem(LEGACY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (
      !!parsed &&
      typeof (parsed as StoredCustomFace).src === "string" &&
      typeof (parsed as StoredCustomFace).colorId === "string"
    ) {
      const legacy = parsed as { src: string; colorId: string; savedAt?: number }
      const migrated: StoredCustomFace = {
        id: `c${legacy.savedAt ?? 1}`,
        src: legacy.src,
        colorId: legacy.colorId,
        savedAt: legacy.savedAt ?? 1,
      }
      try {
        s.setItem(KEY, JSON.stringify([migrated]))
        s.removeItem(LEGACY_KEY)
      } catch {
        // 迁移写不进也照常返回 — 本会话内存里还有
      }
      return [migrated]
    }
  } catch {
    // corrupt legacy slot — treat as absent
  }
  return []
}

export function readCustomFaces(): StoredCustomFace[] {
  const s = storage()
  if (!s) {
    if (!volatileFaces) volatileFaces = []
    return volatileFaces
  }
  try {
    const raw = s.getItem(KEY)
    if (!raw) return migrateLegacy(s)
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isFace)
  } catch {
    return []
  }
}

function writeFaces(list: StoredCustomFace[]): boolean {
  volatileFaces = list
  const s = storage()
  if (!s) return true
  try {
    s.setItem(KEY, JSON.stringify(list))
    return true
  } catch {
    return false
  }
}

/** 新增一张。false = 配额写入失败（本会话内存里仍可用） */
export function addCustomFace(
  src: string,
  colorId: string,
): { face: StoredCustomFace; ok: boolean } {
  const face: StoredCustomFace = {
    id: `c${Date.now()}`,
    src,
    colorId,
    savedAt: Date.now(),
  }
  // newest first；超出上限淘汰最旧
  const list = [face, ...readCustomFaces()].slice(0, CUSTOM_FACE_CAP)
  return { face, ok: writeFaces(list) }
}

export function removeCustomFace(id: string): void {
  writeFaces(readCustomFaces().filter((f) => f.id !== id))
}

/** The FacePreset the rest of the app consumes (id "custom:<id>"). */
export function customFacePreset(stored: StoredCustomFace): FacePreset {
  return {
    id: `custom:${stored.id}`,
    name: "手绘",
    src: stored.src,
    colorId: stored.colorId,
    custom: true,
  }
}

/**
 * 解析灯记录里的手绘 faceId —
 *  - "custom:<id>"：本机画廊精确匹配
 *  - "custom"（旧记录）：最新一张
 *  - 其它/找不到：null（调用点回退城市默认）
 * 预设表情不在职责内（用 getFaceById）。
 */
export function resolveCustomFace(faceId: string): FacePreset | null {
  if (faceId === "custom") {
    const latest = readCustomFaces()[0]
    return latest ? customFacePreset(latest) : null
  }
  if (faceId.startsWith("custom:")) {
    const id = faceId.slice("custom:".length)
    const hit = readCustomFaces().find((f) => f.id === id)
    if (hit) return customFacePreset(hit)
    // 本机删了那张画 → 退回最新一张，灯不至于变没脸
    const latest = readCustomFaces()[0]
    return latest ? customFacePreset(latest) : null
  }
  return null
}

/**
 * 灯记录 faceId 的统一解析：预设优先，其次本机手绘画廊，
 * 都没有 → null（调用点自行回退 getDefaultFace）。
 */
export function resolveFaceById(faceId: string): FacePreset | null {
  return getFaceById(faceId) ?? resolveCustomFace(faceId)
}
