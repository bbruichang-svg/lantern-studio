import { useSyncExternalStore } from "react"

/**
 * Motion tokens — 全站动效的单一事实来源（spec: Motion Token 层）。
 *
 * 两套叙事时长：正常节奏（TIMELINE）与 prefers-reduced-motion 降级
 * （TIMELINE_REDUCED）。降级原则：
 *   - 位移类时间轴（升空/飞枝/化月）压缩到 ~1s，保留叙事节拍；
 *   - 摆动/风过/钟摆等纯装饰性运动归零（sway、gust、pendulum）；
 *   - 亮度类效果（呼吸、渐亮、ignition swell）保留 —— 不是空间运动，
 *     前庭安全风险低，且是"灯亮了"这一叙事本体的组成部分。
 * 组件统一用 `reduced ? TIMELINE_REDUCED.x : TIMELINE.x` 取值。
 */

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(onChange: () => void): () => void {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}

function getClientSnapshot(): boolean {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

/**
 * SSR-safe 的 reduced-motion 检测：服务端与首帧恒 false（遵守本项目的
 * hydration 纪律 —— 渲染期不读环境），挂载后由 useSyncExternalStore
 * 同步真实媒体查询值，并响应运行时切换（用户中途改系统设置也生效）。
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}

/** 叙事时间轴时长（秒）— 正常节奏（与各组件原硬编码值一致） */
export const TIMELINE = {
  /** 点亮渐亮时间线（LanternLighting.LIGHTING_DURATION） */
  lighting: 2.8,
  /** /release 升空飞行 */
  soar: 4.2,
  /** 挂树：飞向枝头 */
  hangFlight: 1.8,
  /** 挂树：钟摆衰减 */
  hangSway: 2.7,
  /** 化月 merge */
  dissolve: 2.8,
} as const

/** 叙事时间轴时长（秒）— reduced-motion 降级：位移压缩、无摆动 */
export const TIMELINE_REDUCED = {
  lighting: 0.8,
  soar: 1.2,
  hangFlight: 0.7,
  hangSway: 0.35,
  dissolve: 1.0,
} as const
