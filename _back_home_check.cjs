/* Back-home exit check: memory/finished stages gain a "‹ 回到灯会" exit.
   Part 1: release ritual → memory → click 回到灯会 → lands on home landing.
   Part 2: home own-lamp flow → finished stillness → click 回到灯会 within
   the 3s auto-advance window → back on landing.
   Usage: BACK2_BASE=http://127.0.0.1:3000 node _back_home_check.cjs */
const { chromium } = require("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\治宁\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe"
const BASE = process.env.BACK2_BASE || "http://127.0.0.1:3000"

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
  let fail = false
  const check = (name, ok) => {
    console.log((ok ? "OK   " : "FAIL ") + name)
    if (!ok) fail = true
  }

  // ---- Part 1: release → memory → 回到灯会 → home landing ----
  await page.goto(BASE + "/release/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(5000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("灯会终有归途")
  await page.getByRole("button", { name: "蓄力放灯" }).click()
  await page.waitForTimeout(600)
  await page.locator('button:text-is("放灯")').click()
  // soft-render ~1.5x: memory text ≈ 13.5s after 放灯
  await page.waitForSelector("text=今晚，灯住进了树梢。", { timeout: 45000 })

  const backLink = page.locator('a:text-is("‹ 回到灯会")')
  check("release memory has 回到灯会 link", (await backLink.count()) === 1)
  check("release memory link href /", (await backLink.getAttribute("href")) === "/")
  await backLink.click()
  await page.waitForTimeout(1500)
  check("back on home landing (ENTER visible)", await page.getByRole("button", { name: "ENTER" }).isVisible())

  // ---- Part 2: home own lamp → finished → 回到灯会 within 3s window ----
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(1500)
  await page.getByRole("button", { name: "下一步：写祝福" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("归途亦是灯路")
  await page.getByRole("button", { name: "点亮这盏灯" }).click()
  // lighting 2.8s → finished stillness (auto-advances after 3s)
  await page.waitForSelector("text=今晚，灯亮了。", { timeout: 30000 })
  const backBtn = page.locator('button:text-is("‹ 回到灯会")')
  check("home finished has 回到灯会 button", (await backBtn.count()) === 1)
  await backBtn.click()
  await page.waitForTimeout(1200)
  const stillLanding = await page.getByRole("button", { name: "ENTER" }).isVisible()
  const escapedRitual = page.url().indexOf("/release") === -1
  check("finished 回到灯会 returns to landing (no auto-advance chase)", stillLanding && escapedRitual)

  const realErrors = errors.filter((e) => e.indexOf("favicon") === -1)
  check("zero console/page errors", realErrors.length === 0)
  if (realErrors.length) console.log(realErrors.slice(0, 5).join("\n"))

  await browser.close()
  console.log(fail ? "RESULT: FAIL" : "RESULT: ALL PASS")
  process.exit(fail ? 1 : 0)
}
main().catch((e) => {
  console.error("FATAL: " + e.message)
  process.exit(1)
})
