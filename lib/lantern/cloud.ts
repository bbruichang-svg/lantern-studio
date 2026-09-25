/**
 * 公共灯墙数据层 — 每盏灯点亮后匿名汇入云端 wall_lanterns 表：
 * 公共读 / 仅插入（RLS），不可改删。本机灯册（lib/mvp/storage）不变，
 * 两层并存：/my 仍是纯本机，/wall 是所有人的灯。
 *
 * 客户端懒初始化：页面都是 "use client" 但静态导出会在 Node 侧预渲染，
 * SDK 初始化推迟到第一次真正调用（只发生在浏览器事件/副作用里）。
 * 写入 fire-and-forget：云失败完全静默，绝不打断点亮流程。
 */

import { createWorkBuddyCloud } from "@tencent-ai/workbuddy-cloud-sdk"

/** 来自云服务激活结果（publicConfig）——publishableKey 本就随前端可见 */
const CLOUD_ENDPOINT = "https://moonlantern.app.workbuddy.host"
const CLOUD_PUBLISHABLE_KEY =
  "wbpk_czZUfWVM4PB9PfC3Hc8ufp_sbYxBmPvqE21apyRvwgj44VQ9mz5rxZc"

type CloudClient = ReturnType<typeof createWorkBuddyCloud<WallDatabase>>

let client: CloudClient | null = null

function getCloud(): CloudClient | null {
  if (typeof window === "undefined") return null
  if (!client) {
    client = createWorkBuddyCloud<WallDatabase>({
      endpoint: CLOUD_ENDPOINT,
      publishableKey: CLOUD_PUBLISHABLE_KEY,
    })
  }
  return client
}

/** wall_lanterns 行（select 投影） */
export type WallLantern = {
  id: number
  color_id: string
  face_id: string | null
  face_data: string | null
  blessing: string | null
  song_id: string | null
  lit_at: string
}

type WallInsert = {
  color_id: string
  face_id?: string | null
  face_data?: string | null
  blessing?: string | null
  song_id?: string | null
}

/** supabase 风格 schema 类型 — 让 from("wall_lanterns") 的链式调用全带类型 */
export type WallDatabase = {
  public: {
    Tables: {
      wall_lanterns: {
        Row: WallLantern
        Insert: WallInsert
        Update: Partial<WallInsert>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/** 上云的一条灯（调用点从本机灯册记录构造） */
export type WallLanternInput = {
  colorId: string
  /** 表情 id（手绘为 custom:<id>） */
  faceId: string
  /** 表情图源 — dataURL（手绘）才随行内嵌，静态路径靠 face_id 解析 */
  faceSrc: string | null
  blessing: string
  songId: string
}

/** 手绘内嵌上限 — 与 face-embed 的 EMBED_MAX_CHARS 同值（DB CHECK 对齐） */
const FACE_DATA_MAX = 6000
const BLESSING_MAX = 80

/**
 * 匿名把一盏灯汇入灯墙。fire-and-forget：resolve false 时静默放弃。
 * 永不 throw — 点亮流程不因云失败中断。
 */
export async function pushToWall(input: WallLanternInput): Promise<boolean> {
  const cloud = getCloud()
  if (!cloud) return false
  try {
    const faceData =
      input.faceSrc && input.faceSrc.startsWith("data:") && input.faceSrc.length <= FACE_DATA_MAX
        ? input.faceSrc
        : null
    const { error } = await cloud.database
      .from("wall_lanterns")
      .insert({
        color_id: input.colorId.slice(0, 40),
        face_id: input.faceId ? input.faceId.slice(0, 80) : null,
        face_data: faceData,
        blessing: input.blessing ? input.blessing.slice(0, BLESSING_MAX) : null,
        song_id: input.songId ? input.songId.slice(0, 80) : null,
      })
      .select()
    return !error
  } catch {
    return false
  }
}

/** 灯墙列表 — 最新在前。失败返回 null（页面走空态/重试）。 */
export async function fetchWallLanterns(limit = 60): Promise<WallLantern[] | null> {
  const cloud = getCloud()
  if (!cloud) return null
  try {
    const { data, error } = await cloud.database
      .from("wall_lanterns")
      .select("id, color_id, face_id, face_data, blessing, song_id, lit_at")
      .order("lit_at", { ascending: false })
      .limit(limit)
    if (error) return null
    return (data ?? []) as WallLantern[]
  } catch {
    return null
  }
}

/** 全网点亮总数。失败返回 null（首页回退本机计数）。 */
export async function fetchWallCount(): Promise<number | null> {
  const cloud = getCloud()
  if (!cloud) return null
  try {
    const { count, error } = await cloud.database
      .from("wall_lanterns")
      .select("*", { count: "exact", head: true })
    if (error) return null
    return typeof count === "number" ? count : null
  } catch {
    return null
  }
}
