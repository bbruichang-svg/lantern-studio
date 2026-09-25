/* Glow-ink check: three-tier luminance re-ink (ink / silver / light-hole).
   Part A (unit): feed a synthetic 3-ink disc through setFaceImage on
   /release, count pixels per tier in facePlanarCanvas.
   Part B (UI): draw with the silver + light swatches in FacePainter on /,
   save, light the lantern, confirm tiers survive on the face layer.
   Pass: all three tiers present + zero console errors. */
const { chromium } = require("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\治宁\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe"
const BASE = process.env.GLOW_BASE || "http://127.0.0.1:3000"
const LINE = { r: 232, g: 176, b: 75 } // #E8B04B test line colour
const SILVER = { r: 200, g: 205, b: 214 } // #C8CDD6
const NEAR = (a, b) => Math.abs(a - b) <= 2

async function main() {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text())
  })
  const log = (s) => console.log("[glow] " + s)
  let fail = false

  // ---- Part A: unit-level re-ink tier check on /release ----
  await page.goto(BASE + "/release/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(5000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("月色与你不期而遇")
  await page.getByRole("button", { name: "蓄力放灯" }).click()
  await page.waitForTimeout(1500)

  const tiers = await page.evaluate(async () => {
    const LINE = { r: 232, g: 176, b: 75 }
    const SILVER = { r: 200, g: 205, b: 214 }
    const t = window.__lanternDebug
    if (!t) return { error: "no __lanternDebug" }
    const c = document.createElement("canvas")
    c.width = 1024
    c.height = 1024
    const g = c.getContext("2d")
    g.lineCap = "round"
    const stroke = (y, col) => {
      g.strokeStyle = col
      g.lineWidth = 80
      g.beginPath()
      g.moveTo(150, y)
      g.lineTo(874, y)
      g.stroke()
    }
    stroke(256, "#111111") // ink tier
    stroke(512, "#C8CDD6") // silver tier
    stroke(768, "#FFFFFF") // light tier
    const dataUrl = c.toDataURL("image/png")
    await window.__ensureFace(dataUrl) // warm the face cache first
    t.setFaceImage(dataUrl, "#E8B04B", false)
    const px = t.facePlanarCanvas.getContext("2d").getImageData(0, 0, 1024, 1024).data
    const count = { ink: 0, silver: 0, light: 0 }
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 230) continue
      if (px[i] === 255 && px[i + 1] === 255 && px[i + 2] === 255) count.light++
      else if (px[i] === SILVER.r && px[i + 1] === SILVER.g && px[i + 2] === SILVER.b) count.silver++
      else if (px[i] === LINE.r && px[i + 1] === LINE.g && px[i + 2] === LINE.b) count.ink++
    }
    return count
  })
  if (tiers.error) {
    log("Part A FAIL: " + tiers.error)
    fail = true
  } else {
    log("Part A tiers: ink=" + tiers.ink + " silver=" + tiers.silver + " light=" + tiers.light)
    if (tiers.ink > 10000 && tiers.silver > 10000 && tiers.light > 10000) log("Part A PASS")
    else {
      log("Part A FAIL: some tier missing/weak")
      fail = true
    }
  }

  // ---- Part B: UI — draw with glow inks on /, light, verify face layer ----
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(5000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(1200)
  // make stage opens on the COLOR tab — switch to FACE to reach the draw entry
  await page.getByRole("button", { name: "FACE" }).click()
  await page.waitForTimeout(600)
  await page.getByRole("button", { name: "画一个表情" }).click()
  await page.waitForTimeout(600)

  const drawStroke = async () => {
    const box = await page.locator("canvas.touch-none").boundingBox()
    const cy = box.y + box.height / 2
    await page.mouse.move(box.x + box.width * 0.3, cy)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 0.7, cy, { steps: 8 })
    await page.mouse.up()
  }
  await page.getByRole("button", { name: "银墨 半透光" }).click()
  await drawStroke()
  await page.getByRole("button", { name: "透光笔 镂空" }).click()
  await drawStroke()
  await page.screenshot({ path: "D:\\Rui\\moon\\_glowink_painter.png" })
  await page.getByRole("button", { name: "画好了" }).click()
  await page.waitForTimeout(1500) // saved → face swapped → re-ink applied

  // saved hand-drawing is already on the lantern (re-inked) — verify tiers
  const uiTiers = await page.evaluate(() => {
    const SILVER = { r: 200, g: 205, b: 214 }
    const t = window.__lanternDebug
    if (!t) return { error: "no __lanternDebug" }
    const px = t.facePlanarCanvas.getContext("2d").getImageData(0, 0, 1024, 1024).data
    let silver = 0
    let light = 0
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 230) continue
      if (px[i] === 255 && px[i + 1] === 255 && px[i + 2] === 255) light++
      else if (px[i] === SILVER.r && px[i + 1] === SILVER.g && px[i + 2] === SILVER.b) silver++
    }
    return { silver, light }
  })
  if (uiTiers.error) {
    log("Part B FAIL: " + uiTiers.error)
    fail = true
  } else {
    log("Part B face-layer: silver=" + uiTiers.silver + " light=" + uiTiers.light)
    if (uiTiers.silver > 200 && uiTiers.light > 200) log("Part B PASS")
    else {
      log("Part B FAIL: glow tiers did not survive onto the face layer")
      fail = true
    }
  }

  // light it for the eyeball screenshot: 下一步 → 祝福 → 点亮 → hold to charge
  await page.getByRole("button", { name: "下一步：写祝福" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("银墨与光的约定")
  await page.getByRole("button", { name: "点亮这盏灯" }).click()
  await page.waitForTimeout(800)
  const canvas = page.locator("canvas").first()
  const cb = await canvas.boundingBox()
  if (cb) {
    await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(4000)
    await page.mouse.up()
  }
  await page.waitForTimeout(4000)
  await page.screenshot({ path: "D:\\Rui\\moon\\_glowink_lit.png" })

  log("errors=" + errors.length)
  errors.slice(0, 8).forEach((e) => console.log("  " + e))
  await browser.close()
  if (fail || errors.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error("FAIL: " + e.message)
  process.exit(1)
})
