"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TERRAIN_Y } from "../terrain";
import type { TimeScale } from "../simulation";
import type { GraphicQuality } from "../IslandScene";
import { PALETTE, useEasedBlend } from "./weather";

const SUN_ORBIT_RADIUS = 15;
const SUN_ELEVATION_DEG = 30;
const SUN_ORBIT_SPEED = 0.04; // rad per detik-simulasi
const FOG_NEAR = 64;
const FOG_FAR = 170;
const FOG_OFF_NEAR = 260;
const FOG_OFF_FAR = 320;
const FOG_RAIN_NEAR_SHIFT = -12;
const FOG_RAIN_FAR_SHIFT = -28;

interface SkyProps {
  graphicQuality: GraphicQuality;
  timeScale: TimeScale;
  isRaining: boolean;
  isFoggy: boolean;
}

// Satu komponen untuk seluruh cahaya & warna atmosfer. Semua nilai yang
// bergantung cuaca di-lerp lewat rainBlend sehingga hujan datang dan pergi
// secara bertahap, tidak pernah berganti instan.
export default function Sky({
  graphicQuality,
  timeScale,
  isRaining,
  isFoggy,
}: SkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const bgRef = useRef<THREE.Color>(null);
  const fogRef = useRef<THREE.Fog>(null);
  const angle = useRef(0);
  const rainBlend = useEasedBlend(isRaining);
  const fogBlend = useEasedBlend(isFoggy);

  const colors = useMemo(
    () => ({
      skyClear: new THREE.Color(PALETTE.skyClear),
      skyRain: new THREE.Color(PALETTE.skyRain),
      fogClear: new THREE.Color(PALETTE.fogClear),
      fogRain: new THREE.Color(PALETTE.fogRain),
      sunWarm: new THREE.Color(PALETTE.sunWarm),
      sunNeutral: new THREE.Color(PALETTE.sunNeutral),
      sunRain: new THREE.Color(PALETTE.sunRain),
      hemiClear: new THREE.Color(PALETTE.hemiSkyClear),
      hemiRain: new THREE.Color(PALETTE.hemiSkyRain),
      scratch: new THREE.Color(),
    }),
    [],
  );

  useFrame((_, delta) => {
    const sun = sunRef.current;
    if (!sun) return;
    if (timeScale > 0) angle.current += delta * timeScale * SUN_ORBIT_SPEED;
    const blend = rainBlend.current;
    const fogPresence = fogBlend.current;

    // Orbit matahari (ketinggian konstan, azimuth berputar).
    const elev = SUN_ORBIT_RADIUS * Math.tan((SUN_ELEVATION_DEG * Math.PI) / 180);
    sun.position.set(
      Math.sin(angle.current) * SUN_ORBIT_RADIUS,
      TERRAIN_Y + elev,
      Math.cos(angle.current) * SUN_ORBIT_RADIUS,
    );
    sun.target.position.set(0, TERRAIN_Y, 0);
    sun.target.updateMatrixWorld();

    // Kehangatan cahaya mengikuti azimuth (siklus pagi->sore yang halus),
    // lalu ditarik ke kelabu sesuai kadar hujan.
    const warmth = (Math.sin(angle.current) + 1) / 2;
    colors.scratch.lerpColors(colors.sunNeutral, colors.sunWarm, warmth);
    sun.color.lerpColors(colors.scratch, colors.sunRain, blend);
    sun.intensity = THREE.MathUtils.lerp(1.5, 0.45, blend);

    if (hemiRef.current) {
      hemiRef.current.color.lerpColors(colors.hemiClear, colors.hemiRain, blend);
      hemiRef.current.intensity = THREE.MathUtils.lerp(
        graphicQuality === "low" ? 0.7 : 0.5,
        graphicQuality === "low" ? 0.4 : 0.25,
        blend,
      );
    }
    if (fillRef.current) {
      fillRef.current.intensity = THREE.MathUtils.lerp(
        graphicQuality === "high" ? 0.6 : 0.4,
        0.15,
        blend,
      );
    }

    // Langit & fog senada dengan cuaca (objeknya milik JSX <color>/<fog>
    // di bawah; mutasi via ref adalah pola yang diizinkan React Compiler).
    if (bgRef.current) {
      bgRef.current.lerpColors(colors.skyClear, colors.skyRain, blend);
    }
    if (fogRef.current) {
      fogRef.current.color.lerpColors(colors.fogClear, colors.fogRain, blend);
      const fogOnNear = FOG_NEAR + blend * FOG_RAIN_NEAR_SHIFT;
      const fogOnFar = FOG_FAR + blend * FOG_RAIN_FAR_SHIFT;
      fogRef.current.near = THREE.MathUtils.lerp(
        FOG_OFF_NEAR,
        fogOnNear,
        fogPresence,
      );
      fogRef.current.far = THREE.MathUtils.lerp(
        FOG_OFF_FAR,
        fogOnFar,
        fogPresence,
      );
    }
  });

  const mapSize = graphicQuality === "high" ? 2048 : 1024;

  return (
    <>
      {/* Background & fog dideklarasikan di sini (parent = scene karena Sky
          adalah anak langsung Canvas); animasi warnanya lewat ref di atas. */}
      <color ref={bgRef} attach="background" args={[PALETTE.skyClear]} />
      <fog ref={fogRef} attach="fog" args={[PALETTE.fogClear, FOG_NEAR, FOG_FAR]} />
      <hemisphereLight
        ref={hemiRef}
        args={[PALETTE.hemiSkyClear, PALETTE.hemiGround, 0.5]}
      />
      {graphicQuality !== "low" && (
        <directionalLight
          ref={fillRef}
          position={[-8, 6, -10]}
          color={PALETTE.fillLight}
        />
      )}
      <directionalLight
        ref={sunRef}
        castShadow={graphicQuality !== "low"}
        position={[10, 16, 8]}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-bias={-0.001}
      />
    </>
  );
}
