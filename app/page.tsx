import Link from "next/link"

export default function Home() {
  return (
    <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-[#07080B] px-6">
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(120,116,104,0.08), rgba(7,8,11,0) 70%), #07080B",
        }}
      />
      <h1 className="text-sm font-medium tracking-[0.45em] text-[#E9E3D8]/85">
        LANTERN STUDIO
      </h1>
      <p className="mt-4 text-xs tracking-[0.3em] text-[#E9E3D8]/45">
        画一盏灯，点亮它。
      </p>
      <Link
        href="/lantern"
        className="mt-12 rounded-full px-8 py-3 text-xs tracking-[0.3em] text-[#E9E3D8]/75 outline outline-1 outline-[#E9E3D8]/25 transition-all duration-200 hover:bg-white/8 hover:text-[#E9E3D8]"
      >
        进入工作室
      </Link>
    </main>
  )
}
