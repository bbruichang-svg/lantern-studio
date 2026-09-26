/* P1/P2 verification: /my gallery, delete flow, custom:<id> link restore,
 * embedded face-data (fd) link restore */
const { chromium } = require("C:\\Users\\bbruichang\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\bbruichang\\AppData\\Local\\ms-playwright\\chromium-1244\\chrome-win64\\chrome.exe"
const BASE = "http://127.0.0.1:3002"

// 1×1 red dot PNG — enough to prove the img pipeline
const DOT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
const FACE_ID = "c1727000000000"

async function main() {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  })
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text())
  })
  const log = (s) => console.log("[p12] " + s)

  // seed the ledger BEFORE any page script runs
  await context.addInitScript(([dot, fid]) => {
    window.localStorage.setItem("moon.customFaces.v2", JSON.stringify([
      { id: fid, src: dot, colorId: "chengdu", savedAt: 1727000000000 },
    ]))
    window.localStorage.setItem("moon.lanterns.v1", JSON.stringify([
      { no: 2, colorId: "xuan", faceId: "xuan", blessing: "第二盏", songId: "lifegoeson", litAt: 1727000100000 },
      { no: 1, colorId: "chengdu", faceId: "custom:" + fid, blessing: "测试祝福", songId: "yueqiushangderen", litAt: 1727000000000 },
    ]))
  }, [DOT, FACE_ID])

  // ---- 1. /my gallery ----
  await page.goto(BASE + "/my", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(2500)
  const cards = await page.locator("li").count()
  const no1 = await page.getByText("No.00001").count()
  const blessing = await page.getByText("「测试祝福」").count()
  log("gallery cards=" + cards + " no1=" + no1 + " blessing=" + blessing)

  // ---- 2. two-tap delete of lamp #2 ----
  await page.getByRole("button", { name: "删除" }).first().click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: "确认删除？" }).click()
  await page.waitForTimeout(600)
  const after = await page.locator("li").count()
  log("after delete cards=" + after)

  // ---- 3. 点亮看看 → /?l= restore with custom:<id> ----
  await page.getByRole("button", { name: "点亮看看" }).click()
  await page.waitForURL("**/?l=**", { timeout: 20000 })
  await page.waitForTimeout(5000)
  const lit = await page.getByText("今晚，灯亮了。").count()
  log("custom:<id> restore finished-text=" + lit)

  // ---- 4. fd embedded-face link (fresh storage — proves it rides the URL) ----
  const url2 = await page.evaluate(([dot, fid]) => {
    const p = {
      c: "chengdu",
      f: "custom:" + fid,
      b: "但愿人长久",
      s: "yueqiushangderen",
      n: 1,
      fd: dot,
    }
    const json = JSON.stringify(p)
    const body = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
    let h = 5381
    for (let i = 0; i < body.length; i++) h = ((h << 5) + h + body.charCodeAt(i)) | 0
    return "/?l=" + body + "." + (h >>> 0).toString(36)
  }, [DOT, FACE_ID])
  const fresh = await context.newPage()
  fresh.on("pageerror", (e) => errors.push("fresh pageerror: " + e.message))
  await fresh.goto(BASE + url2, { waitUntil: "domcontentloaded", timeout: 60000 })
  await fresh.waitForTimeout(5000)
  const lit2 = await fresh.getByText("今晚，灯亮了。").count()
  const song = await fresh.getByText("月球上的人").count()
  log("fd-link restore finished-text=" + lit2 + " song=" + song)

  console.log("[p12] errors=" + errors.length)
  errors.slice(0, 10).forEach((e) => console.log("  " + e))
  await browser.close()
}

main().catch((e) => {
  console.error("[p12] FAILED: " + e.message)
  process.exit(1)
})
