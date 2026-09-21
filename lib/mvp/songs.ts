/**
 * MVP content layer — a pool of Eason Chan (陈奕迅) songs revealed after
 * lighting. Random pick per lighting (avoiding an immediate repeat).
 * No playback here: "去听这首歌" jumps to the official QQ Music search
 * page for the song, which is a legal, always-valid destination.
 */
export type MvpSong = {
  title: string
  artist: string
  /** short original mood note (not lyrics) shown beside the artist */
  note: string
}

const POOL: readonly MvpSong[] = [
  { title: "十年", artist: "陈奕迅", note: "给正在怀念的你" },
  { title: "富士山下", artist: "陈奕迅", note: "给学会放下的你" },
  { title: "浮夸", artist: "陈奕迅", note: "给不甘平凡的你" },
  { title: "任我行", artist: "陈奕迅", note: "给仍然想出发的你" },
  { title: "葡萄成熟时", artist: "陈奕迅", note: "给耐心等待的你" },
  { title: "夕阳无限好", artist: "陈奕迅", note: "给舍不得黄昏的你" },
  { title: "陪你度过漫长岁月", artist: "陈奕迅", note: "给一路同行的你" },
  { title: "我们", artist: "陈奕迅", note: "给心里有个名字的你" },
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
