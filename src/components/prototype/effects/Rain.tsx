"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleGround } from "../terrain";
import type { TimeScale } from "../simulation";
import type { GraphicQuality } from "../IslandScene";
import { RAIN_TIERS, useEasedBlend, WIND } from "./weather";

const SPAWN_AREA = 20;
const FALL_SPEED_MIN = 9;
const FALL_SPEED_VAR = 4;
const SPAWN_Y_MIN = 6;
const SPAWN_Y_VAR = 3;
const WIND_PUSH = 1.6; // seberapa jauh angin menggeser tetes per detik
const STREAK_TILT = 0.35; // kemiringan streak mengikuti WIND
const SPLASH_LIFE_MIN = 0.15;
const SPLASH_LIFE_VAR = 0.1;
const HIDDEN_Y = -10;

interface Drop { x: number; y: number; z: number; speed: number }
interface Splash { x: number; y: number; z: number; age: number; life: number }

function makeStreakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(214,230,245,0)");
  g.addColorStop(0.35, "rgba(214,230,245,0.85)");
  g.addColorStop(0.75, "rgba(214,230,245,0.85)");
  g.addColorStop(1, "rgba(214,230,245,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  return new THREE.CanvasTexture(canvas);
}

interface RainProps {
  isRaining: boolean;
  timeScale: TimeScale;
  graphicQuality: GraphicQuality;
}

export default function Rain({ isRaining, timeScale, graphicQuality }: RainProps) {
  const tier = RAIN_TIERS[graphicQuality];
  const dropsMeshRef = useRef<THREE.InstancedMesh>(null);
  const splashMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainBlend = useEasedBlend(isRaining);
  const streakTexture = useMemo(() => makeStreakTexture(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Kemiringan streak mengikuti arah WIND yang sama dengan efek lain.
  const tiltZ = -WIND.x * STREAK_TILT;
  const tiltX = WIND.z * STREAK_TILT;

  const drops = useRef<Drop[] | null>(null);
  const splashes = useRef<Splash[] | null>(null);
  const splashCursor = useRef(0);

  useFrame((_, delta) => {
    // Inisialisasi malas di frame loop: Math.random() dilarang saat render
    // (react-hooks/purity), tetapi diizinkan di dalam useFrame.
    if (drops.current === null) {
      drops.current = Array.from({ length: tier.drops }, () => ({
        x: (Math.random() - 0.5) * SPAWN_AREA,
        y: Math.random() * (SPAWN_Y_MIN + SPAWN_Y_VAR),
        z: (Math.random() - 0.5) * SPAWN_AREA,
        speed: FALL_SPEED_MIN + Math.random() * FALL_SPEED_VAR,
      }));
      splashes.current = Array.from(
        { length: Math.max(1, tier.splashes) },
        () => ({ x: 0, y: HIDDEN_Y, z: 0, age: 1, life: SPLASH_LIFE_MIN }),
      );
    }
    const dropsMesh = dropsMeshRef.current;
    if (!dropsMesh || !drops.current || !splashes.current) return;
    const blend = rainBlend.current;
    dropsMesh.visible = blend > 0.01;
    if (splashMeshRef.current) {
      splashMeshRef.current.visible = blend > 0.01 && tier.splashes > 0;
    }
    if (blend <= 0.01 || timeScale === 0) return;

    const move = delta * timeScale;
    const active = Math.floor(tier.drops * blend);

    for (let i = 0; i < tier.drops; i++) {
      const p = drops.current[i];
      if (i >= active) {
        dummy.position.set(0, HIDDEN_Y, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        dropsMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.y -= p.speed * move;
      p.x += WIND.x * WIND_PUSH * move;
      p.z += WIND.z * WIND_PUSH * move;

      const ground = sampleGround(p.x, p.z);
      const groundY = ground ? ground.y : -2;
      if (p.y < groundY + 0.1) {
        if (ground && tier.splashes > 0) {
          const s = splashes.current[splashCursor.current];
          s.x = p.x;
          s.y = groundY + 0.04;
          s.z = p.z;
          s.age = 0;
          s.life = SPLASH_LIFE_MIN + Math.random() * SPLASH_LIFE_VAR;
          splashCursor.current = (splashCursor.current + 1) % tier.splashes;
        }
        p.y = SPAWN_Y_MIN + Math.random() * SPAWN_Y_VAR;
        for (let attempt = 0; attempt < 5; attempt++) {
          const tx = (Math.random() - 0.5) * SPAWN_AREA;
          const tz = (Math.random() - 0.5) * SPAWN_AREA;
          if (sampleGround(tx, tz)) {
            p.x = tx;
            p.z = tz;
            break;
          }
        }
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(tiltX, 0, tiltZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dropsMesh.setMatrixAt(i, dummy.matrix);
    }
    dropsMesh.instanceMatrix.needsUpdate = true;

    const splashMesh = splashMeshRef.current;
    if (splashMesh && tier.splashes > 0) {
      for (let i = 0; i < tier.splashes; i++) {
        const s = splashes.current[i];
        s.age += move;
        if (s.age < s.life) {
          const t = s.age / s.life;
          dummy.position.set(s.x, s.y, s.z);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.setScalar(0.4 + t * 0.9);
        } else {
          dummy.position.set(0, HIDDEN_Y, 0);
          dummy.scale.setScalar(0);
        }
        dummy.updateMatrix();
        splashMesh.setMatrixAt(i, dummy.matrix);
      }
      splashMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={dropsMeshRef} args={[undefined, undefined, tier.drops]}>
        <planeGeometry args={[0.02, 0.55]} />
        <meshBasicMaterial
          map={streakTexture}
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={splashMeshRef}
        args={[undefined, undefined, Math.max(1, tier.splashes)]}
      >
        <ringGeometry args={[0.03, 0.055, 10]} />
        <meshBasicMaterial
          color="#dbe9f4"
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
