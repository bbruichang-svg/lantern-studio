/* 表情 crossfade 验证：同脸换墨色（黑→红），检查快照/进度状态机 + 中间帧 */
const { chromium } = require(
  "C:/Users/治宁/.workbuddy/binaries/node/workspace/node_modules/playwright-core",
)

const BASE = process.env.MOTION_BASE || "http://127.0.0.1:3000"

;(async () => {
  const browser = await chromium.launch({
    executablePath:
      "C:/Users/治宁/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))

  await page.goto(BASE + "/", { waitUntil: "load", timeout: 60000 })
  await page.waitForFunction(() => !!window.__lanternDebug, { timeout: 30000 })
  await page.waitForTimeout(1500)

  const result = await page.evaluate(async () => {
    const t = window.__lanternDebug
    // 找一张已缓存的预设脸（加载过的资源必然在 getCachedFace 缓存里）
    const src = performance
      .getEntriesByType("resource")
      .map((r) => r.name)
      .find((u) => u.includes("/faces/"))
    if (!src) return { fail: "no cached face resource" }
    // 缓存键是相对路径（/faces/xxx.png），必须与 ensureFace 传入一致
    const faceSrc = new URL(src).pathname

    const inkPixels = (canvas) => {
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let red = 0
      let dark = 0
      for (let i = 0; i < d.length; i += 16) {
        if (d[i + 3] > 100) {
          if (d[i] > 150 && d[i + 1] < 90) red++
          if (d[i] < 60 && d[i + 1] < 60 && d[i + 2] < 60) dark++
        }
      }
      return { red, dark }
    }

    // 1) 直切黑墨（fade=false，基线）
    t.setFaceImage(faceSrc, "#111111", false)
    const baseline = { fadeT: t.fadeT, ...inkPixels(t.faceCanvas) }

    // 2) crossfade 红墨（fade=true）
    t.setFaceImage(faceSrc, "#FF0000", true)
    const started = t.fadeT
    const prev = inkPixels(t.facePrevCanvas) // 应含黑墨快照
    const cur = inkPixels(t.faceCanvas) // 应含红墨
    return { baseline, started, prev, cur }
  })
  console.log("state:", JSON.stringify(result))

  // 中间帧截图（fade 应进行中）
  await page.waitForTimeout(180)
  await page.screenshot({ path: "D:/Rui/moon/_fade_mid.png" })

  // 3) 等 fade 结束
  await page.waitForTimeout(900)
  const after = await page.evaluate(() => window.__lanternDebug.fadeT)
  console.log("fadeT after 1.08s:", after, "(应为 1)")
  await page.screenshot({ path: "D:/Rui/moon/_fade_done.png" })
  console.log("pageerrors:", errors.length ? errors.slice(0, 3) : "none")
  await browser.close()
})().catch((e) => { console.error("FATAL", e); process.exit(1) })
