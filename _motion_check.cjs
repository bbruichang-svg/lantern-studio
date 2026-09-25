/* Motion check: /release timeline timing — normal vs reduced-motion.
   Usage: node _motion_check.cjs [normal|reduced]   (BASE via MOTION_BASE env)
   Pass criteria: charge→memory elapsed < limit AND zero console errors. */
const { chromium } = require("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\治宁\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe"
const BASE = process.env.MOTION_BASE || "http://127.0.0.1:3003"
const MODE = process.argv[2] === "reduced" ? "reduced" : "normal"
// Theory: normal = soar 4.2 + apex 2.0 + dissolve 2.8 = 9.0s; reduced = 4.2s.
// Headless SwiftShader runs rAF slow and the timelines clamp delta at 0.05s,
// so wall-clock runs long on BOTH modes (~1.5x) — generous absolute limits,
// the real signal is the normal-vs-reduced gap (expect ≥3s).
const LIMIT_MS = MODE === "reduced" ? 14000 : 22000

async function main() {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  if (MODE === "reduced") await page.emulateMedia({ reducedMotion: "reduce" })
  const errors = []
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text())
  })
  const log = (s) => console.log("[" + MODE + "] " + s)

  await page.goto(BASE + "/release/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(5000) // static export: canvas + texture warm-up
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("但愿人长久，千里共婵娟")
  await page.getByRole("button", { name: "蓄力放灯" }).click()
  await page.waitForTimeout(600)

  const t0 = Date.now()
  await page.locator('button:text-is("放灯")').click()
  await page.waitForSelector("text=今晚，灯住进了树梢。", { timeout: 40000 })
  const elapsed = Date.now() - t0
  log("charge→memory elapsed=" + elapsed + "ms (limit " + LIMIT_MS + "ms)")
  const timingOk = elapsed < LIMIT_MS
  log("timing " + (timingOk ? "OK" : "FAIL"))

  await page.screenshot({ path: "D:\\Rui\\moon\\_motion_" + MODE + "_memory.png" })

  // share card still works in both modes
  await page.getByText("分享这盏灯").click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: "D:\\Rui\\moon\\_motion_" + MODE + "_share.png" })
  log("share ok")

  log("errors=" + errors.length)
  errors.slice(0, 8).forEach((e) => console.log("  " + e))
  await browser.close()
  if (!timingOk || errors.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error("[" + MODE + "] FAILED: " + e.message)
  process.exit(1)
})
