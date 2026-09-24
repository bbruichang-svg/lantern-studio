const path = require("path")
const os = require("os")
const fs = require("fs")
const pw = require(path.join("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules", "playwright-core"))
const chromeDir = path.join(os.homedir(), ".agent-browser", "browsers")
const root = fs.readdirSync(chromeDir).find((d) => d.startsWith("chrome-"))

async function runFlow(viewport, tag) {
  const b = await pw.chromium.launch({
    executablePath: path.join(chromeDir, root, "chrome.exe"),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const ctx = await b.newContext({ viewport })
  const p = await ctx.newPage()
  const errors = []
  const tracks = []
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
    if (m.type() === "info" && m.text().includes("[track]")) tracks.push(m.text())
  })
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  const out = { tag, badge: {}, tracks: {}, url: "", chargeHint: false, directChargeHint: false, errors: [] }

  // ---- Phase A: make → light → finished stillness → auto /release?from=make ----
  await p.goto("http://127.0.0.1:3000/", { waitUntil: "load", timeout: 180000 })
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(5000)

  await p.locator("button", { hasText: "ENTER" }).first().click()
  await p.waitForTimeout(1500)

  // FACE badge visible on first visit
  const badge = p.locator("button span", { hasText: "新" }).first()
  out.badge.firstVisit = await badge.isVisible().catch(() => false)

  // open FACE tab → badge disappears
  await p.locator("button", { hasText: "FACE" }).first().click()
  await p.waitForTimeout(500)
  out.badge.afterOpen = await badge.isVisible().catch(() => false)
  await p.screenshot({ path: `D:\\Rui\\moon\\entry_${tag}_1_face.png` })

  // reload → badge stays gone
  await p.reload({ waitUntil: "load" })
  await p.waitForTimeout(5000)
  await p.locator("button", { hasText: "ENTER" }).first().click()
  await p.waitForTimeout(1200)
  out.badge.afterReload = await p
    .locator("button span", { hasText: "新" })
    .first()
    .isVisible()
    .catch(() => false)

  // wick CTA → blessing; write, then light
  await p.locator("button[aria-label='下一步：写祝福']").first().click()
  await p.waitForTimeout(1500)
  await p.locator("input").first().fill("月圆人团圆")
  await p.screenshot({ path: `D:\\Rui\\moon\\entry_${tag}_2_blessing.png` })
  await p.locator("button", { hasText: "点亮这盏灯" }).first().click()
  // lighting 2.8s → finished stillness 3s → auto router.replace into /release
  await p.waitForURL("**/release/**", { timeout: 12000 })
  out.url = p.url()
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(5000)

  // no second arrival gate and no wish page — blessing pre-filled during the
  // make ritual, the flow lands straight on charge (hold the lantern)
  out.chargeHint = await p
    .locator("text=按住灯笼，蓄满放灯")
    .first()
    .isVisible()
    .catch(() => false)
  await p.screenshot({ path: `D:\\Rui\\moon\\entry_${tag}_3_charge.png` })

  out.tracks.goRelease = tracks.some((t) => t.includes("go_release_clicked"))
  out.tracks.lightAutoRelease = tracks.some((t) => t.includes("light_auto_release"))
  out.tracks.releasePrefilled = tracks.some((t) => t.includes("release_prefilled"))
  out.tracks.releaseStart = tracks.some((t) => t.includes("release_start"))
  out.tracks.releaseChargeEntered = tracks.some((t) => t.includes("release_charge_entered"))
  out.tracks.songClicked = tracks.some((t) => t.includes("song_clicked"))

  // ---- Phase B: direct URL tolerance — lands straight on charge, no ENTER gate ----
  const p2 = await ctx.newPage()
  const errors2 = []
  p2.on("console", (m) => {
    if (m.type() === "error") errors2.push(m.text())
  })
  p2.on("pageerror", (e) => errors2.push("pageerror: " + e.message))
  await p2.goto(
    "http://127.0.0.1:3000/release?from=make&color=suzhou&face=custom&blessing=%E6%B5%B7%E4%B8%8A%E7%94%9F%E6%98%8E%E6%9C%88",
    { waitUntil: "load", timeout: 180000 },
  )
  await p2.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {})
  await p2.waitForTimeout(6000)
  out.directChargeHint = await p2
    .locator("text=按住灯笼，蓄满放灯")
    .first()
    .isVisible()
    .catch(() => false)
  out.directUrlClean = !p2.url().includes("from=make")
  await p2.screenshot({ path: `D:\\Rui\\moon\\entry_${tag}_4_direct.png` })
  out.errors = errors.concat(errors2)

  await b.close()
  return out
}

;(async () => {
  const r = []
  r.push(await runFlow({ width: 1440, height: 900 }, "desktop"))
  r.push(await runFlow({ width: 390, height: 844 }, "mobile"))
  fs.writeFileSync("D:\\Rui\\moon\\_entry_result.json", JSON.stringify(r, null, 2))
  console.log("DONE")
})().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
