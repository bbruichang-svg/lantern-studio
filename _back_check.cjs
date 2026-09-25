/* Back-button check: every stage that should offer a return does, and the
   buttons actually navigate.
   - / make: ‹返回 → landing · blessing: ‹返回 → make
   - /release arrive: ‹返回 (href /) · ?from=wall → href /wall
   - /studio: ‹返回 · /wall + /my: ‹灯会 (pre-existing)
   Pass: all checks ok + zero console errors. */
const { chromium } = require("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\治宁\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe"
const BASE = process.env.BACK_BASE || "http://127.0.0.1:3000"

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
  const log = (s) => console.log("[back] " + s)
  let fail = false
  const check = (name, ok) => {
    log(name + ": " + (ok ? "OK" : "FAIL"))
    if (!ok) fail = true
  }

  // home: make → landing
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(5000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(1000)
  const makeBack = page.getByRole("button", { name: "‹ 返回" })
  check("home make has back", (await makeBack.count()) === 1)
  await makeBack.click()
  await page.waitForTimeout(600)
  check("make back -> landing", (await page.getByText("点一盏灯").count()) > 0)

  // home: blessing → make
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  await page.getByRole("button", { name: "下一步：写祝福" }).click()
  await page.waitForTimeout(600)
  const blessBack = page.getByRole("button", { name: "‹ 返回" })
  check("home blessing has back", (await blessBack.count()) === 1)
  await blessBack.click()
  await page.waitForTimeout(600)
  check("blessing back -> make", (await page.getByRole("button", { name: "FACE" }).count()) === 1)
  check("old bottom back gone", (await page.getByText("返回修改灯笼").count()) === 0)

  // release arrive + wall origin
  await page.goto(BASE + "/release/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(3000)
  const relBack = page.locator('a:text-is("‹ 返回")')
  check("release arrive has back", (await relBack.count()) === 1)
  check("release default target /", (await relBack.getAttribute("href")) === "/")
  await page.goto(BASE + "/release/?from=wall&id=999999", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(2000)
  const relBack2 = page.locator('a:text-is("‹ 返回")')
  check("release ?from=wall target /wall/", (await relBack2.getAttribute("href")) === "/wall/")

  // studio + wall + my
  await page.goto(BASE + "/studio/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(2000)
  check("studio has back", (await page.locator('a:text-is("‹ 返回")').count()) === 1)
  await page.goto(BASE + "/wall/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(1500)
  check("wall has lamp-fest link", (await page.locator('a:text-is("‹ 灯会")').count()) === 1)
  await page.goto(BASE + "/my/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(1500)
  check("my has lamp-fest link", (await page.locator('a:text-is("‹ 灯会")').count()) === 1)

  log("errors=" + errors.length)
  errors.slice(0, 8).forEach((e) => console.log("  " + e))
  await browser.close()
  if (fail || errors.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error("FAIL: " + e.message)
  process.exit(1)
})
