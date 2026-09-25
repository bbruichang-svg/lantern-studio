/* 页脚折行验证：390x844 移动视口，量 footer 段落实际高度/宽度 + 截图 */
const path = require("path")
const { chromium } = require(
  process.env.PW_CORE ||
  "C:/Users/治宁/.workbuddy/binaries/node/workspace/node_modules/playwright-core",
)

const BASE = process.env.MOTION_BASE || "http://127.0.0.1:3000"
const OUT = process.env.OUT_DIR || "D:/Rui/moon"

;(async () => {
  const browser = await chromium.launch({
    executablePath:
      "C:/Users/治宁/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()) })

  await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 })
  await page.waitForTimeout(3500)

  const info = await page.evaluate(() => {
    const ps = [...document.querySelectorAll("p")]
    const el = ps.find((p) => (p.textContent || "").includes("Fan-made"))
    if (!el) return null
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      text: el.textContent.trim(),
      rect: { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) },
      lineHeight: cs.lineHeight,
      fontSize: cs.fontSize,
      lines: Math.round(r.height / parseFloat(cs.lineHeight || cs.fontSize)),
      viewportW: innerWidth,
    }
  })
  console.log(JSON.stringify(info, null, 2))

  // 截左下角区域看实际效果
  await page.screenshot({
    path: path.join(OUT, "_footer_mobile.png"),
    clip: { x: 0, y: 744, width: 390, height: 100 },
  })
  console.log("console errors:", errors.length ? errors.slice(0, 5) : "none")
  await browser.close()
})().catch((e) => { console.error("FATAL", e); process.exit(1) })
