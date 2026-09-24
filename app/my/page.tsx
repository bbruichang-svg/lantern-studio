"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { getColorById, getDefaultFace } from "@/lib/lantern/colors"
import { getSongById } from "@/lib/mvp/songs"
import { resolveFaceById } from "@/lib/mvp/custom-face"
import {
  formatNumber,
  listLanterns,
  removeLantern,
  litCount,
  type LitLantern,
} from "@/lib/mvp/storage"
import { lanternLink } from "@/lib/mvp/share"
import { track } from "@/lib/mvp/analytics"

/**
 * 「我的灯」— 本机灯册陈列页 (P1)。纯 localStorage，不联网：
 * 每盏灯还原成 表情盘 + 编号 + 祝福 + 日期；点「点亮看看」带着完整
 * payload 回到根路由的 finished 态（?l=...，手绘在本机画廊内可精确
 * 恢复）。删除走两击确认，不用系统弹窗。
 */

/** 二击删除的确认窗口 */
const DELETE_ARM_MS = 2600

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function MyLanternsPage() {
  const router = useRouter()
  const [lamps, setLamps] = useState<LitLantern[]>([])
  const [count, setCount] = useState(0)
  const [armedNo, setArmedNo] = useState<number | null>(null)
  const armTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    queueMicrotask(() => {
      setLamps(listLanterns())
      setCount(litCount())
    })
  }, [])

  const handleDelete = useCallback((no: number) => {
    if (armedNo !== no) {
      // first tap: arm — the button turns into 确认删除
      setArmedNo(no)
      window.clearTimeout(armTimer.current)
      armTimer.current = window.setTimeout(() => setArmedNo(null), DELETE_ARM_MS)
      return
    }
    window.clearTimeout(armTimer.current)
    setArmedNo(null)
    removeLantern(no)
    setLamps(listLanterns())
    setCount(litCount())
    track("my_lantern_deleted")
  }, [armedNo])

  const handleView = useCallback((lamp: LitLantern) => {
    track("my_lantern_viewed")
    router.push(lanternLink({
      c: lamp.colorId,
      f: lamp.faceId,
      b: lamp.blessing,
      s: lamp.songId,
      n: lamp.no,
    }))
  }, [router])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#060B16] text-[#E8E4DA]">
      {/* night sky — same falloff as the other pages */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 62% at 50% 42%, #101B30 0%, #0A1322 55%, #060B16 100%)",
        }}
      />
      {/* feTurbulence grain — same texture layer as the ritual pages */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          filter: "url(#my-grain)",
          opacity: 0.05,
          mixBlendMode: "soft-light",
        }}
      />
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <filter id="my-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch" />
        </filter>
      </svg>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-5 pb-10 pt-8">
        {/* header */}
        <div className="flex items-baseline justify-between">
          <Link
            href="/"
            className="text-[11px] tracking-[0.3em] text-[#E8E4DA]/45 transition-colors duration-200 hover:text-[#E8E4DA]/85"
          >
            ‹ 灯会
          </Link>
          <p className="text-[10px] tracking-[0.3em] text-[#E8E4DA]/40">
            共 {count} 盏
          </p>
        </div>
        <h1 className="mt-6 text-center text-2xl font-light tracking-[0.42em]">我的灯</h1>
        <p className="mt-2 text-center text-[10px] tracking-[0.3em] text-[#E8E4DA]/40">
          只存在这台设备上，不联网
        </p>

        {lamps.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm tracking-[0.35em] text-[#E8E4DA]/55">灯会初亮，火种已备</p>
            <p className="mt-2 text-[11px] tracking-[0.25em] text-[#E8E4DA]/35">
              点亮的第一盏灯会住进这里
            </p>
            <Link
              href="/"
              className="mt-8 rounded-full px-10 py-3 text-xs tracking-[0.45em] text-[#E8E4DA]/85 outline outline-1 outline-[#E8E4DA]/30 transition-all duration-300 hover:bg-[#E8E4DA]/10 hover:text-[#E8E4DA]"
            >
              去点一盏
            </Link>
          </div>
        ) : (
          <ul className="mt-8 flex flex-col gap-3">
            {lamps.map((lamp) => {
              const color = getColorById(lamp.colorId)
              const face = resolveFaceById(lamp.faceId) ?? getDefaultFace(lamp.colorId)
              const song = getSongById(lamp.songId)
              const armed = armedNo === lamp.no
              return (
                <li
                  key={lamp.no}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition-colors duration-200 hover:bg-white/[0.05]"
                >
                  <div className="flex items-center gap-4">
                    {/* face disc — same presentation as the picker */}
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15"
                      style={{ backgroundColor: color.base }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={face.src}
                        alt=""
                        draggable={false}
                        className="h-12 w-12 select-none"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs tracking-[0.2em] text-[#E8E4DA]/85">
                        {formatNumber(lamp.no)}
                        {song && (
                          <span className="ml-2 text-[10px] text-[#E8E4DA]/40">
                            《{song.title}》
                          </span>
                        )}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#E8E4DA]/90">
                        {lamp.blessing ? `「${lamp.blessing}」` : <span className="text-[#E8E4DA]/35">未留言</span>}
                      </p>
                      <p className="mt-1 text-[10px] tracking-[0.2em] text-[#E8E4DA]/35">
                        {formatDate(lamp.litAt)} · {color.name}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(lamp.no)}
                      className={`rounded-full px-4 py-1.5 text-[10px] tracking-[0.25em] transition-all duration-200 ${
                        armed
                          ? "bg-[#E03860] text-white"
                          : "text-[#E8E4DA]/40 outline outline-1 outline-transparent hover:text-[#E8E4DA]/75"
                      }`}
                    >
                      {armed ? "确认删除？" : "删除"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleView(lamp)}
                      className="rounded-full px-5 py-1.5 text-[10px] tracking-[0.25em] text-[#E8E4DA]/80 outline outline-1 outline-[#E8E4DA]/30 transition-all duration-200 hover:bg-[#E8E4DA]/10 hover:text-[#E8E4DA]"
                    >
                      点亮看看
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
