/* Hand-drawn face end-to-end check: MAKE → FACE → draw → save → applied → persists */
const { chromium } = require("C:\\Users\\bbruichang\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\bbruichang\\AppData\\Local\\ms-playwright\\chromium-1244\\chrome-win64\\chrome.exe"
const BASE = "http://127.0.0.1:3002"
const OUT = "C:\\Users\\bbruichang"

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
  const log = (s) => console.log("[draw] " + s)

  // 1. enter MAKE
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(5000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(700)

  // 2. FACE tab → draw entry
  await page.getByRole("button", { name: "FACE" }).click()
  await page.waitForTimeout(400)
  await page.getByRole("button", { name: "画一个表情" }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: OUT + "\\draw_modal.png" })
  log("painter open ok")

  // 3. draw a simple face: two eyes + a smile
  const canvas = page.locator("canvas").last()
  const box = await canvas.boundingBox()
  if (!box) throw new Error("painter canvas not found")
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const r = box.width / 2
  const dot = async (dx, dy) => {
    await page.mouse.move(cx + dx * r, cy + dy * r)
    await page.mouse.down()
    await page.mouse.up()
  }
  await dot(-0.25, -0.2) // left eye
  await dot(0.25, -0.2) // right eye
  await page.mouse.move(cx - 0.3 * r, cy + 0.3 * r)
  await page.mouse.down()
  await page.mouse.move(cx, cy + 0.45 * r, { steps: 8 })
  await page.mouse.move(cx + 0.3 * r, cy + 0.3 * r, { steps: 8 })
  await page.mouse.up()
  await page.screenshot({ path: OUT + "\\draw_drawing.png" })
  log("strokes drawn ok")

  // 4. save → custom thumbnail appears in the strip
  await page.getByRole("button", { name: "画好了" }).click()
  await page.waitForTimeout(900)
  await page.screenshot({ path: OUT + "\\draw_applied.png" })
  const thumbs = await page.locator('img[src^="data:"]').count()
  const stored = await page.evaluate(() => !!localStorage.getItem("moon.customFace.v1"))
  log("custom thumbnail count=" + thumbs + " localStorage=" + stored)

  // 5. persistence — reload, walk back into FACE, thumbnail restored from localStorage
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForTimeout(4000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(600)
  await page.getByRole("button", { name: "FACE" }).click()
  await page.waitForTimeout(500)
  const thumbsAfter = await page.locator('img[src^="data:"]').count()
  log("after reload thumbnail count=" + thumbsAfter)

  // 6. studio unaffected (no draw entry in DTZ-only picker)
  await page.goto(BASE + "/studio", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(4000)
  const studioDrawBtns = await page.getByRole("button", { name: "画一个表情" }).count()
  log("studio draw buttons=" + studioDrawBtns)

  console.log("[draw] errors=" + errors.length)
  errors.slice(0, 10).forEach((e) => console.log("  " + e))
  await browser.close()
}

main().catch((e) => {
  console.error("[draw] FAILED: " + e.message)
  process.exit(1)
})
