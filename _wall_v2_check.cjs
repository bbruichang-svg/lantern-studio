/**
 * _wall_v2_check.cjs — 灯墙 v2 运行时验证
 * A. 限速触发器：同 client_id 连插 21 盏，第 21 盏应被 DB 触发器拒绝
 * B. client_id 随行上送 + 单行拉取（点亮看看数据源）
 * 用法: node _wall_v2_check.cjs   （验证数据最后由 MCP SQL 清理）
 */
const { createWorkBuddyCloud } = require("@tencent-ai/workbuddy-cloud-sdk")

const cloud = createWorkBuddyCloud({
  endpoint: "https://moonlantern.app.workbuddy.host",
  publishableKey: "wbpk_czZUfWVM4PB9PfC3Hc8ufp_sbYxBmPvqE21apyRvwgj44VQ9mz5rxZc",
})

const RL_CLIENT = "rl-check-20260925"

async function insertOne(clientId) {
  const { data, error } = await cloud.database
    .from("wall_lanterns")
    .insert({
      color_id: "chengdu",
      face_id: "dtz-cd",
      blessing: "验证灯·稍后删除",
      song_id: "",
      client_id: clientId,
    })
    .select()
  return { data, error }
}

;(async () => {
  // A. 限速：前 20 盏应成功，第 21 盏应被触发器拒绝
  let ok = 0
  let firstErr = null
  for (let i = 0; i < 21; i++) {
    const { data, error } = await insertOne(RL_CLIENT)
    if (!error) ok++
    else if (!firstErr) firstErr = String(error.message || error).slice(0, 160)
  }
  console.log(`A. rate-limit: ok=${ok}/21, firstError=${firstErr ?? "none"}`)

  // B. client_id 落库 + 单行拉取
  const q = await cloud.database
    .from("wall_lanterns")
    .select("id, color_id, blessing, client_id")
    .eq("client_id", RL_CLIENT)
    .limit(1)
    .maybeSingle()
  console.log("B1. client_id persisted:", JSON.stringify(q.data))
  if (q.data) {
    const one = await cloud.database
      .from("wall_lanterns")
      .select("id, color_id, face_id, face_data, blessing, song_id, lit_at, client_id")
      .eq("id", q.data.id)
      .maybeSingle()
    console.log("B2. fetchById:", JSON.stringify(one.data))
  }
})().catch((e) => {
  console.error("FATAL", e && e.message)
  process.exit(1)
})
