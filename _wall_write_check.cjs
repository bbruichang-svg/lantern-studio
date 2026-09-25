/* 匿名插入验证：与应用同款初始化 → insert → select 回读 → delete 清理 */
const { createWorkBuddyCloud } = require("@tencent-ai/workbuddy-cloud-sdk")

const cloud = createWorkBuddyCloud({
  endpoint: "https://moonlantern.app.workbuddy.host",
  publishableKey: "wbpk_czZUfWVM4PB9PfC3Hc8ufp_sbYxBmPvqE21apyRvwgj44VQ9mz5rxZc",
})

;(async () => {
  // 1. anon insert（RLS：wall_lanterns_insert_anon WITH CHECK (true)）
  const ins = await cloud.database
    .from("wall_lanterns")
    .insert({ color_id: "chengdu", face_id: "dtz-cd", blessing: "验证灯·稍后删除", song_id: "" })
    .select()
  if (ins.error) {
    console.log("INSERT error:", JSON.stringify(ins.error).slice(0, 300))
    process.exit(1)
  }
  const row = ins.data?.[0]
  console.log("INSERT ok id =", row && row.id)

  // 2. select 回读
  const sel = await cloud.database
    .from("wall_lanterns")
    .select("id, color_id, blessing")
    .eq("id", row.id)
    .maybeSingle()
  console.log("SELECT back:", JSON.stringify(sel.data))

  // 3. 无 RLS 删除通道 —— anon 无 DELETE 权限，预期失败（这正是安全设计）
  const del = await cloud.database.from("wall_lanterns").delete().eq("id", row.id).select()
  console.log("anon DELETE result:", del.error ? `blocked(${String(del.error.code || del.error.message).slice(0, 60)})` : `removed ${del.data.length}`)
})().catch((e) => {
  console.error("FATAL", e && e.message)
  process.exit(1)
})
