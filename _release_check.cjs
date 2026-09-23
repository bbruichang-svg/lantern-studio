/* Release-route end-to-end check: arrive → wish → charge → soar → apex → memory → share */
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

  const log = (s) => console.log("[check] " + s)

  // 1. arrive
  await page.goto(BASE + "/release", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(6000) // G-drive first compile + canvas warm-up
  await page.screenshot({ path: OUT + "\\rel_arrive.png" })
  log("arrive screenshot ok")

  // 2. wish
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  const input = page.locator("input[placeholder*='祝福']")
  await input.fill("但愿人长久，千里共婵娟")
  await page.screenshot({ path: OUT + "\\rel_wish.png" })
  await page.getByRole("button", { name: "蓄力放灯" }).click()
  await page.waitForTimeout(600)
  await page.screenshot({ path: OUT + "\\rel_charge.png" })
  log("wish/charge ok")

  // 3. release → soar (fallback button) — capture mid-flight
  await page.locator('button:text-is("放灯")').click()
  await page.waitForTimeout(1600)
  await page.screenshot({ path: OUT + "\\rel_soar.png" })
  log("soar mid-flight ok")

  // 4. apex → dissolve (化月) → memory
  await page.waitForTimeout(2600) // soar finishes at 4.2s after release
  await page.screenshot({ path: OUT + "\\rel_apex.png" })
  await page.waitForTimeout(2000) // apex hold → dissolve starts
  await page.waitForTimeout(1400)
  await page.screenshot({ path: OUT + "\\rel_dissolve.png" })
  await page.waitForTimeout(2000) // dissolve (2.8s) completes → memory
  await page.screenshot({ path: OUT + "\\rel_memory.png" })
  const flew = await page.getByText("今晚，灯飞了。").count()
  const blessing = await page.getByText("但愿人长久，千里共婵娟").count()
  log("memory: flew-text=" + flew + " blessing=" + blessing)

  // 5. share card
  await page.getByText("分享这盏灯").click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: OUT + "\\rel_share.png" })
  log("share ok")

  // 6. root MVP still intact
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: OUT + "\\rel_root.png" })
  log("root ok")

  console.log("[check] errors=" + errors.length)
  errors.slice(0, 12).forEach((e) => console.log("  " + e))
  await browser.close()
}

main().catch((e) => {
  console.error("[check] FAILED: " + e.message)
  process.exit(1)
})
