/**
 * 本机手绘表情 — single slot: the user's latest drawing. The lantern
 * records reference it via faceId "custom"; the drawing itself lives in
 * its own localStorage key (a 1024px line-art PNG dataURL ≈ 30–120KB,
 * so one slot keeps the quota safe).
 *
 * Falls back to in-memory like the lantern ledger when storage is
 * unavailable (private mode). Sharing links cannot carry the image —
 * restoring a custom-face lamp on another device falls back to that
 * city's default face (handled at the call sites).
 */

import type { FacePreset } from "@/lib/lantern/types"

const KEY = "moon.customFace.v1"

export type StoredCustomFace = {
  /** PNG dataURL, 1024×1024 stroke disc (transparent outside the disc) */
  src: string
  /** city colour the ink was matched to (line colour follows the design) */
  colorId: string
  savedAt: number
}

let volatileFace: StoredCustomFace | null = null

function storage(): Storage | null {
  try {
    const s = window.localStorage
    s.getItem(KEY) // probe — throws in some private-mode setups
    return s
  } catch {
    return null
  }
}

export function readCustomFace(): StoredCustomFace | null {
  const s = storage()
  if (!s) return volatileFace
  try {
    const raw = s.getItem(KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      !!parsed &&
      typeof (parsed as StoredCustomFace).src === "string" &&
      typeof (parsed as StoredCustomFace).colorId === "string"
    ) {
      return parsed as StoredCustomFace
    }
    return null
  } catch {
    return null
  }
}

/** false = quota/availability failure — the face still works this session */
export function writeCustomFace(face: StoredCustomFace): boolean {
  volatileFace = face
  const s = storage()
  if (!s) return true
  try {
    s.setItem(KEY, JSON.stringify(face))
    return true
  } catch {
    return false
  }
}

/** The FacePreset the rest of the app consumes (id "custom"). */
export function customFacePreset(stored: StoredCustomFace): FacePreset {
  return {
    id: "custom",
    name: "手绘",
    src: stored.src,
    colorId: stored.colorId,
    custom: true,
  }
}
