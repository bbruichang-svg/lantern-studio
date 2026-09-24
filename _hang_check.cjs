const path = require("path")
const os = require("os")
const fs = require("fs")
const pw = require(path.join("C:\\Users\\治宁\\.workbuddy\\binaries\\node\\workspace\\node_modules", "playwright-core"))
const chromeDir = path.join(os.homedir(), ".agent-browser", "browsers")
const root = fs.readdirSync(chromeDir).find((d) => d.startsWith("chrome-"))

async function runFlow(viewport, tag) {
  const b = await pw.chromium.launch({
    executablePath: path.join(chromeDir, root, "chrome.exe"),
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const ctx = await b.newContext({ viewport })
  const p = await ctx.newPage()
  const errors = []
  const tracks = []
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
    if (m.type() === "info" && m.text().includes("[track]")) tracks.push(m.text())
  })
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message))
  await p.goto("http://127.0.0.1:3000/release", { waitUntil: "load", timeout: 120000 })
  await p.waitForLoadState("networkidle", { timeout: 30000 }).catch(() => {})
  await p.waitForTimeout(8000)

  // arrive → wish
  const enter = p.locator("button", { hasText: "ENTER" }).first()
  await enter.waitFor({ state: "visible", timeout: 20000 })
  await enter.click()
  await p.waitForTimeout(1500)

  // wish: pick a preset blessing, then 蓄力放灯
  await p.locator("button", { hasText: "但愿人长久" }).first().click().catch(async () => {
    // fall back to the first example button
    await p.locator("div.pointer-events-auto button").first().click()
  })
  await p.waitForTimeout(400)
  await p.locator("button", { hasText: "蓄力放灯" }).first().click()
  await p.waitForTimeout(1200)

  // charge: fallback release button → soar starts (t0)
  const t0 = Date.now()
  await p.locator("button", { hasText: "放灯" }).first().click()

  const at = async (ms) => {
    const wait = ms - (Date.now() - t0)
    if (wait > 0) await p.waitForTimeout(wait)
  }
  const probe = async () => {
    try {
      return await p.evaluate(() => window.__hang || null)
    } catch {
      return null
    }
  }

  // soar 4.2s → apex
  await at(4700)
  await p.screenshot({ path: `D:\\Rui\\moon\\hang_${tag}_1_apex.png` })

  // apex 2s → hang starts at 6.2; mid-flight ~7.3
  await at(7300)
  await p.screenshot({ path: `D:\\Rui\\moon\\hang_${tag}_2_flight.png` })
  const probeFlight = await probe()

  // swaying on the branch ~8.8 (1.8s flight + 0.8s sway)
  await at(8800)
  await p.screenshot({ path: `D:\\Rui\\moon\\hang_${tag}_3_sway.png` })
  const probeSway = await probe()
  const headline = await p
    .locator("p", { hasText: "今晚" })
    .first()
    .textContent()
    .catch(() => "")

  // hang ends 10.7 → dissolve mid ~11.8
  await at(11800)
  await p.screenshot({ path: `D:\\Rui\\moon\\hang_${tag}_4_dissolve.png` })

  // memory at ~13.5+
  await at(14500)
  await p.screenshot({ path: `D:\\Rui\\moon\\hang_${tag}_5_memory.png` })
  const memoryHeadline = await p
    .locator("p", { hasText: "今晚" })
    .first()
    .textContent()
    .catch(() => "")

  let cardShot = null
  if (tag === "desktop") {
    const shareBtn = p.locator("button", { hasText: "分享这盏灯" }).first()
    if (await shareBtn.isVisible().catch(() => false)) {
      await shareBtn.click()
      await p.waitForTimeout(4000)
      await p.screenshot({ path: `D:\\Rui\\moon\\hang_${tag}_6_share.png` })
      cardShot = "ok"
    }
  }

  console.log(`[${tag}] flight-probe:`, JSON.stringify(probeFlight))
  console.log(`[${tag}] sway-probe:`, JSON.stringify(probeSway))
  console.log(`[${tag}] hang-headline:`, headline && headline.trim())
  console.log(`[${tag}] memory-headline:`, memoryHeadline && memoryHeadline.trim())
  console.log(`[${tag}] share-card:`, cardShot)
  console.log(`[${tag}] tracks:`, tracks.join(" | "))
  console.log(`[${tag}] console-errors:`, errors.length ? errors.join(" || ") : "NONE")

  await b.close()
}

async function main() {
  await runFlow({ width: 1440, height: 900 }, "desktop")
  await runFlow({ width: 390, height: 844 }, "mobile")
  console.log("ALL_DONE")
}

main().catch((e) => {
  console.error("FATAL", e)
  process.exit(1)
})
