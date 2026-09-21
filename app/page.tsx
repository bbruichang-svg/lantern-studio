import Link from "next/link"

export default function Home() {
  return (
    <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#F7F4ED] px-6">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 50%, #FFFFFF 0%, #F3F0E7 70%, #EBE7DB 100%)",
        }}
      />
      <h1 className="text-sm font-medium tracking-[0.45em] text-[#2A2622]/85">
        LANTERN STUDIO
      </h1>
      <p className="mt-4 text-xs tracking-[0.3em] text-[#2A2622]/50">
        画一盏灯，点亮它。
      </p>
      <Link
        href="/lantern"
        className="mt-12 rounded-full px-8 py-3 text-xs tracking-[0.3em] text-[#2A2622]/75 outline outline-1 outline-[#2A2622]/25 transition-all duration-200 hover:bg-black/5 hover:text-[#2A2622]"
      >
        进入工作室
      </Link>
    </main>
  )
}
