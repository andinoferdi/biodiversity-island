"use client";

import { Suspense, useEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { MathUtils, type Group } from "three";
import AnimalModel from "./AnimalModel";
import type { AnimalSpawn, Species } from "./species";
import { biomeForHeight } from "./biomes";
import { nearestWaterEdge, sampleGround, type GroundSample, VEGETATION } from "./terrain";
import {
  DEATH_AFTER_CRITICAL,
  FOOD_SPOTS,
  MIN_GROUND_NORMAL_Y,
  NEED_MAX,
  REPRODUCE_AFTER,
  REPRODUCTION_NEED_PENALTY,
  SATISFIED_LEVEL,
  SEEK_THRESHOLD,
  WALK_RADIUS,
  WELL_FED_LEVEL,
  type AnimalStatus,
  type AnimalVitals,
  type ResourceSpot,
  type TimeScale,
} from "./simulation";

interface AnimalProps {
  spawn: AnimalSpawn;
  species: Species;
  timeScale: TimeScale;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeath: (id: string) => void;
  onReproduce: (parent: AnimalSpawn, x: number, z: number, heading: number) => void;
  vitalsRef: React.RefObject<AnimalVitals>;
}

// Extra reach beyond a spot's visual radius that counts as "at the resource".
const CONSUME_MARGIN = 0.25;
// Distance to a river-bank point that counts as "standing at the water".
const DRINK_RANGE = 0.6;
// How far ahead a candidate wander heading is validated against the terrain.
const WANDER_LOOKAHEAD = 1.5;
// Random headings tried before giving up and keeping the current one.
const WANDER_TRIES = 8;
// How quickly the visual Y eases toward the raycast ground height.
const GROUND_SNAP_SPEED = 12;

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

// Fish graze the river food patch; everyone else eats on land.
function foodSpotsFor(species: Species): ResourceSpot[] {
  const biomeId = species.locomotion === "aquatic" ? "river" : "land";
  return FOOD_SPOTS.filter((spot) => spot.biomeId === biomeId);
}

// Whether this species may stand on the sampled surface: cliffs block
// everyone, water blocks land animals, land blocks fish, ducks go anywhere.
function canOccupy(species: Species, sample: GroundSample): boolean {
  if (sample.normalY < MIN_GROUND_NORMAL_Y) return false;
  if (species.locomotion === "aquatic") return sample.water;
  if (species.locomotion === "terrestrial") return !sample.water;
  return true;
}

// Deterministic per-animal starting needs so the herd doesn't seek in sync.
function initialNeed(seed: number) {
  return 12 + ((seed * 37) % 33);
}

export default function Animal({
  spawn,
  species,
  timeScale,
  selected,
  onSelect,
  onDeath,
  onReproduce,
  vitalsRef,
}: AnimalProps) {
  const groupRef = useRef<Group>(null);

  const keys = useRef({
    w: false,
    a: false,
    s: false,
    d: false,
    ArrowUp: false,
    ArrowLeft: false,
    ArrowDown: false,
    ArrowRight: false,
  });

  useEffect(() => {
    if (!selected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key in keys.current) {
        keys.current[e.key as keyof typeof keys.current] = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key in keys.current) {
        keys.current[e.key as keyof typeof keys.current] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      
      // Reset keys when deselected
      Object.keys(keys.current).forEach(k => {
        keys.current[k as keyof typeof keys.current] = false;
      });
    };
  }, [selected]);

  // Read by AnimalModel every frame to pick the deer's animation clip.
  const statusRef = useRef<AnimalStatus>("Roaming");
  // Per-frame movement and needs state lives in a ref so animation never
  // triggers React renders.
  const motion = useRef({
    x: spawn.x,
    z: spawn.z,
    y: 0,
    // Snap to the ground on the first sampled frame, ease afterwards.
    placed: false,
    heading: spawn.heading,
    headingTarget: spawn.heading,
    visualHeading: spawn.heading,
    wanderTimer: 0,
    avoidanceTimer: 0,
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

    // Dynamic ground contact: one ray straight down at the current (X, Z).
    // No hit means the terrain is still streaming in — stay parked until
    // there is ground to stand on.
    let here = sampleGround(m.x, m.z);
    if (!here) return;

    // Every mutation below uses dt, so Pause (0) freezes the whole simulation
    // and 4x accelerates it uniformly and frame-rate independently.
    const dt = delta * timeScale;

    if (dt > 0) {
      m.avoidanceTimer = Math.max(0, m.avoidanceTimer - dt);

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

      if (selected) {
        m.status = "Idle";
        const k = keys.current;
        let turn = 0;
        let forward = 0;

        if (k.w || k.ArrowUp) forward = 1;
        if (k.s || k.ArrowDown) forward = -1;
        if (k.a || k.ArrowLeft) turn = 1;
        if (k.d || k.ArrowRight) turn = -1;

        if (turn !== 0) {
          m.heading += turn * species.turnSpeed * dt * 2.0;
          m.headingTarget = m.heading;
        }

        if (forward !== 0) {
          m.status = "Roaming";
          const speed = species.moveSpeed * dt * forward;
          const nextX = m.x + Math.sin(m.heading) * speed;
          const nextZ = m.z + Math.cos(m.heading) * speed;
          const ahead = sampleGround(nextX, nextZ);

          let hitVeg = false;
          if (species.id !== "hawk") {
            for (const v of VEGETATION) {
              const r = species.selectionRadius * 0.5 + 0.35;
              const nd = Math.hypot(v.x - nextX, v.z - nextZ);
              if (nd < r) {
                const cd = Math.hypot(v.x - m.x, v.z - m.z);
                if (nd <= cd) {
                  hitVeg = true;
                  break;
                }
              }
            }
          }

          const stranded = !canOccupy(species, here);
          const isWorldEdge = !ahead;
          const isCliff = ahead && ahead.normalY < MIN_GROUND_NORMAL_Y;
          const isBiomeBorder = ahead && !stranded && !canOccupy(species, ahead);
          const isObstacle = isWorldEdge || isCliff || isBiomeBorder || hitVeg;

          if (!isObstacle) {
            m.x = nextX;
            m.z = nextZ;
            here = ahead;
          }
        }

        if (m.criticalTimer > 0) {
          m.status = m.thirst >= NEED_MAX ? "Dehydrated" : "Starving";
        }
      } else {
        const foodSpot = nearest(m.x, m.z, foodSpotsFor(species));
        const atFood =
          distanceTo(m.x, m.z, foodSpot) < foodSpot.radius + CONSUME_MARGIN;

        // "At water": swimmers and waders drink wherever they float; land
        // animals must stand next to the nearest river-bank point.
        const waterEdge =
          species.locomotion === "terrestrial"
            ? nearestWaterEdge(m.x, m.z)
            : null;
        const atWater =
          species.locomotion === "terrestrial"
            ? waterEdge !== null &&
              Math.hypot(waterEdge.x - m.x, waterEdge.z - m.z) < DRINK_RANGE
            : here.water;

        let moving = true;
        if (atWater && m.thirst > SATISFIED_LEVEL && m.status === "Drinking") {
          m.thirst = Math.max(0, m.thirst - species.consumeRate * dt);
          if (!species.neverStops) moving = false;
        } else if (atFood && m.hunger > SATISFIED_LEVEL && m.status === "Eating") {
          m.hunger = Math.max(0, m.hunger - species.consumeRate * dt);
          if (!species.neverStops) moving = false;
        } else if (m.thirst > SEEK_THRESHOLD) {
          if (atWater) {
            m.status = "Drinking";
            moving = false;
          } else {
            m.status = "Seeking water";
            // Head for the nearest river bank (ducks on land included; fish
            // are always in water, so they never reach this branch).
            const target = waterEdge ?? nearestWaterEdge(m.x, m.z);
            if (target && m.avoidanceTimer <= 0) {
              m.headingTarget = Math.atan2(target.x - m.x, target.z - m.z);
            }
          }
        } else if (m.hunger > SEEK_THRESHOLD) {
          if (atFood) {
            m.status = "Eating";
            moving = false;
          } else {
            m.status = "Seeking food";
            if (m.avoidanceTimer <= 0) {
              m.headingTarget = Math.atan2(foodSpot.x - m.x, foodSpot.z - m.z);
            }
          }
        } else {
          m.status = "Roaming";
          // Pick a new wander direction every few seconds, validated against
          // the terrain: the look-ahead point must be standable for this
          // species (fish stay in the river, land animals stay off it).
          m.wanderTimer -= dt;
          if (m.wanderTimer <= 0) {
            m.wanderTimer = 2 + Math.random() * 3;
            for (let attempt = 0; attempt < WANDER_TRIES; attempt++) {
              const spread = attempt === 0 ? Math.PI : Math.PI * 2;
              const candidate = m.heading + (Math.random() - 0.5) * spread;
              const look = sampleGround(
                m.x + Math.sin(candidate) * WANDER_LOOKAHEAD,
                m.z + Math.cos(candidate) * WANDER_LOOKAHEAD
              );
              if (look && canOccupy(species, look)) {
                m.headingTarget = candidate;
                break;
              }
            }
          }
        }

        // A pinned need overrides the status label so the panel telegraphs
        // impending death (thirst wins ties); behavior above still runs.
        if (m.criticalTimer > 0) {
          m.status = m.thirst >= NEED_MAX ? "Dehydrated" : "Starving";
        }

        if (moving) {
          // Self-rescue: standing somewhere invalid (e.g. offspring dropped on
          // the wrong side of the bank) — head for the nearest bank, which is
          // the shortest way back to legal ground for fish and land animals
          // alike. Entry into the next cell is not blocked in this state.
          const stranded = !canOccupy(species, here);
          if (stranded) {
            const edge = nearestWaterEdge(m.x, m.z);
            if (edge) {
              m.headingTarget = Math.atan2(edge.x - m.x, edge.z - m.z);
            }
          }

          // Soft roam boundary: species with an extended roam radius (e.g. the
          // hawk, which soars beyond the terrain mesh) steer back toward the
          // center before a raycast miss would register as a world edge.
          const effectiveRadius = species.roamRadius ?? WALK_RADIUS;
          const distFromCenter = Math.hypot(m.x, m.z);
          if (
            !stranded &&
            m.status === "Roaming" &&
            distFromCenter > effectiveRadius * 0.85
          ) {
            m.headingTarget = Math.atan2(-m.x, -m.z);
          }

          // Turn smoothly along the shortest arc toward the target heading.
          const diff = Math.atan2(
            Math.sin(m.headingTarget - m.heading),
            Math.cos(m.headingTarget - m.heading)
          );
          m.heading += diff * Math.min(1, species.turnSpeed * dt);

          const nextX = m.x + Math.sin(m.heading) * species.moveSpeed * dt;
          const nextZ = m.z + Math.cos(m.heading) * species.moveSpeed * dt;
          const ahead = sampleGround(nextX, nextZ);

          let hitVeg = false;
          if (species.id !== "hawk") {
            for (const v of VEGETATION) {
              const r = species.selectionRadius * 0.5 + 0.35;
              const nd = Math.hypot(v.x - nextX, v.z - nextZ);
              if (nd < r) {
                const cd = Math.hypot(v.x - m.x, v.z - m.z);
                if (nd <= cd) {
                  hitVeg = true;
                  break;
                }
              }
            }
          }

          const isWorldEdge = !ahead;
          const isCliff = ahead && ahead.normalY < MIN_GROUND_NORMAL_Y;
          const isBiomeBorder = ahead && !stranded && !canOccupy(species, ahead);
          const isObstacle = isWorldEdge || isCliff || isBiomeBorder || hitVeg;

          if (isObstacle) {
            const diffTarget = Math.atan2(
              Math.sin(m.headingTarget - m.heading),
              Math.cos(m.headingTarget - m.heading)
            );
            
            if (m.avoidanceTimer <= 0 || Math.abs(diffTarget) < 0.1) {
              if (isWorldEdge) {
                m.headingTarget = Math.atan2(-m.x, -m.z);
              } else {
                m.headingTarget = m.heading + Math.PI * (0.75 + Math.random() * 0.5);
              }
              m.avoidanceTimer = 2.5;
            }
          } else {
            m.x = nextX;
            m.z = nextZ;
            here = ahead;
          }

          // Hard clamp as a final safety net (mainly for species like the
          // hawk whose roamRadius extends past the terrain mesh) so nothing
          // can drift arbitrarily far even if the raycast checks above miss.
          const dist = Math.hypot(m.x, m.z);
          if (dist > effectiveRadius) {
            m.x *= effectiveRadius / dist;
            m.z *= effectiveRadius / dist;
          }
        }
      }
    }

    // Follow the terrain contour: snap on the first placed frame, then ease
    // so low-poly face seams don't make the animal pop.
    m.y = m.placed
      ? MathUtils.lerp(m.y, here.y, Math.min(1, delta * GROUND_SNAP_SPEED))
      : here.y;
    m.placed = true;
    group.position.set(m.x, m.y, m.z);

    let targetVisual = m.heading;
    if (selected && (keys.current.s || keys.current.ArrowDown) && !keys.current.w && !keys.current.ArrowUp) {
      targetVisual += Math.PI;
    }
    const diffVisual = Math.atan2(
      Math.sin(targetVisual - m.visualHeading),
      Math.cos(targetVisual - m.visualHeading)
    );
    m.visualHeading += diffVisual * Math.min(1, species.turnSpeed * delta * timeScale * 4.0);
    
    group.rotation.y = m.visualHeading;
    statusRef.current = m.status;

    // Only the selected animal feeds the UI panel, so skip the write
    // otherwise. Written even while paused so the panel stays readable.
    if (selected) {
      const vitals = vitalsRef.current;
      vitals.x = m.x;
      vitals.z = m.z;
      vitals.hunger = m.hunger;
      vitals.thirst = m.thirst;
      vitals.status = m.status;
      vitals.biome = biomeForHeight(here.y).name;
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

  return (
    <group
      ref={groupRef}
      position={[spawn.x, 0, spawn.z]}
      rotation={[0, spawn.heading, 0]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      {/* The per-animal Suspense keeps this animal's frame loop and the rest
          of the population running while its GLB streams in. Selection
          feedback is the ring below (cloned GLB materials are shared, so
          per-instance emissive tinting is no longer available). */}
      <Suspense fallback={null}>
        <AnimalModel
          species={species}
          timeScale={timeScale}
          statusRef={statusRef}
        />
      </Suspense>
      {selected && (
        <mesh
          position={[0, 0.03, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={species.selectionRadius}
        >
          <ringGeometry args={[0.8, 1, 40]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}
    </group>
  );
}
