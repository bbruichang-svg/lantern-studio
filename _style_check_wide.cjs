/* Style-check: precise timing shots for hang / dissolve / memory / share */
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
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  const errors = []
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text())
  })
  const log = (s) => console.log("[style] " + s)

  // skip straight to charge with a pre-filled blessing
  await page.goto(BASE + "/release?from=make&color=juzhou&blessing=%E4%BD%86%E6%84%BF%E4%BA%BA%E9%95%BF%E4%B9%85", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  })
  await page.waitForTimeout(6000)
  await page.locator('button:text-is("放灯")').click()
  log("released")

  // hang: soar 4.2 + apex 2.0 → hang starts ~6.2s, swing settles ~10.7s
  await page.waitForTimeout(8200)
  await page.screenshot({ path: OUT + "\\styw_hang.png" })
  log("hang shot")

  // dissolve ~10.7-13.5
  await page.waitForTimeout(3600)
  await page.screenshot({ path: OUT + "\\styw_dissolve.png" })
  log("dissolve shot")

  // memory ~13.5+
  await page.waitForTimeout(3000)
  await page.screenshot({ path: OUT + "\\styw_memory.png" })
  const flew = await page.getByText("今晚，灯住进了树梢。").count()
  log("memory shot; headline=" + flew)

  // share card
  await page.getByText("分享这盏灯").click()
  await page.waitForTimeout(3000)
  await page.screenshot({ path: OUT + "\\styw_share.png" })
  log("share shot")

  // root route: lit finished should show resident moon — use shared-lamp-less
  // path: just load root and check unlit (regression: nothing broken)
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: OUT + "\\styw_root.png" })
  log("root shot")

  console.log("[style] errors=" + errors.length)
  errors.slice(0, 12).forEach((e) => console.log("  " + e))
  await browser.close()
}

main().catch((e) => {
  console.error("[style] FAILED: " + e.message)
  process.exit(1)
})
