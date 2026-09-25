/**
 * _cascade_check.cjs — 编辑控件级联入场 冒烟
 * 用法: MOTION_BASE=http://127.0.0.1:3000 node _cascade_check.cjs [normal|reduced]
 * 验证 /studio/ 工具栏 cascade-rise: 中间帧 opacity<1，1.2s 后收敛为 1；
 * reduced 模式下 150ms 时 opacity 已是 1（无级联）。
 */
const { chromium } = require("C:/Users/治宁/.workbuddy/binaries/node/workspace/node_modules/playwright-core")

const BASE = process.env.MOTION_BASE || "http://127.0.0.1:3000"
const MODE = process.argv[2] === "reduced" ? "reduced" : "normal"

;(async () => {
  const browser = await chromium.launch({
    executablePath: "C:/Users/治宁/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    reducedMotion: MODE === "reduced" ? "reduce" : "no-preference",
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })

  await page.goto(`${BASE}/studio/`, { waitUntil: "load", timeout: 60000 })

  const grab = () =>
    page.evaluate(() => {
      const el = document.querySelector(".cascade-rise")
      if (!el) return null
      const cs = getComputedStyle(el)
      const a = el.getAnimations().find((x) => x.animationName === "cascade-rise")
      const prog = a && a.effect ? a.effect.getComputedTiming().progress : null
      return {
        opacity: +(+cs.opacity).toFixed(3),
        progress: prog == null ? null : +(+prog).toFixed(3),
        anim: cs.animationName,
      }
    })

  await page.waitForSelector(".cascade-rise", { timeout: 30000 })
  const samples = []
  for (const wait of MODE === "reduced" ? [150, 400] : [150, 300, 450, 600]) {
    await page.waitForTimeout(wait)
    samples.push(await grab())
  }
  const early = samples[0]
  await page.waitForTimeout(1400)
  const settled = await grab()

  // mid-cascade screenshot (normal mode only)
  if (MODE === "normal") {
    await page.reload({ waitUntil: "load" })
    await page.waitForSelector(".cascade-rise", { timeout: 30000 })
    await page.waitForTimeout(330)
    await page.screenshot({ path: "D:/Rui/moon/_cascade_mid.png" })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: "D:/Rui/moon/_cascade_end.png" })
  }

  console.log(JSON.stringify({ mode: MODE, samples, settled, errors: errors.filter((e) => !e.includes("RSC")).slice(0, 3) }, null, 2))
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
