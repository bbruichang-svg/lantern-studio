/**
 * 写祝福内容层 — 全部随包内置，零网络请求。
 * 固定示例句（点击直接填入）+ 本地灵感库（3 条一批，可换）。
 * 每条 ≤20 字，符合输入上限。
 */

export const BLESSING_MAX = 20

/** 固定示例句区（≥3 条，点击直接填入输入框） */
export const EXAMPLE_BLESSINGS: readonly string[] = [
  "今晚的月亮，也照着你",
  "千里共明月，万事都顺遂",
  "灯火可亲，人间值得",
]

/** 本地灵感库 — 每批展示 3 条，可「换一批」 */
const INSPIRATION_POOL: readonly string[] = [
  "月色与你不期而遇",
  "愿你被这个世界温柔以待",
  "灯亮了，想念的人都平安",
  "月亮圆的时候，心愿也会圆",
  "把这句祝福挂在月亮上",
  "今晚风也温柔，月也温柔",
  "愿所有等待都有回音",
  "人间烟火，最抚人心",
  "这一盏，替我陪你看月亮",
  "月映千川，灯照万家",
  "心事说给月亮听",
  "愿你不慌不忙，自有光芒",
]

/** 随机抽一批（3 条，不重复） */
export function pickInspiration(exclude?: ReadonlySet<string>): string[] {
  const pool = INSPIRATION_POOL.filter((x) => !exclude?.has(x))
  const source = pool.length >= 3 ? pool : [...INSPIRATION_POOL]
  const out: string[] = []
  const used = new Set<number>()
  while (out.length < 3 && used.size < source.length) {
    const i = Math.floor(Math.random() * source.length)
    if (used.has(i)) continue
    used.add(i)
    out.push(source[i])
  }
  return out
}

/**
 * 本地敏感词基础过滤 — 阻断提交但不暴露词库。
 * 纯个人项目的基础版，词库保持极小、只拦明显不当内容。
 */
const BLOCKED: readonly string[] = [
  "傻逼",
  "妈的",
  "操你",
  "滚蛋",
  "去死",
  "废物",
]

export function isBlessingAllowed(text: string): boolean {
  const t = text.toLowerCase()
  return !BLOCKED.some((w) => t.includes(w))
}
