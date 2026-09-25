/**
 * _wall_relight_check.cjs — 灯墙「点亮看看」全链验证
 * /wall/ → 卡片有点亮看看 → 点击 → /release 落在 charge（蓄力放灯）
 * 且祝福语预填为该行 blessing；URL 参数已被 replaceState 清理。
 */
const { chromium } = require("C:/Users/治宁/.workbuddy/binaries/node/workspace/node_modules/playwright-core")

const BASE = process.env.MOTION_BASE || "http://127.0.0.1:3000"
const WANT_BLESSING = process.env.WANT_BLESSING || "验证灯·稍后删除"

;(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/治宁/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })

  await page.goto(`${BASE}/wall/`, { waitUntil: "load", timeout: 60000 })
  await page.waitForTimeout(3500) // cloud fetch

  const link = page.locator('a[href*="from=wall"]').first()
  const linkCount = await page.locator('a[href*="from=wall"]').count()
  if (linkCount === 0) {
    console.log(JSON.stringify({ fail: "no 点亮看看 links on /wall/" }))
    await browser.close()
    process.exit(1)
  }
  await link.click()
  await page.waitForTimeout(5000) // client nav + cloud fetch + charge UI

  const result = await page.evaluate((want) => {
    const body = document.body.innerText || ""
    return {
      url: window.location.pathname + window.location.search,
      chargeUi: body.includes("蓄力放灯") || body.includes("按住灯笼"),
    }
  }, WANT_BLESSING)

  // charge 阶段无输入框 — 走「改祝福」回 wish 检查受控 input 的值
  let blessingPrefilled = false
  if (result.chargeUi) {
    await page.locator('button:has-text("改祝福")').click()
    await page.waitForTimeout(600)
    blessingPrefilled = await page.evaluate(
      (want) => document.querySelector("input[value]")?.value === want,
      WANT_BLESSING,
    )
  }

  console.log(JSON.stringify({ linkCount, ...result, blessingPrefilled, errors: errors.filter((e) => !e.includes("RSC")).slice(0, 3) }, null, 2))
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
