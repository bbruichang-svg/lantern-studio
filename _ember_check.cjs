/* Ember check: light-dust steady-state density screenshot.
   Flow: /release → ENTER → blessing → 蓄力放灯 → 放灯 → wait for hang
   steady state → screenshot at +9s (motes ~21 alive at steady rate).
   Pass: zero console errors + screenshot saved for eyeballing. */
const { chromium } = require("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\治宁\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe"
const BASE = process.env.EMBER_BASE || "http://127.0.0.1:3001"
const OUT = "D:\\Rui\\moon\\_ember_steady.png"

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

  await page.goto(BASE + "/release/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(6000) // static export: canvas + texture warm-up
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("月色与你不期而遇")
  await page.getByRole("button", { name: "蓄力放灯" }).click()
  await page.waitForTimeout(600)
  await page.locator('button:text-is("放灯")').click()
  // soft-rendered headless runs ~1.5x: soar4.2+apex2 ≈ 9.3s, hang mid ≈ +11s
  await page.waitForTimeout(11000)
  await page.screenshot({ path: "D:\\Rui\\moon\\_ember_hang0.png" })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: "D:\\Rui\\moon\\_ember_steady.png" })
  await page.waitForSelector("text=今晚，灯住进了树梢。", { timeout: 40000 })
  console.log("screenshot saved: " + OUT)
  console.log("errors=" + errors.length)
  errors.slice(0, 8).forEach((e) => console.log("  " + e))
  await browser.close()
  if (errors.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error("FAIL: " + e.message)
  process.exit(1)
})
