"use client"

import { useCallback, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"
import { useFrame } from "@react-three/fiber"
import { BODY_TOP_Y, RING_CAP_HEIGHT, RING_RADIUS, buildLanternGeometry } from "@/lib/lantern/geometry"
import { ensureFace } from "@/lib/lantern/faces"
import { LanternCanvas } from "./LanternCanvas"
import { computeBreath, computeIdleSway, computeIgnitionSwell, computeLightingFrame, LIGHTING_DURATION } from "./LanternLighting"
import type { FacePreset, LanternColor, LanternPhase } from "@/lib/lantern/types"

type LanternModelProps = {
  color: LanternColor
  face: FacePreset | null
  phase: LanternPhase
  onCoreClick: () => void
  /** freeze all animation (sway timeline stops) — used while capturing the share card */
  paused?: boolean
}

const RING_COLOR = "#24201D"
const CAP_COLOR = "#181512"

/** candle-warm anchor the light colours blend toward */
const WARM_LIGHT = new THREE.Color("#FFD9A6")

/** peak of the transmitted-light term (shader attenuation ≈ /2.7 at the belly) */
const TRANSLUCENT_PEAK = 1.35

function makeBloomTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas")
  c.width = 256
  c.height = 256
  const ctx = c.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128)
    g.addColorStop(0, "rgba(255,255,255,0.6)")
    g.addColorStop(0.3, "rgba(255,255,255,0.12)")
    g.addColorStop(0.65, "rgba(255,255,255,0.03)")
    g.addColorStop(1, "rgba(255,255,255,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function LanternModel({ color, face, phase, onCoreClick, paused = false }: LanternModelProps) {
  const lanternTexture = useMemo(() => new LanternCanvas(), [])
  const geometry = useMemo(() => buildLanternGeometry(), [])
  const bloomTexture = useMemo(() => makeBloomTexture(), [])

  const facingGroup = useRef<THREE.Group>(null)
  const swayGroup = useRef<THREE.Group>(null)
  const paperMaterial = useRef<THREE.MeshPhysicalMaterial>(null)
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null)
  const bloomMaterial = useRef<THREE.SpriteMaterial>(null)
  const coreLight = useRef<THREE.PointLight>(null)
  const coreBulb = useRef<THREE.MeshBasicMaterial>(null)
  const sparkMesh = useRef<THREE.Mesh>(null)
  const sparkMaterial = useRef<THREE.MeshBasicMaterial>(null)

  // uniforms injected into the paper material for the thin-paper
  // translucency term (see onBeforeCompile below)
  const transUniforms = useRef<{ [k: string]: THREE.IUniform } | null>(null)
  const worldPosTmp = useMemo(() => new THREE.Vector3(), [])

  // per-frame accumulation (kept out of React state, spec §38)
  const timeRef = useRef(0)
  const lightTimeRef = useRef(-1)
  const prevPhaseRef = useRef<LanternPhase>(phase)
  // last value written to the --lantern-glow CSS var (skip redundant writes)
  const uiGlowRef = useRef(0)
  // breathing crossfade: 0 during the lighting timeline, ramps to 1 over
  // ~2s once the timeline completes, modulating the steady-state light
  const breathBlendRef = useRef(0)

  const targetBase = useMemo(() => new THREE.Color(color.base), [color.base])
  const targetGlow = useMemo(() => new THREE.Color(color.glow), [color.glow])
  // warm-leaning tints so the lantern never glows in its own saturated hue
  const emissiveTarget = useMemo(() => targetGlow.clone().lerp(WARM_LIGHT, 0.6), [targetGlow])
  const lightTarget = useMemo(() => targetGlow.clone().lerp(WARM_LIGHT, 0.55), [targetGlow])
  const haloTarget = useMemo(() => targetGlow.clone().lerp(WARM_LIGHT, 0.5), [targetGlow])
  const transTarget = useMemo(() => targetGlow.clone().lerp(WARM_LIGHT, 0.7), [targetGlow])

  // inject the thin-paper translucency term into the standard shader:
  // light from the internal bulb passes THROUGH the paper — direction is
  // flipped relative to the surface normal, so we use abs(N·L) and a
  // squared distance falloff. Bright belly, fading naturally to the rims.
  // Attached via the material ref callback so it is in place BEFORE the
  // first program compile (a useEffect can lose the race with the rAF loop).
  const attachPaperMaterial = useCallback((m: THREE.MeshPhysicalMaterial | null) => {
    paperMaterial.current = m
    if (!m) return
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTransLightPos = { value: new THREE.Vector3(0, -0.1, 0) }
      shader.uniforms.uTransColor = { value: WARM_LIGHT.clone() }
      shader.uniforms.uTransIntensity = { value: 0 }
      transUniforms.current = shader.uniforms
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vTransWorldPos;\nvarying vec3 vTransNormal;\nvarying vec3 vTransNormalView;",
        )
        .replace(
          "#include <worldpos_vertex>",
          `#include <worldpos_vertex>
          vTransWorldPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;
          vTransNormal = normalize( mat3( modelMatrix ) * objectNormal );
          vTransNormalView = normalize( transformedNormal );`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>
          varying vec3 vTransWorldPos;
          varying vec3 vTransNormal;
          varying vec3 vTransNormalView;
          uniform vec3 uTransLightPos;
          uniform vec3 uTransColor;
          uniform float uTransIntensity;`,
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          {
            /* thin-paper transmission: a bulb inside the shell lights every
               interior point almost equally, so the visible falloff is
               dominated by the grazing angle (long optical path near the
               limb) — bright centre of the visible disc, dark rim */
            vec3 tLv = uTransLightPos - vTransWorldPos;
            float tD = max( length( tLv ), 1e-4 );
            vec3 tL = tLv / tD;
            float tNdv = clamp( abs( dot( normalize( vTransNormalView ), normalize( vViewPosition ) ) ), 0.0, 1.0 );
            float tNdl = abs( dot( normalize( vTransNormal ), tL ) );
            float tShape = pow( tNdv, 2.2 ) * 0.85 + pow( tNdl, 1.5 ) * 0.15;
            float tAtten = uTransIntensity / ( 1.0 + 1.7 * tD * tD );
            /* ink strokes block the light — the pattern stays readable */
            vec3 tPass = vec3( 1.0 );
            #ifdef USE_EMISSIVEMAP
              tPass = texture2D( emissiveMap, vEmissiveMapUv ).rgb;
            #endif
            totalEmissiveRadiance += uTransColor * ( tShape * tAtten ) * tPass;
          }`,
        )
    }
    m.customProgramCacheKey = () => "lantern-paper-translucent"
    // DEBUG: exposed for headless verification (probe program uniforms)
    if (typeof window !== "undefined") {
      ;(window as unknown as Record<string, unknown>).__paperMat = m
    }
  }, [])

  useEffect(() => {
    const src = face?.src ?? null
    if (!src) {
      lanternTexture.setFaceImage(null)
      return
    }
    let cancelled = false
    void ensureFace(src).then(() => {
      if (!cancelled) lanternTexture.setFaceImage(src)
    })
    // DEBUG: expose texture layers for inspection (remove before V2)
    if (typeof window !== "undefined") {
      ;(window as unknown as Record<string, unknown>).__lanternDebug = lanternTexture
    }
    return () => {
      cancelled = true
    }
  }, [face, lanternTexture])

  useEffect(() => {
    return () => {
      geometry.dispose()
      lanternTexture.texture.dispose()
      lanternTexture.roughnessTexture.dispose()
      lanternTexture.bumpTexture.dispose()
      bloomTexture.dispose()
    }
  }, [geometry, lanternTexture, bloomTexture])

  useFrame((_, delta) => {
    if (paused) return // frozen for share-card capture: no sway, no light drift
    const dt = Math.min(delta, 0.05)
    timeRef.current += dt

    // reset the timeline if the user goes back to the studio
    if (prevPhaseRef.current !== phase || (phase === "finished" && lightTimeRef.current < 0)) {
      if (phase === "studio" || phase === "ready") lightTimeRef.current = -1
      if (phase === "lighting" && lightTimeRef.current < 0) lightTimeRef.current = 0
      // mounting straight into "finished" (share-link restore) — the lamp
      // must present its fully-lit state, no timeline replay
      if (phase === "finished" && lightTimeRef.current < 0)
        lightTimeRef.current = LIGHTING_DURATION
      prevPhaseRef.current = phase
    }
    const lit = lightTimeRef.current >= 0
    if (lit) lightTimeRef.current += dt

    const frame = lit ? computeLightingFrame(lightTimeRef.current) : null

    // steady-state breathing: once the timeline has run its course, blend
    // the dual-frequency swell into every light channel over ~2s. On top of
    // it, the ignition swell surges past the steady level right at
    // completion and settles back — the lantern-native "pop".
    const over = lit ? lightTimeRef.current - LIGHTING_DURATION : -1
    if (over < 0) breathBlendRef.current = 0
    else breathBlendRef.current = Math.min(1, breathBlendRef.current + dt / 2)
    const breath = 1 + (computeBreath(lightTimeRef.current) - 1) * breathBlendRef.current
    const lightMod = breath * (over >= 0 ? computeIgnitionSwell(over) : 1)

    // UI illumination bridge: expose the lantern's light level to the DOM
    // as --lantern-glow so on-screen text is "lit by the lantern" — the UI
    // and the lantern share a single light source. translucent leads (0.4s),
    // glow completes the bloom (2.2s); max() gives a smooth 0→1.
    if (typeof document !== "undefined") {
      const g = frame ? Math.max(frame.translucent, frame.glow) * lightMod : 0
      if (Math.abs(g - uiGlowRef.current) > 0.008) {
        uiGlowRef.current = g
        document.documentElement.style.setProperty("--lantern-glow", g.toFixed(3))
      }
    }

    // gentle hanging sway, boosted briefly while lighting up
    if (swayGroup.current) {
      const boost = frame ? frame.swayBoost : 1
      const idle = computeIdleSway(timeRef.current, boost)
      swayGroup.current.rotation.z = idle.rotZ
      swayGroup.current.rotation.x = idle.rotX
    }

    const k = 1 - Math.exp(-6 * dt)
    if (paperMaterial.current) {
      paperMaterial.current.color.lerp(targetBase, k)
      paperMaterial.current.emissive.lerp(emissiveTarget, k)
      paperMaterial.current.emissiveIntensity = frame ? frame.emissive : 0
    }
    if (transUniforms.current) {
      if (coreLight.current) coreLight.current.getWorldPosition(worldPosTmp)
      transUniforms.current.uTransLightPos.value.copy(worldPosTmp)
      transUniforms.current.uTransColor.value.lerp(transTarget, k)
      transUniforms.current.uTransIntensity.value = frame ? frame.translucent * TRANSLUCENT_PEAK * lightMod : 0
    }
    if (coreLight.current) {
      coreLight.current.color.lerp(lightTarget, k)
      coreLight.current.intensity = frame ? frame.pointIntensity * lightMod : 0
    }
    if (glowMaterial.current) {
      glowMaterial.current.color.lerp(haloTarget, k)
      glowMaterial.current.opacity = frame ? frame.glow * 0.09 * lightMod : 0
    }
    if (bloomMaterial.current) {
      bloomMaterial.current.color.lerp(haloTarget, k)
      bloomMaterial.current.opacity = frame ? frame.glow * 0.12 * lightMod : 0
    }
    if (coreBulb.current) {
      coreBulb.current.color.lerp(targetGlow, k)
      coreBulb.current.opacity = frame ? 0.05 + frame.core * 0.95 * lightMod : 0.05
    }
    if (sparkMesh.current && sparkMaterial.current) {
      const s = frame ? frame.spark : 0
      const scale = 0.4 + s * 2.2
      sparkMesh.current.scale.setScalar(scale)
      sparkMaterial.current.opacity = s
    }
  })

  const coreInteractive = phase === "ready"

  return (
    <group>
      {/* soft bloom sprite — drawn behind the lantern, halo spills around the silhouette */}
      <sprite renderOrder={-1} position={[0, 0, 0]} scale={[3.4, 3.4, 1]}>
        <spriteMaterial
          ref={bloomMaterial}
          map={bloomTexture}
          transparent
          opacity={0}
          depthTest={false}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </sprite>

      {/* outer halo — backside sphere, a tight warm veil hugging the silhouette */}
      <mesh renderOrder={-1}>
        <sphereGeometry args={[1.6, 32, 24]} />
        <meshBasicMaterial
          ref={glowMaterial}
          transparent
          opacity={0}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>

      <group ref={facingGroup} rotation={[0, Math.PI, 0]}>
        <group ref={swayGroup}>
          {/* paper body — handmade paper: uneven roughness, faint fibre bump,
              warm low emissive; the real lighting comes from the shader
              translucency term + the internal point light */}
          <mesh geometry={geometry}>
            <meshPhysicalMaterial
              ref={attachPaperMaterial}
              map={lanternTexture.texture}
              emissiveMap={lanternTexture.texture}
              emissive={emissiveTarget}
              emissiveIntensity={0}
              color={color.base}
              roughness={1}
              roughnessMap={lanternTexture.roughnessTexture}
              metalness={0}
              bumpMap={lanternTexture.bumpTexture}
              bumpScale={0.0035}
              sheen={0.22}
              sheenColor="#FFF6E8"
              sheenRoughness={0.9}
            />
          </mesh>

          {/* top & bottom structure — small rings where the sphere meets the opening */}
          <mesh position={[0, BODY_TOP_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RING_RADIUS, 0.022, 10, 48]} />
            <meshStandardMaterial color={RING_COLOR} roughness={0.62} metalness={0.05} />
          </mesh>
          <mesh position={[0, -BODY_TOP_Y, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RING_RADIUS, 0.022, 10, 48]} />
            <meshStandardMaterial color={RING_COLOR} roughness={0.62} metalness={0.05} />
          </mesh>
          {/* caps so the openings never reveal the hollow inside */}
          <mesh position={[0, BODY_TOP_Y + RING_CAP_HEIGHT - 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[RING_RADIUS - 0.008, 48]} />
            <meshStandardMaterial color={CAP_COLOR} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -(BODY_TOP_Y + RING_CAP_HEIGHT - 0.015), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[RING_RADIUS - 0.008, 48]} />
            <meshStandardMaterial color={CAP_COLOR} roughness={0.8} side={THREE.DoubleSide} />
          </mesh>

          {/* internal light source — near the centre of the body so the
              transmitted-light falloff is symmetric (bright belly → rims) */}
          <pointLight ref={coreLight} position={[0, -0.12, 0]} color={lightTarget} intensity={0} distance={4.5} decay={2} />

          {/* light core: wick + bulb, small and quiet */}
          <group position={[0, -(BODY_TOP_Y + RING_CAP_HEIGHT) + 0.1, 0]}>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.028, 0.034, 0.09, 12]} />
              <meshStandardMaterial color="#2A241F" roughness={0.7} />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.055, 16, 12]} />
              <meshBasicMaterial ref={coreBulb} color="#FFF6DE" transparent opacity={0.05} />
            </mesh>
            <mesh ref={sparkMesh} scale={0.4}>
              <sphereGeometry args={[0.1, 12, 10]} />
              <meshBasicMaterial
                ref={sparkMaterial}
                color="#FFE9B8"
                transparent
                opacity={0}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            {/* click target for the lighting interaction */}
            <mesh
              visible={false}
              onClick={(e) => {
                e.stopPropagation()
                if (coreInteractive) onCoreClick()
              }}
              onPointerOver={() => {
                if (coreInteractive) document.body.style.cursor = "pointer"
              }}
              onPointerOut={() => {
                document.body.style.cursor = "auto"
              }}
            >
              <sphereGeometry args={[0.3, 12, 10]} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
