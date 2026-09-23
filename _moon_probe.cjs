/* debug: read the moon probe at each late stage of /release */
const { chromium } = require("C:\\Users\\bbruichang\\.workbuddy\\binaries\\node\\workspace\\node_modules\\playwright-core")

const EXE = "C:\\Users\\bbruichang\\AppData\\Local\\ms-playwright\\chromium-1244\\chrome-win64\\chrome.exe"
const BASE = "http://127.0.0.1:3002"

async function main() {
  const browser = await chromium.launch({
    executablePath: EXE,
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on("pageerror", (e) => console.log("pageerror: " + e.message))
  await page.goto(BASE + "/release", { waitUntil: "domcontentloaded", timeout: 120000 })
  await page.waitForTimeout(6000)
  await page.getByRole("button", { name: "ENTER" }).click()
  await page.waitForTimeout(800)
  await page.locator("input[placeholder*='祝福']").fill("但愿人长久")
  await page.getByRole("button", { name: "蓄力放灯" }).click()
  await page.waitForTimeout(600)
  await page.locator('button:text-is("放灯")').click()
  // soar 4.2s → apex; hold 2s → dissolve 2.8s → memory
  await page.waitForTimeout(4800)
  console.log("apex: " + JSON.stringify(await page.evaluate(() => window.__moon)))
  await page.waitForTimeout(2600)
  console.log("dissolve-mid: " + JSON.stringify(await page.evaluate(() => window.__moon)))
  await page.waitForTimeout(2400)
  console.log("dissolve-end: " + JSON.stringify(await page.evaluate(() => window.__moon)))
  await page.waitForTimeout(2500)
  console.log("memory: " + JSON.stringify(await page.evaluate(() => window.__moon)))
  await browser.close()
}

main().catch((e) => {
  console.error("FAILED: " + e.message)
  process.exit(1)
})
