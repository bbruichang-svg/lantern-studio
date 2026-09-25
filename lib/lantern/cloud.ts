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
  client_id: string | null
}

type WallInsert = {
  color_id: string
  face_id?: string | null
  face_data?: string | null
  blessing?: string | null
  song_id?: string | null
  client_id?: string | null
}

/** visit_logs 插入投影 — 匿名访问日志（RLS 仅插入，前端无 SELECT 权限） */
export type VisitLogInsert = {
  uid: string
  event: string
  path?: string | null
  device?: string | null
  payload?: Record<string, string | number> | null
  client_t?: number | null
  app_version?: string | null
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
      visit_logs: {
        Row: VisitLogInsert & { id: number; created_at: string }
        Insert: VisitLogInsert
        Update: Partial<VisitLogInsert>
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
 * 本机访客标识 — 防刷节流用（非身份，无任何个人信息）。
 * localStorage 持久化 UUID；不可用时返回 null（该行不带 client_id，
 * DB 触发器对 NULL 放行 — 宁可漏放也不打扰正常访客）。
 */
const CLIENT_ID_KEY = "moon.wallClient.v1"

function getClientId(): string | null {
  if (typeof window === "undefined") return null
  try {
    let id = window.localStorage.getItem(CLIENT_ID_KEY)
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
      window.localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

/** 单访客每小时汇入上限 — 与 DB 触发器 wall_lanterns_rate_guard 同值 */
const RATE_LIMIT_PER_HOUR = 20

/**
 * 匿名把一盏灯汇入灯墙。fire-and-forget：resolve false 时静默放弃。
 * 永不 throw — 点亮流程不因云失败中断。
 */
export async function pushToWall(input: WallLanternInput): Promise<boolean> {
  const cloud = getCloud()
  if (!cloud) return false
  try {
    // 客户端节流：本机一小时内已达上限就不再发请求（DB 触发器兜底）
    const clientId = getClientId()
    if (clientId) {
      const hourAgo = new Date(Date.now() - 3600_000).toISOString()
      const { count, error } = await cloud.database
        .from("wall_lanterns")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .gt("lit_at", hourAgo)
      if (!error && typeof count === "number" && count >= RATE_LIMIT_PER_HOUR) return false
    }
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
        client_id: clientId,
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

/** 按 id 取一盏灯 — 灯墙「点亮看看」直达 release 用。失败返回 null。 */
export async function fetchWallLanternById(id: number): Promise<WallLantern | null> {
  const cloud = getCloud()
  if (!cloud) return null
  try {
    const { data, error } = await cloud.database
      .from("wall_lanterns")
      .select("id, color_id, face_id, face_data, blessing, song_id, lit_at")
      .eq("id", id)
      .maybeSingle()
    if (error) return null
    return (data as WallLantern) ?? null
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

/** 访问日志字段上限 — 与 DB 列宽/防刷触发器对齐 */
const VISIT_EVENT_MAX = 80
const VISIT_PATH_MAX = 120

/**
 * 匿名访问日志上报 — 前端 track() 的云端 sink（visit_logs 表）。
 * fire-and-forget：云失败完全静默，analytics 本地 localStorage 队列仍是兜底。
 * 注意：visit_logs 无 SELECT 策略（RLS 仅插入），insert 不能链 .select()，
 * 否则 return=representation 需要 SELECT 权限、必然 42501。聚合查询在管理端做。
 */
export async function pushVisitLog(record: {
  e: string
  p?: Record<string, string | number>
  t: number
  u: string
  d: string
  v: string
}): Promise<boolean> {
  const cloud = getCloud()
  if (!cloud) return false
  try {
    const { error } = await cloud.database.from("visit_logs").insert({
      uid: record.u.slice(0, 64),
      event: record.e.slice(0, VISIT_EVENT_MAX),
      path:
        typeof window !== "undefined" && window.location
          ? window.location.pathname.slice(0, VISIT_PATH_MAX)
          : null,
      device: record.d.slice(0, 4),
      payload: record.p ?? null,
      client_t: record.t,
      app_version: record.v.slice(0, 8),
    })
    return !error
  } catch {
    return false
  }
}
