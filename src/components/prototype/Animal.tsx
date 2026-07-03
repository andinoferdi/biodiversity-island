"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { AnimalSpawn, Species } from "./species";
import {
  FOOD_SPOTS,
  NEED_MAX,
  SATISFIED_LEVEL,
  SEEK_THRESHOLD,
  WATER_SPOT,
  type AnimalStatus,
  type AnimalVitals,
  type ResourceSpot,
  type TimeScale,
} from "./simulation";

interface AnimalProps {
  spawn: AnimalSpawn;
  species: Species;
  groundY: number;
  walkRadius: number;
  timeScale: TimeScale;
  selected: boolean;
  onSelect: (id: string) => void;
  vitalsRef: React.RefObject<AnimalVitals>;
}

// Extra reach beyond a spot's visual radius that counts as "at the resource".
const CONSUME_MARGIN = 0.25;

function distanceTo(x: number, z: number, spot: ResourceSpot) {
  return Math.hypot(spot.x - x, spot.z - z);
}

function nearestFood(x: number, z: number): ResourceSpot {
  let best = FOOD_SPOTS[0];
  let bestDist = distanceTo(x, z, best);
  for (const spot of FOOD_SPOTS.slice(1)) {
    const dist = distanceTo(x, z, spot);
    if (dist < bestDist) {
      best = spot;
      bestDist = dist;
    }
  }
  return best;
}

// Deterministic per-animal starting needs so the herd doesn't seek in sync.
function initialNeed(seed: number) {
  return 12 + ((seed * 37) % 33);
}

export default function Animal({
  spawn,
  species,
  groundY,
  walkRadius,
  timeScale,
  selected,
  onSelect,
  vitalsRef,
}: AnimalProps) {
  const groupRef = useRef<Group>(null);
  // Per-frame movement and needs state lives in a ref so animation never
  // triggers React renders.
  const motion = useRef({
    x: spawn.x,
    z: spawn.z,
    heading: spawn.heading,
    headingTarget: spawn.heading,
    wanderTimer: 0,
    hunger: initialNeed(Math.round((spawn.x + 10) * 7 + (spawn.z + 10) * 13)),
    thirst: initialNeed(Math.round((spawn.z + 10) * 11 + spawn.heading * 5)),
    status: "Roaming" as AnimalStatus,
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const m = motion.current;
    // Every mutation below uses dt, so Pause (0) freezes the whole simulation
    // and 4x accelerates it uniformly and frame-rate independently.
    const dt = delta * timeScale;

    if (dt > 0) {
      m.hunger = Math.min(NEED_MAX, m.hunger + species.hungerRate * dt);
      m.thirst = Math.min(NEED_MAX, m.thirst + species.thirstRate * dt);

      const atWater =
        distanceTo(m.x, m.z, WATER_SPOT) < WATER_SPOT.radius + CONSUME_MARGIN;
      const foodSpot = nearestFood(m.x, m.z);
      const atFood =
        distanceTo(m.x, m.z, foodSpot) < foodSpot.radius + CONSUME_MARGIN;

      let moving = true;
      if (atWater && m.thirst > SATISFIED_LEVEL && m.status === "Drinking") {
        m.thirst = Math.max(0, m.thirst - species.consumeRate * dt);
        moving = false;
      } else if (atFood && m.hunger > SATISFIED_LEVEL && m.status === "Eating") {
        m.hunger = Math.max(0, m.hunger - species.consumeRate * dt);
        moving = false;
      } else if (m.thirst > SEEK_THRESHOLD) {
        if (atWater) {
          m.status = "Drinking";
          moving = false;
        } else {
          m.status = "Seeking water";
          m.headingTarget = Math.atan2(WATER_SPOT.x - m.x, WATER_SPOT.z - m.z);
        }
      } else if (m.hunger > SEEK_THRESHOLD) {
        if (atFood) {
          m.status = "Eating";
          moving = false;
        } else {
          m.status = "Seeking food";
          m.headingTarget = Math.atan2(foodSpot.x - m.x, foodSpot.z - m.z);
        }
      } else {
        m.status = "Roaming";
        // Pick a new wander direction every few seconds.
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderTimer = 2 + Math.random() * 3;
          m.headingTarget = m.heading + (Math.random() - 0.5) * Math.PI;
        }
      }

      if (moving) {
        // Near the shoreline, steer back toward the island center instead of
        // bouncing (resources all sit inside the walk radius, so this never
        // fights the seek steering for long).
        const distFromCenter = Math.hypot(m.x, m.z);
        if (m.status === "Roaming" && distFromCenter > walkRadius * 0.85) {
          m.headingTarget = Math.atan2(-m.x, -m.z);
        }

        // Turn smoothly along the shortest arc toward the target heading.
        const diff = Math.atan2(
          Math.sin(m.headingTarget - m.heading),
          Math.cos(m.headingTarget - m.heading)
        );
        m.heading += diff * Math.min(1, species.turnSpeed * dt);

        m.x += Math.sin(m.heading) * species.moveSpeed * dt;
        m.z += Math.cos(m.heading) * species.moveSpeed * dt;

        // Hard clamp as a safety net so the animal can never leave the grass.
        const dist = Math.hypot(m.x, m.z);
        if (dist > walkRadius) {
          m.x *= walkRadius / dist;
          m.z *= walkRadius / dist;
        }
      }
    }

    group.position.set(m.x, groundY, m.z);
    group.rotation.y = m.heading;

    // Only the selected animal feeds the UI panel, so skip the write
    // otherwise. Written even while paused so the panel stays readable.
    if (selected) {
      const vitals = vitalsRef.current;
      vitals.x = m.x;
      vitals.z = m.z;
      vitals.hunger = m.hunger;
      vitals.thirst = m.thirst;
      vitals.status = m.status;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(spawn.id);
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "";
  };

  const emissive = selected ? species.accentColor : "#000000";

  return (
    <group
      ref={groupRef}
      position={[spawn.x, groundY, spawn.z]}
      rotation={[0, spawn.heading, 0]}
      scale={species.scale}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.6, 0.5, 1.1]} />
        <meshStandardMaterial color={species.bodyColor} emissive={emissive} />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0.65]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial color={species.bodyColor} emissive={emissive} />
      </mesh>
      {[
        [-0.2, 0.45],
        [0.2, 0.45],
        [-0.2, -0.45],
        [0.2, -0.45],
      ].map(([lx, lz]) => (
        <mesh key={`${lx},${lz}`} castShadow position={[lx, 0.15, lz]}>
          <boxGeometry args={[0.14, 0.3, 0.14]} />
          <meshStandardMaterial color={species.accentColor} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.6, -0.65]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.35]} />
        <meshStandardMaterial color={species.accentColor} />
      </mesh>
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 40]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}
    </group>
  );
}
