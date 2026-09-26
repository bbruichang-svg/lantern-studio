/**
 * 线上首屏截图 — 验证新版 landing 实际渲染效果。
 * playwright-core + 本地 chromium（项目未装 playwright 完整包）。
 */
const { chromium } = require("playwright-core")

const CHROME =
  "C:\\Users\\bbruichang\\AppData\\Local\\ms-playwright\\chromium-1244\\chrome-win64\\chrome.exe"
const OUT = "G:\\Rui\\moon\\share-cards\\_landing_online.png"

;(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await page.goto("https://moonlantern.app.workbuddy.host/", {
    waitUntil: "networkidle",
    timeout: 45000,
  })
  await page.waitForTimeout(3500)
  await page.screenshot({ path: OUT })
  await browser.close()
  console.log("SHOT_OK", OUT)
})().catch((e) => {
  console.error("ERR", e.message)
  process.exit(1)
})
