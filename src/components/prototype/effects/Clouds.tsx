"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TERRAIN_Y } from "../terrain";
import type { TimeScale } from "../simulation";
import { PALETTE, seededRandom, useEasedBlend, WIND } from "./weather";

const CLOUD_COUNT = 8;
const LOBES_MIN = 4;
const LOBES_MAX = 6;
const AREA_HALF = 17; // awan drift dalam kotak 34x34 lalu wrap
const ALTITUDE_MIN = 5.2;
const ALTITUDE_MAX = 6.6;
const RAIN_SINK = 0.8; // saat hujan, posisi awan turun sedikit
const SHADOW_SCALE = 5.5;
const LAYOUT_SEED = 20260706;

interface Lobe {
  ox: number;
  oy: number;
  oz: number;
  scale: number;
  tone: number; // 0.94..1 variasi keabuan halus, di-bake ke instanceColor
}
interface CloudSpec {
  lobes: Lobe[];
  y: number;
  driftScale: number; // awan tinggi bergerak sedikit lebih cepat
  startX: number;
  startZ: number;
}

function buildClouds(): { clouds: CloudSpec[]; totalLobes: number } {
  const rand = seededRandom(LAYOUT_SEED);
  const clouds: CloudSpec[] = [];
  let totalLobes = 0;
  for (let c = 0; c < CLOUD_COUNT; c++) {
    const lobeCount =
      LOBES_MIN + Math.floor(rand() * (LOBES_MAX - LOBES_MIN + 1));
    const lobes: Lobe[] = [];
    for (let l = 0; l < lobeCount; l++) {
      // Lobus tersusun memanjang tegak-lurus arah pandang umum, menonjol
      // di tengah sehingga siluetnya seperti kumulus low-poly.
      const t = lobeCount === 1 ? 0.5 : l / (lobeCount - 1);
      const along = (t - 0.5) * (1.7 + rand() * 0.8);
      const bulge = 1 - Math.abs(t - 0.5) * 1.4;
      lobes.push({
        ox: along + (rand() - 0.5) * 0.4,
        oy: bulge * (0.25 + rand() * 0.3),
        oz: (rand() - 0.5) * 0.9,
        scale: 0.55 + bulge * 0.75 + rand() * 0.3,
        tone: 0.94 + rand() * 0.06,
      });
    }
    clouds.push({
      lobes,
      y: ALTITUDE_MIN + rand() * (ALTITUDE_MAX - ALTITUDE_MIN),
      driftScale: 0.8 + rand() * 0.5,
      startX: (rand() - 0.5) * 2 * AREA_HALF,
      startZ: (rand() - 0.5) * 2 * AREA_HALF,
    });
    totalLobes += lobeCount;
  }
  return { clouds, totalLobes };
}

function makeShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.4)");
  g.addColorStop(0.5, "rgba(0,0,0,0.22)");
  g.addColorStop(0.8, "rgba(0,0,0,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

interface CloudsProps {
  isRaining: boolean;
  timeScale: TimeScale;
}

export default function Clouds({ isRaining, timeScale }: CloudsProps) {
  const lobeMeshRef = useRef<THREE.InstancedMesh>(null);
  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainBlend = useEasedBlend(isRaining);

  const { clouds, totalLobes } = useMemo(() => buildClouds(), []);
  const shadowTexture = useMemo(() => makeShadowTexture(), []);
  // Simpan pusat setiap awan di ref. Jangan mutasi hasil useMemo karena
  // pola tersebut melanggar react-hooks/immutability.
  const centers = useRef(
    clouds.map((c) => ({ x: c.startX, z: c.startZ })),
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(
    () => ({
      clear: new THREE.Color(PALETTE.cloudClear),
      rain: new THREE.Color(PALETTE.cloudRain),
      tone: new THREE.Color(),
    }),
    [],
  );

  // Bake variasi tone setiap lobus satu kali. Animasi warna cuaca cukup
  // mengubah material.color tanpa menulis instanceColor setiap frame.
  useEffect(() => {
    const mesh = lobeMeshRef.current;
    if (!mesh) return;
    let i = 0;
    for (const spec of clouds) {
      for (const lobe of spec.lobes) {
        colors.tone.setScalar(lobe.tone);
        mesh.setColorAt(i, colors.tone);
        i++;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [clouds, colors]);

  useFrame((_, delta) => {
    const lobeMesh = lobeMeshRef.current;
    const shadowMesh = shadowMeshRef.current;
    if (!lobeMesh) return;
    const move = delta * timeScale;
    const blend = rainBlend.current;

    const mat = lobeMesh.material as THREE.MeshLambertMaterial;
    mat.color.lerpColors(colors.clear, colors.rain, blend);

    let i = 0;
    for (let c = 0; c < clouds.length; c++) {
      const spec = clouds[c];
      const center = centers.current[c];
      center.x += WIND.x * WIND.speed * spec.driftScale * move;
      center.z += WIND.z * WIND.speed * spec.driftScale * move;
      // Wrap-around agar langit tidak pernah kosong.
      if (center.x < -AREA_HALF) center.x += AREA_HALF * 2;
      if (center.x > AREA_HALF) center.x -= AREA_HALF * 2;
      if (center.z < -AREA_HALF) center.z += AREA_HALF * 2;
      if (center.z > AREA_HALF) center.z -= AREA_HALF * 2;

      const y = spec.y - blend * RAIN_SINK;

      for (const lobe of spec.lobes) {
        dummy.position.set(center.x + lobe.ox, y + lobe.oy, center.z + lobe.oz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(lobe.scale, lobe.scale * 0.72, lobe.scale);
        dummy.updateMatrix();
        lobeMesh.setMatrixAt(i, dummy.matrix);
        i++;
      }

      if (shadowMesh) {
        dummy.position.set(center.x, TERRAIN_Y + 0.05, center.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(SHADOW_SCALE);
        dummy.updateMatrix();
        shadowMesh.setMatrixAt(c, dummy.matrix);
      }
    }
    lobeMesh.instanceMatrix.needsUpdate = true;
    if (shadowMesh) shadowMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Lobus awan low-poly dengan flat shading yang menyatu dengan gaya pulau */}
      <instancedMesh ref={lobeMeshRef} args={[undefined, undefined, totalLobes]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshLambertMaterial flatShading transparent opacity={0.92} />
      </instancedMesh>
      {/* Bayangan decal lembut untuk setiap awan */}
      <instancedMesh ref={shadowMeshRef} args={[undefined, undefined, CLOUD_COUNT]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
