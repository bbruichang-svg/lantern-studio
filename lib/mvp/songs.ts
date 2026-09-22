/**
 * MVP content layer — a pool of Eason Chan (陈奕迅) songs revealed after
 * lighting. Every song in this pool is a "moon song": each carries one
 * moon-lit line (user-curated) that fades in after the lantern is lit —
 * the lantern glows, and so does the moon in the night sky.
 * No playback here: "去听这首歌" jumps to the official QQ Music search
 * page for the song, which is a legal, always-valid destination.
 */
export type MvpSong = {
  title: string
  artist: string
  /** one moon-lit lyric line (curated), fades in on the finished screen and prints on the share card */
  moonLyric: string
}

const POOL: readonly MvpSong[] = [
  { title: "无人之境", artist: "陈奕迅", moonLyric: "但是我清醒 月亮总不肯照亮情欲深处那道背影" },
  { title: "Shall We Talk", artist: "陈奕迅", moonLyric: "明月光 为何未照地堂" },
  { title: "我们万岁", artist: "陈奕迅", moonLyric: "月亮是否仍然记得当天的你 约会每一刻亦带着孩子气" },
  { title: "吟游诗人", artist: "陈奕迅", moonLyric: "月光不敌雨水 数着绵羊都可以流眼泪" },
  { title: "从何说起", artist: "陈奕迅", moonLyric: "月光光 从何处唱起 那阴晴圆缺如何不服气" },
  { title: "Life Goes On", artist: "陈奕迅", moonLyric: "雪白变得淡黄 那是晚空月光 从简单中看迷茫" },
  { title: "不要说话", artist: "陈奕迅", moonLyric: "深色的海面布满白色的月光 我出神望着海心不知飞哪去" },
  { title: "谁来剪月光", artist: "陈奕迅", moonLyric: "偶尔抬起头来 还好有颗月亮可赏" },
  { title: "月球上的人", artist: "陈奕迅", moonLyric: "从月球观看 难辨地球相爱跟错爱" },
  { title: "空城记", artist: "陈奕迅", moonLyric: "如果你是月亮 能不能让我 遗忘掉我爱你的忧伤" },
  { title: "望月", artist: "陈奕迅", moonLyric: "狼在叫 雪正飘 月似镜子天上照" },
  { title: "亲近", artist: "陈奕迅", moonLyric: "亲必须要近 明月照人 无价是眼前人" },
  { title: "这样很好", artist: "陈奕迅", moonLyric: "那就算 世界满是荒芜 我们抬头就能 看见月亮" },
  { title: "爱情转移", artist: "陈奕迅", moonLyric: "回忆是抓不到的月光 握紧就变黑暗" },
  { title: "那一夜有没有说", artist: "陈奕迅", moonLyric: "云 在赶月 路低声说 就翻风雪" },
  { title: "不知所谓", artist: "陈奕迅", moonLyric: "在月儿面前 讲跳水" },
]

let lastPick = -1

export function pickSong(): MvpSong {
  let i = Math.floor(Math.random() * POOL.length)
  if (POOL.length > 1 && i === lastPick) i = (i + 1) % POOL.length
  lastPick = i
  return POOL[i]
}

/** official music platform destination — search page, never an embed */
export function songLink(song: MvpSong): string {
  return `https://y.qq.com/n/ryqq/search?w=${encodeURIComponent(`${song.title} ${song.artist}`)}`
}
