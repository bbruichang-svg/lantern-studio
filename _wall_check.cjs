/* 灯墙运行时验证：dev /wall/ 加载状态 + 首页点亮链路上云（简版：直接观察 wall 页网络结果） */
const { chromium } = require(
  "C:/Users/治宁/.workbuddy/binaries/node/workspace/node_modules/playwright-core",
)

const BASE = process.env.MOTION_BASE || "http://127.0.0.1:3000"

;(async () => {
  const browser = await chromium.launch({
    executablePath:
      "C:/Users/治宁/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const net = []
  page.on("response", (r) => {
    if (r.url().includes("/.cloud/")) net.push(`${r.status()} ${r.url()}`)
  })
  page.on("console", (m) => {
    if (m.type() === "error") console.log("console err:", m.text().slice(0, 200))
  })

  await page.goto(BASE + "/wall/", { waitUntil: "load", timeout: 60000 })
  await page.waitForTimeout(6000)

  const state = await page.evaluate(() => {
    const body = document.body.innerText
    return {
      hasEmpty: body.includes("灯墙还空着"),
      hasFail: body.includes("灯墙暂时够不到"),
      hasLoading: body.includes("正在仰望"),
      hasCards: body.includes("分钟前") || body.includes("小时前") || body.includes("刚刚"),
      countLine: (body.match(/共 \d+ 盏/) || [null])[0],
    }
  })
  console.log("wall state:", JSON.stringify(state))
  console.log("cloud requests:", net.length ? net : "none")
  await page.screenshot({ path: "D:/Rui/moon/_wall_check.png", fullPage: false })
  await browser.close()
})().catch((e) => { console.error("FATAL", e); process.exit(1) })
