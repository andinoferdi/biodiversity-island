"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Satu sumber kebenaran untuk seluruh efek atmosfer. Awan drift, slant
// hujan, dan bias sway pohon membaca WIND yang sama sehingga semuanya
// bergerak searah - itu kunci tampilan yang "klop".
export const WIND = { x: -0.55, z: 0.18, speed: 0.45 };

// Semua transisi cuaca (warna langit, intensitas cahaya, kepadatan hujan,
// warna awan) di-ease dengan durasi ini alih-alih berubah instan.
export const WEATHER_FADE_SECONDS = 2.5;

export const PALETTE = {
  skyClear: "#7eb2e6",
  skyRain: "#55616e",
  fogClear: "#9cc3e8",
  fogRain: "#5f6b77",
  sunWarm: "#ffe3b3",    // saat matahari rendah di orbitnya
  sunNeutral: "#fff6e8", // saat matahari "tinggi"
  sunRain: "#9fb2c4",
  hemiSkyClear: "#bfd9ff",
  hemiSkyRain: "#7a8c9e",
  hemiGround: "#3f5a36",
  cloudClear: "#f5f8fb",
  cloudRain: "#8b98a6",
  fillLight: "#a8c4e0",
} as const;

// Kepadatan partikel hujan per tier kualitas (Low melewatkan splash).
export const RAIN_TIERS = {
  low: { drops: 150, splashes: 0 },
  medium: { drops: 300, splashes: 60 },
  high: { drops: 500, splashes: 100 },
} as const;

// Mulberry32: penempatan awan deterministik antar reload (aturan repo -
// tidak ada Math.random() di useMemo/render).
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Blend 0..1 yang mengejar target boolean dengan kecepatan konstan.
// Ref, bukan state: dibaca tiap frame oleh komponen efek tanpa re-render.
export function useEasedBlend(
  target: boolean,
  seconds: number = WEATHER_FADE_SECONDS,
) {
  const blend = useRef(target ? 1 : 0);
  useFrame((_, delta) => {
    const goal = target ? 1 : 0;
    const step = delta / seconds;
    if (blend.current < goal) blend.current = Math.min(goal, blend.current + step);
    else if (blend.current > goal) blend.current = Math.max(goal, blend.current - step);
  });
  return blend;
}
