"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TimeScale } from "../simulation";
import { PALETTE, seededRandom, useEasedBlend, WIND } from "./weather";

const FOG_BANK_COUNT = 18;
const AREA_HALF = 12;
const LAYOUT_SEED = 20260707;
const BASE_Y = 0.72;
const Y_VARIATION = 0.28;
const BASE_OPACITY = 0.16;
const CURTAIN_OPACITY = 0.08;
const CURTAIN_HEIGHT = 1.35;
const RAIN_OPACITY_BOOST = 0.08;
const BANK_SCALE_MIN = 3.8;
const BANK_SCALE_MAX = 7.2;
const DRIFT_SPEED = 0.12;
const HIDDEN_Y = -10;

interface FogBank {
  x: number;
  z: number;
  y: number;
  scaleX: number;
  scaleZ: number;
  rotY: number;
  driftScale: number;
}

interface FogLayerProps {
  isFoggy: boolean;
  isRaining: boolean;
  timeScale: TimeScale;
}

function makeFogTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context is required for fog texture");
  }

  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,0.75)");
  gradient.addColorStop(0.45, "rgba(255,255,255,0.38)");
  gradient.addColorStop(0.78, "rgba(255,255,255,0.10)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildFogBanks(): FogBank[] {
  const rand = seededRandom(LAYOUT_SEED);
  return Array.from({ length: FOG_BANK_COUNT }, () => {
    const angle = rand() * Math.PI * 2;
    const radius = Math.sqrt(rand()) * AREA_HALF;
    const scale = BANK_SCALE_MIN + rand() * (BANK_SCALE_MAX - BANK_SCALE_MIN);

    return {
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      y: BASE_Y + (rand() - 0.5) * Y_VARIATION,
      scaleX: scale * (1.2 + rand() * 0.9),
      scaleZ: scale * (0.45 + rand() * 0.35),
      rotY: rand() * Math.PI,
      driftScale: 0.65 + rand() * 0.7,
    };
  });
}

export default function FogLayer({
  isFoggy,
  isRaining,
  timeScale,
}: FogLayerProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const curtainRef = useRef<THREE.InstancedMesh>(null);
  const fogBlend = useEasedBlend(isFoggy);
  const rainBlend = useEasedBlend(isRaining);
  const banks = useMemo(() => buildFogBanks(), []);
  const texture = useMemo(() => makeFogTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const centers = useRef(banks.map((bank) => ({ x: bank.x, z: bank.z })));
  const colors = useMemo(
    () => ({
      clear: new THREE.Color(PALETTE.fogClear),
      rain: new THREE.Color(PALETTE.fogRain),
    }),
    [],
  );

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current;
    const curtains = curtainRef.current;
    if (!mesh || !curtains) return;

    const fogPresence = fogBlend.current;
    const storm = rainBlend.current;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const curtainMaterial = curtains.material as THREE.MeshBasicMaterial;
    material.color.lerpColors(colors.clear, colors.rain, storm);
    material.opacity = (BASE_OPACITY + storm * RAIN_OPACITY_BOOST) * fogPresence;
    curtainMaterial.color.copy(material.color);
    curtainMaterial.opacity =
      (CURTAIN_OPACITY + storm * RAIN_OPACITY_BOOST * 0.45) * fogPresence;
    mesh.visible = fogPresence > 0.01;
    curtains.visible = mesh.visible;

    const move = delta * timeScale;
    for (let i = 0; i < banks.length; i++) {
      const bank = banks[i];
      const center = centers.current[i];
      center.x += WIND.x * DRIFT_SPEED * bank.driftScale * move;
      center.z += WIND.z * DRIFT_SPEED * bank.driftScale * move;
      if (center.x < -AREA_HALF) center.x += AREA_HALF * 2;
      if (center.x > AREA_HALF) center.x -= AREA_HALF * 2;
      if (center.z < -AREA_HALF) center.z += AREA_HALF * 2;
      if (center.z > AREA_HALF) center.z -= AREA_HALF * 2;

      dummy.position.set(
        center.x,
        fogPresence > 0.01 ? bank.y : HIDDEN_Y,
        center.z,
      );
      dummy.rotation.set(-Math.PI / 2, 0, bank.rotY);
      dummy.scale.set(bank.scaleX, bank.scaleZ, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      dummy.position.set(
        center.x,
        fogPresence > 0.01 ? bank.y + CURTAIN_HEIGHT * 0.5 : HIDDEN_Y,
        center.z,
      );
      dummy.lookAt(camera.position.x, bank.y + CURTAIN_HEIGHT * 0.5, camera.position.z);
      dummy.scale.set(bank.scaleX * 0.72, CURTAIN_HEIGHT, 1);
      dummy.updateMatrix();
      curtains.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    curtains.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, FOG_BANK_COUNT]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={BASE_OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={curtainRef}
        args={[undefined, undefined, FOG_BANK_COUNT]}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={texture}
          transparent
          opacity={CURTAIN_OPACITY}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </>
  );
}
