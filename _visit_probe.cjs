/**
 * 访问日志端到端探针 — 无头访问线上首页，等 page_view 云端上报落库。
 * 用后即删或留在项目根（_ 前缀已被 eslint globalIgnores 覆盖）。
 */
const { chromium } = require("playwright-core")

const CHROME =
  "C:\\Users\\bbruichang\\AppData\\Local\\ms-playwright\\chromium-1244\\chrome-win64\\chrome.exe"

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on("console", (m) => {
    const t = m.text()
    if (t.includes("[track]")) console.log("PAGE_TRACK:", t.slice(0, 120))
  })
  await page.goto("https://moonlantern.app.workbuddy.host/", {
    waitUntil: "networkidle",
    timeout: 30000,
  })
  // 等 track() 的 fire-and-forget 上报发出
  await page.waitForTimeout(4000)
  await browser.close()
  console.log("PROBE_DONE")
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})
