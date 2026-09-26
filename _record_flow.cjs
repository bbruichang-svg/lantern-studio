/* Record the full lantern flow as a video against the live site.
 * / landing → make → blessing → lit → finished → /release
 * arrive → wish → charge → soar → apex → hang → dissolve → memory → share
 */
const { chromium } = require("C:\\Users\\bbruichang\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\bbruichang\\AppData\\Local\\ms-playwright\\chromium-1244\\chrome-win64\\chrome.exe"
const BASE = "https://moonlantern.app.workbuddy.host"
const VIDEO = "C:\\Users\\bbruichang\\moon_flow_video"

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  })
  const context = await browser.newContext({
    // 2x portrait viewport (same aspect as 390×844). The sm:640 breakpoint
    // only bumps the landing h1 one font step and some padding — no layout
    // reflow — so the portrait composition holds at 780×1688.
    viewport: { width: 780, height: 1688 },
    recordVideo: { dir: VIDEO, size: { width: 780, height: 1688 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text())
  })
  const log = (s) => console.log("[rec] " + s)

  // 1. landing
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 120000 })
  await wait(5000)
  await page.getByRole("button", { name: "ENTER" }).click()
  log("landing ENTER")

  // 2. make — show the default lantern, then move on
  await wait(4000)
  await page.locator('[aria-label="下一步：写祝福"]').click()
  log("make → blessing")

  // 3. blessing
  await wait(2000)
  const input = page.locator("input[placeholder*='祝福']").first()
  await input.fill("但愿人长久，千里共婵娟")
  await wait(1800)
  await page.getByRole("button", { name: "点亮这盏灯" }).click()
  log("lit")

  // 4. finished → auto-advance into /release with ?from=make&... — that
  // query lands DIRECTLY in the pre-filled charge stage (arrive/wish skipped)
  await page.waitForURL("**/release**", { timeout: 30000 })
  log("auto-entered /release (charge, pre-filled)")
  await wait(7000)

  // 5. charge → release. Prefer a long-press on the lantern (the designed
  // gesture); fall back to the release button if the hold does not start
  // the flight.
  await wait(2000)
  const canvas = page.locator("canvas").first()
  const box = await canvas.boundingBox()
  let released = false
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45)
    await page.mouse.down()
    await wait(1200)
    await page.mouse.up()
    released = true
    log("long-press release attempted")
  }
  await wait(2500)
  const fallback = page.locator('button:text-is("放灯")')
  if ((await fallback.count()) > 0 && (await fallback.isVisible().catch(() => false))) {
    // still in charge stage → the hold did not trigger; click the fallback
    await fallback.click()
    log("fallback button release")
  }
  if (!released) log("WARN: no release interaction happened")

  // 7. pure timeline: soar 4.2 → apex 2 → hang ~4.5 → dissolve 2.8 → memory
  await wait(9000)
  log("hang window")
  await wait(7000)
  log("dissolve/memory window")

  // 8. memory → share
  const share = page.getByText("分享这盏灯")
  await share.waitFor({ timeout: 30000 })
  await wait(2000)
  await share.click()
  await wait(4500)
  log("share card shown")

  await context.close() // flushes the video file
  const v = await page.video().path()
  console.log("[rec] video=" + v)
  console.log("[rec] errors=" + errors.length)
  errors.slice(0, 12).forEach((e) => console.log("  " + e))
  await browser.close()
}

main().catch((e) => {
  console.error("[rec] FAILED: " + e.message)
  process.exit(1)
})
