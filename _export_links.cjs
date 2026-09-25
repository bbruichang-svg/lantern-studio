/**
 * Build the share-link list for the 28 face cards — mirrors
 * encodeLanternPayload() in lib/mvp/share.ts (base64url of the UTF-8 JSON
 * + "." + djb2 base36 checksum). Tables below must stay in sync with
 * _export_faces.cjs (which produced the PNGs).
 */
const fs = require("fs")

const HOST = "https://moonlantern.app.workbuddy.host"
const OUT = "G:/Rui/moon/share-cards/分享页链接.md"

function toBase64Url(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}
function checksum(s) {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
function encode(p) {
  const body = toBase64Url(JSON.stringify(p))
  return `${body}.${checksum(body)}`
}

const FACES = [
  ["chengdu", "成都"], ["guangzhou", "广州"], ["xiamen", "厦门"], ["xian", "西安"],
  ["nanjing", "南京"], ["wuhan", "武汉"], ["hangzhou", "杭州"], ["ningbo", "宁波"],
  ["dalian", "大连"], ["hangzhou20", "墨黑"], ["quanzhou", "泉州"], ["suzhou", "苏州"],
  ["shenzhen", "深圳"], ["hefei", "合肥"], ["foshan", "佛山"], ["sydney", "悉尼"],
  ["chongqing", "重庆"], ["london", "伦敦"], ["yokohama", "横滨"], ["kaohsiung", "高雄"],
  ["haikou", "海口"], ["beijing", "北京"], ["macau-pink", "澳门粉"], ["macau-gray", "澳门灰"],
  ["macau-olive", "澳门橄榄"], ["mono", "墨夜"], ["xuan", "宣纸白"], ["suzhou2", "苏州·惊讶"],
]

const BLESSINGS = [
  "但愿人长久，千里共婵娟", "今晚月色很美，风也温柔", "愿这盏灯，替我陪着你", "月亮会替我抱抱你",
  "星光不问赶路人", "愿你所念之人，也在想你", "慢一点，月亮还没上山", "把心事交给夜风吧",
  "愿此后长夜，都有灯火", "年年岁岁，平安喜乐", "山高水长，后会有期", "你是我心上的月亮",
  "所有等待，都不算久", "愿你抬头，总能见月", "灯亮着，就不算走远", "一封写给月亮的信",
  "愿故人无恙，灯火可亲", "月亮知道我没说的", "且将新火试新茶", "愿你被这世界温柔以待",
  "人间一趟，看看月亮", "相隔千里，共此一轮", "愿今夜好梦，明日可期", "风起时，我在想你",
  "一盏灯，一个愿望", "归于山海，各自明亮", "月亮替我守着你", "愿你余生，皆是清欢",
]

const SONGS = [
  ["wurenzhijing", "无人之境"], ["shallwetalk", "Shall We Talk"], ["womenwansui", "我们万岁"],
  ["yinyoushiren", "吟游诗人"], ["congheshuoqi", "从何说起"], ["lifegoeson", "Life Goes On"],
  ["buyaoshuohua", "不要说话"], ["shuilaijianyueguang", "谁来剪月光"],
  ["yueqiushangderen", "月球上的人"], ["kongchengji", "空城记"], ["wangyue", "望月"],
  ["qinjin", "亲近"], ["zheyanghenhao", "这样很好"], ["aiqingzhuanyi", "爱情转移"],
  ["nayiyemeiyouhuo", "那一夜有没有说"], ["buzhisuowei", "不知所谓"],
]

const lines = [
  "# 月球上的人 · 表情分享页",
  "",
  `共 ${FACES.length} 张分享卡（PNG 见同目录），下面每一行是该卡对应的分享页链接——点名打开即还原同一盏灯。`,
  "",
  "| # | 表情 | 祝福语 | 歌曲 | 分享页 |",
  "| --- | --- | --- | --- | --- |",
]
for (let i = 0; i < FACES.length; i++) {
  const [faceId, name] = FACES[i]
  const blessing = BLESSINGS[i]
  const [songId, title] = SONGS[i % SONGS.length]
  const link = `${HOST}/?l=${encode({ c: faceId, f: faceId, b: blessing, s: songId, n: i + 1 })}`
  lines.push(
    `| ${String(i + 1).padStart(2, "0")} | ${name} | ${blessing} | 《${title}》 | [打开](${link}) |`,
  )
}
lines.push("")
fs.writeFileSync(OUT, lines.join("\n"), "utf8")
console.log(`wrote ${OUT} (${FACES.length} rows)`)
