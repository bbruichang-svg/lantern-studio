"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { getColorById, getDefaultFace } from "@/lib/lantern/colors"
import { getSongById } from "@/lib/mvp/songs"
import { resolveFaceById } from "@/lib/mvp/custom-face"
import { fetchWallLanterns, fetchWallCount, type WallLantern } from "@/lib/lantern/cloud"
import { track } from "@/lib/mvp/analytics"

/**
 * 「灯墙」— 公共层。所有人点亮后匿名汇入的灯（云端 wall_lanterns，
 * 公共读/仅插入）。本机灯册在 /my，互不相干。
 * 手绘灯直接渲染随行内嵌的 128px PNG（face_data），预设灯按 face_id 解析。
 */

function relTime(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ""
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  const d = new Date(t)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

export default function WallPage() {
  const [lamps, setLamps] = useState<WallLantern[] | null>(null)
  const [count, setCount] = useState<number | null>(null)
  // null=请求中 / true=云不可达
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setFailed(false)
    setLamps(null)
    void fetchWallLanterns().then((rows) => {
      if (rows === null) {
        setFailed(true)
        return
      }
      setLamps(rows)
      void fetchWallCount().then((c) => setCount(c ?? rows.length))
    })
  }, [])

  useEffect(() => {
    track("page_view_wall")
    queueMicrotask(load)
  }, [load])

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
      {/* feTurbulence grain */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          filter: "url(#wall-grain)",
          opacity: 0.05,
          mixBlendMode: "soft-light",
        }}
      />
      <svg aria-hidden="true" className="absolute h-0 w-0">
        <filter id="wall-grain">
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
            {count === null ? "" : `共 ${count} 盏`}
          </p>
        </div>
        <h1 className="mt-6 text-center text-2xl font-light tracking-[0.42em]">灯墙</h1>
        <p className="mt-2 text-center text-[10px] tracking-[0.3em] text-[#E8E4DA]/40">
          每一盏被点亮的灯，都会汇到这里
        </p>

        {failed ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm tracking-[0.35em] text-[#E8E4DA]/55">灯墙暂时够不到</p>
            <p className="mt-2 text-[11px] tracking-[0.25em] text-[#E8E4DA]/35">
              网络打了个盹，稍后再试试
            </p>
            <button
              type="button"
              onClick={load}
              className="mt-8 rounded-full px-10 py-3 text-xs tracking-[0.45em] text-[#E8E4DA]/85 outline outline-1 outline-[#E8E4DA]/30 transition-all duration-300 hover:bg-[#E8E4DA]/10 hover:text-[#E8E4DA]"
            >
              再试一次
            </button>
          </div>
        ) : lamps === null ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="animate-pulse-soft text-[11px] tracking-[0.4em] text-[#E8E4DA]/35">
              正在仰望
            </p>
          </div>
        ) : lamps.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-sm tracking-[0.35em] text-[#E8E4DA]/55">灯墙还空着</p>
            <p className="mt-2 text-[11px] tracking-[0.25em] text-[#E8E4DA]/35">
              第一盏灯会由你来点
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
              const color = getColorById(lamp.color_id)
              // 手绘内嵌图优先 — 它就是作者亲笔画；预设灯按 id 解析
              const faceSrc =
                lamp.face_data ??
                resolveFaceById(lamp.face_id ?? "")?.src ??
                getDefaultFace(lamp.color_id).src
              const song = lamp.song_id ? getSongById(lamp.song_id) : null
              return (
                <li
                  key={lamp.id}
                  className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                >
                  <div className="flex items-center gap-4">
                    <span
                      className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15"
                      style={{ backgroundColor: color.base }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={faceSrc}
                        alt=""
                        draggable={false}
                        className="h-12 w-12 select-none"
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs tracking-[0.2em] text-[#E8E4DA]/85">
                        {color.name}
                        {song && (
                          <span className="ml-2 text-[10px] text-[#E8E4DA]/40">
                            《{song.title}》
                          </span>
                        )}
                      </p>
                      <p className="mt-1 truncate text-sm text-[#E8E4DA]/90">
                        {lamp.blessing ? (
                          `「${lamp.blessing}」`
                        ) : (
                          <span className="text-[#E8E4DA]/35">未留言</span>
                        )}
                      </p>
                      <p className="mt-1 text-[10px] tracking-[0.2em] text-[#E8E4DA]/35">
                        {relTime(lamp.lit_at)}
                      </p>
                    </div>
                  </div>
                  {/* 点亮看看 — replay this lantern's release ritual, pre-filled
                      from the cloud row (?from=wall&id=). Replay only: the
                      release flow never writes back, no duplicate rows. */}
                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/release?from=wall&id=${lamp.id}`}
                      className="text-[10px] tracking-[0.3em] text-[#E8E4DA]/40 transition-colors duration-200 hover:text-[#E8E4DA]/85"
                    >
                      点亮看看 ›
                    </Link>
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
