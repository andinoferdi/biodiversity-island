"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";
import type { AnimalSpawn, Species } from "./species";
import { biomeAt, getBiome } from "./biomes";
import {
  DEATH_AFTER_CRITICAL,
  FOOD_SPOTS,
  NEED_MAX,
  REPRODUCE_AFTER,
  REPRODUCTION_NEED_PENALTY,
  SATISFIED_LEVEL,
  SEEK_THRESHOLD,
  WATER_SPOTS,
  WELL_FED_LEVEL,
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
  onDeath: (id: string) => void;
  onReproduce: (parent: AnimalSpawn, x: number, z: number, heading: number) => void;
  vitalsRef: React.RefObject<AnimalVitals>;
}

// Extra reach beyond a spot's visual radius that counts as "at the resource".
const CONSUME_MARGIN = 0.25;

function distanceTo(x: number, z: number, spot: ResourceSpot) {
  return Math.hypot(spot.x - x, spot.z - z);
}

function nearest(x: number, z: number, spots: ResourceSpot[]): ResourceSpot {
  let best = spots[0];
  let bestDist = distanceTo(x, z, best);
  for (const spot of spots.slice(1)) {
    const dist = distanceTo(x, z, spot);
    if (dist < bestDist) {
      best = spot;
      bestDist = dist;
    }
  }
  return best;
}

// Nearest spot inside the species' home biome; if that biome has none
// (e.g. the forest has no own pond), fall back to the global nearest.
function nearestForBiome(
  x: number,
  z: number,
  spots: ResourceSpot[],
  biomeId: Species["biomeId"]
): ResourceSpot {
  const own = spots.filter((spot) => spot.biomeId === biomeId);
  return nearest(x, z, own.length > 0 ? own : spots);
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
  onDeath,
  onReproduce,
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
    hunger:
      spawn.initialHunger ??
      initialNeed(Math.round((spawn.x + 10) * 7 + (spawn.z + 10) * 13)),
    thirst:
      spawn.initialThirst ??
      initialNeed(Math.round((spawn.z + 10) * 11 + spawn.heading * 5)),
    status: "Roaming" as AnimalStatus,
    criticalTimer: 0,
    wellFedTimer: 0,
    hasDied: false,
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const m = motion.current;
    if (m.hasDied) return;
    // Every mutation below uses dt, so Pause (0) freezes the whole simulation
    // and 4x accelerates it uniformly and frame-rate independently.
    const dt = delta * timeScale;

    if (dt > 0) {
      m.hunger = Math.min(NEED_MAX, m.hunger + species.hungerRate * dt);
      m.thirst = Math.min(NEED_MAX, m.thirst + species.thirstRate * dt);

      // Death: a need pinned at NEED_MAX starts the critical timer; leaving
      // the pinned state resets it.
      if (m.hunger >= NEED_MAX || m.thirst >= NEED_MAX) {
        m.criticalTimer += dt;
        if (m.criticalTimer >= DEATH_AFTER_CRITICAL) {
          m.hasDied = true;
          onDeath(spawn.id);
          return;
        }
      } else {
        m.criticalTimer = 0;
      }

      // Reproduction: both needs kept low continuously; the population cap
      // is enforced by the parent component.
      if (m.hunger < WELL_FED_LEVEL && m.thirst < WELL_FED_LEVEL) {
        m.wellFedTimer += dt;
        if (m.wellFedTimer >= REPRODUCE_AFTER) {
          m.wellFedTimer = 0;
          m.hunger = Math.min(NEED_MAX, m.hunger + REPRODUCTION_NEED_PENALTY);
          m.thirst = Math.min(NEED_MAX, m.thirst + REPRODUCTION_NEED_PENALTY);
          onReproduce(spawn, m.x, m.z, m.heading);
        }
      } else {
        m.wellFedTimer = 0;
      }

      const waterSpot = nearestForBiome(m.x, m.z, WATER_SPOTS, species.biomeId);
      const atWater =
        distanceTo(m.x, m.z, waterSpot) < waterSpot.radius + CONSUME_MARGIN;
      const foodSpot = nearestForBiome(m.x, m.z, FOOD_SPOTS, species.biomeId);
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
          m.headingTarget = Math.atan2(waterSpot.x - m.x, waterSpot.z - m.z);
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

      // A pinned need overrides the status label so the panel telegraphs
      // impending death (thirst wins ties); behavior above still runs.
      if (m.criticalTimer > 0) {
        m.status = m.thirst >= NEED_MAX ? "Dehydrated" : "Starving";
      }

      if (moving) {
        // Soft habitat boundary: a roaming animal that wandered out of its
        // home biome steers toward the biome's center (same mechanism as the
        // shoreline steer — no hard wall, seek steering is untouched).
        if (
          m.status === "Roaming" &&
          biomeAt(m.x, m.z).id !== species.biomeId
        ) {
          const home = getBiome(species.biomeId);
          m.headingTarget = Math.atan2(home.centerX - m.x, home.centerZ - m.z);
        }

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
