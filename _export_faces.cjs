/**
 * Export one share card per face preset (28 designs) as PNG.
 *
 * Route: /release?from=make&color&face&blessing&song → charge → hold the
 * lantern → soar/apex/hang/dissolve → memory → 分享这盏灯 → the composed
 * 1080×1350 card. Each card gets a DIFFERENT blessing; songs come from the
 * 16-song moon pool (cards 17-28 reuse lyrics — the pool is only 16 deep).
 */
const fs = require("fs")
const path = require("path")
const { chromium } = require("C:/Users/bbruichang/.workbuddy/binaries/node/workspace/node_modules/playwright-core")

const BASE = "http://127.0.0.1:3002"
const OUT = "G:/Rui/moon/share-cards"
const CHROME =
  "C:/Users/bbruichang/AppData/Local/ms-playwright/chromium-1244/chrome-win64/chrome.exe"

// 27 city faces + 苏州·惊讶 — mirrors ALL_FACES in lib/lantern/colors.ts
const FACES = [
  ["chengdu", "成都"],
  ["guangzhou", "广州"],
  ["xiamen", "厦门"],
  ["xian", "西安"],
  ["nanjing", "南京"],
  ["wuhan", "武汉"],
  ["hangzhou", "杭州"],
  ["ningbo", "宁波"],
  ["dalian", "大连"],
  ["hangzhou20", "墨黑"],
  ["quanzhou", "泉州"],
  ["suzhou", "苏州"],
  ["shenzhen", "深圳"],
  ["hefei", "合肥"],
  ["foshan", "佛山"],
  ["sydney", "悉尼"],
  ["chongqing", "重庆"],
  ["london", "伦敦"],
  ["yokohama", "横滨"],
  ["kaohsiung", "高雄"],
  ["haikou", "海口"],
  ["beijing", "北京"],
  ["macau-pink", "澳门粉"],
  ["macau-gray", "澳门灰"],
  ["macau-olive", "澳门橄榄"],
  ["mono", "墨夜"],
  ["xuan", "宣纸白"],
  ["suzhou2", "苏州·惊讶"],
]

// 28 distinct blessings (≤20 chars each — BLESSING_MAX)
const BLESSINGS = [
  "但愿人长久，千里共婵娟",
  "今晚月色很美，风也温柔",
  "愿这盏灯，替我陪着你",
  "月亮会替我抱抱你",
  "星光不问赶路人",
  "愿你所念之人，也在想你",
  "慢一点，月亮还没上山",
  "把心事交给夜风吧",
  "愿此后长夜，都有灯火",
  "年年岁岁，平安喜乐",
  "山高水长，后会有期",
  "你是我心上的月亮",
  "所有等待，都不算久",
  "愿你抬头，总能见月",
  "灯亮着，就不算走远",
  "一封写给月亮的信",
  "愿故人无恙，灯火可亲",
  "月亮知道我没说的",
  "且将新火试新茶",
  "愿你被这世界温柔以待",
  "人间一趟，看看月亮",
  "相隔千里，共此一轮",
  "愿今夜好梦，明日可期",
  "风起时，我在想你",
  "一盏灯，一个愿望",
  "归于山海，各自明亮",
  "月亮替我守着你",
  "愿你余生，皆是清欢",
]

// the 16 moon songs, in pool order (lib/mvp/songs.ts)
const SONGS = [
  "wurenzhijing",
  "shallwetalk",
  "womenwansui",
  "yinyoushiren",
  "congheshuoqi",
  "lifegoeson",
  "buyaoshuohua",
  "shuilaijianyueguang",
  "yueqiushangderen",
  "kongchengji",
  "wangyue",
  "qinjin",
  "zheyanghenhao",
  "aiqingzhuanyi",
  "nayiyemeiyouhuo",
  "buzhisuowei",
]

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--use-gl=angle", "--enable-webgl", "--ignore-gpu-blocklist"],
  })
  const context = await browser.newContext({ viewport: { width: 585, height: 1266 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })

  for (let i = 0; i < FACES.length; i++) {
    const [faceId, faceName] = FACES[i]
    const blessing = BLESSINGS[i]
    const song = SONGS[i % SONGS.length]
    const no = String(i + 1).padStart(2, "0")
    const file = path.join(OUT, `${no}_${faceName}_${faceId}.png`)
    const url =
      `${BASE}/release?from=make&color=${faceId}&face=${faceId}` +
      `&blessing=${encodeURIComponent(blessing)}&song=${song}`
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" })
      await wait(2600) // charge stage settles
      // hold-to-release on the lantern (canvas centre)
      const box = await page.locator("canvas").first().boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await wait(1300)
      await page.mouse.up()
      // memory stage: the share entry only exists for your OWN lamp
      await page.getByRole("button", { name: "分享这盏灯" }).waitFor({ timeout: 60000 })
      const lyric = await page.evaluate(() => {
        const p = [...document.querySelectorAll("p")].find((n) =>
          n.textContent?.startsWith("《"),
        )
        return p ? p.textContent : ""
      })
      await page.getByRole("button", { name: "分享这盏灯" }).click()
      await page.waitForFunction(
        () => {
          const img = document.querySelector('img[alt="我的灯笼分享卡"]')
          return !!img && img.src.startsWith("data:image")
        },
        { timeout: 30000 },
      )
      const dataUrl = await page.evaluate(
        () => document.querySelector('img[alt="我的灯笼分享卡"]').src,
      )
      const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1)
      fs.writeFileSync(file, Buffer.from(b64, "base64"))
      console.log(`[${no}/${FACES.length}] ${faceName} (${faceId}) -> ${path.basename(file)} ${fs.statSync(file).size}B song=${song} ${lyric}`)
    } catch (e) {
      console.log(`[${no}/${FACES.length}] ${faceName} FAILED: ${e.message.slice(0, 120)}`)
    }
  }
  console.log(`errors=${errors.length}`)
  if (errors.length) console.log(errors.slice(0, 5).join(" | "))
  await browser.close()
}

main().catch((e) => {
  console.log("FATAL", e.message)
  process.exit(1)
})
