"use client"

import type { ShareCardOptions } from "@/lib/lantern/share-card"

type ShareViewProps = {
  /** composed 1080×1350 card as PNG data URL (null while generating) */
  cardUrl: string | null
  generating: boolean
  /** light transient feedback: 「已保存」/「已分享」/「链接已复制」 */
  feedback: string | null
  onSave: () => void
  onCopyLink?: () => void
  onClose: () => void
}

/**
 * Full-screen immersive share view (spec §4): the same night continues,
 * a × sits top-left, the finished card is the centre of attention.
 * No modal chrome, no glass, no decorative borders.
 */
export default function ShareView({
  cardUrl,
  generating,
  feedback,
  onSave,
  onCopyLink,
  onClose,
}: ShareViewProps) {
  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 75% 62% at 50% 42%, #101B30 0%, #0A1322 55%, #060B16 100%)",
      }}
    >
      {/* close — top-left only */}
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭分享"
        className="pointer-events-auto absolute left-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-[#E8E4DA]/60 transition-colors duration-200 hover:text-[#E8E4DA]"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M2 2 L14 14 M14 2 L2 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* card preview — the hero of this screen */}
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 pt-14">
        {generating || !cardUrl ? (
          <span className="text-[11px] tracking-[0.4em] text-[#E8E4DA]/40">生成中 …</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cardUrl}
            alt="我的灯笼分享卡"
            draggable={false}
            className="max-h-full max-w-[min(78vw,400px)] select-none rounded-lg shadow-[0_18px_70px_rgba(0,0,0,0.55)]"
          />
        )}
      </div>

      {/* quiet actions + light feedback */}
      <div className="flex flex-col items-center gap-3 pb-[4.5vh] pt-5">
        <button
          type="button"
          onClick={onSave}
          disabled={generating || !cardUrl}
          className="text-xs tracking-[0.34em] text-[#E8E4DA]/70 underline decoration-[#E8E4DA]/25 underline-offset-8 transition-colors duration-200 hover:text-[#E8E4DA] hover:decoration-[#E8E4DA]/60 disabled:opacity-40"
        >
          保存我的灯笼
        </button>
        {onCopyLink && (
          <button
            type="button"
            onClick={onCopyLink}
            className="text-[10px] tracking-[0.3em] text-[#E8E4DA]/45 transition-colors duration-200 hover:text-[#E8E4DA]/85"
          >
            或复制一盏灯的链接
          </button>
        )}
        <span
          aria-live="polite"
          className={`h-4 text-[10px] tracking-[0.3em] text-[#E8E4DA]/45 transition-opacity duration-500 ${
            feedback ? "opacity-100" : "opacity-0"
          }`}
        >
          {feedback ?? ""}
        </span>
      </div>
    </div>
  )
}

/** re-export so page.tsx keeps a single import surface for card types */
export type { ShareCardOptions }
