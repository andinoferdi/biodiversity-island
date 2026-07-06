"use client";

import { Suspense, useEffect, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { MathUtils, type Group } from "three";
import AnimalModel from "./AnimalModel";
import { getSpecies, type AnimalSpawn, type Species } from "./species";
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
  liveAnimals,
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
  isRaining: boolean;
  isPOV: boolean;
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

// Helper to get realistic sensory params
function getSightParams(species: Species) {
  return { fov: species.fov ?? 2.0, sightDist: species.sightDistance ?? 10 };
}

function canSee(meX: number, meZ: number, meHeading: number, targetX: number, targetZ: number, species: Species): boolean {
  const { fov, sightDist } = getSightParams(species);
  const dx = targetX - meX;
  const dz = targetZ - meZ;
  const dist = Math.hypot(dx, dz);
  if (dist > sightDist) return false;
  
  const angleToTarget = Math.atan2(dx, dz);
  let diff = Math.abs(angleToTarget - meHeading);
  while (diff > Math.PI) diff -= Math.PI * 2;
  return Math.abs(diff) <= fov / 2;
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
  isRaining,
  isPOV,
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
    " ": false,
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

  useEffect(() => {
    return () => {
      liveAnimals.delete(spawn.id);
    };
  }, [spawn.id]);

  // Read by AnimalModel every frame to pick the deer's animation clip.
  const statusRef = useRef<AnimalStatus>("Roaming");
  // Per-frame movement and needs state lives in a ref so animation never
  // triggers React renders.
  const motion = useRef({
    x: spawn.x,
    z: spawn.z,
    y: 0,
    jumpY: 0,
    vy: 0,
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

    liveAnimals.set(spawn.id, {
      x: m.x,
      z: m.z,
      speciesId: spawn.speciesId,
      status: m.status,
      heading: m.visualHeading,
    });

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
      
      if (isRaining) {
        m.thirst = Math.max(0, m.thirst - species.consumeRate * 0.5 * dt);
      } else {
        m.thirst = Math.min(NEED_MAX, m.thirst + species.thirstRate * dt);
      }

      // Death: a need pinned at NEED_MAX starts the critical timer; leaving
      // the pinned state resets it.
      if (m.hunger >= NEED_MAX || m.thirst >= NEED_MAX) {
        m.criticalTimer += dt;
        if (m.criticalTimer >= DEATH_AFTER_CRITICAL) {
          m.hasDied = true;
          liveAnimals.delete(spawn.id);
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

      if (m.jumpY > 0 || m.vy !== 0) {
        m.vy -= 15 * dt; // gravity
        m.jumpY += m.vy * dt;
        if (m.jumpY <= 0) {
          m.jumpY = 0;
          m.vy = 0;
        }
      }

      if (selected) {
        m.status = "Idle";
        const k = keys.current;
        let turn = 0;
        let forward = 0;

        if (k[" "] && m.jumpY === 0) {
          m.vy = 4;
        }

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
          if (species.id !== "hawk" && m.jumpY <= 0.1) {
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
          // AI: Senses, Predators, Flocking
          let strangersCount = 0;
          let fleeX = 0, fleeZ = 0;
          let friendsX = 0, friendsZ = 0, friendsHeading = 0, friendsCount = 0;
          
          let preyTargetX: number | null = null;
          let preyTargetZ: number | null = null;
          let isDead = false;
          
          for (const [id, state] of liveAnimals.entries()) {
            if (id === spawn.id) continue;
            
            const dist = Math.hypot(state.x - m.x, state.z - m.z);
            const otherSpecies = getSpecies(state.speciesId);
            
            // Predator kill check (instant)
            if (otherSpecies.predatorOf?.includes(species.id) && dist < 0.8) {
               isDead = true;
               break;
            }

            // Must be able to see or hear them (Hearing=3)
            if (dist > 3 && !canSee(m.x, m.z, m.heading, state.x, state.z, species)) {
               continue;
            }
            
            if (state.speciesId === spawn.speciesId) {
              if (dist < 5) {
                friendsX += state.x;
                friendsZ += state.z;
                friendsHeading += state.heading;
                friendsCount++;
              }
              if (dist < 0.8) {
                fleeX += (m.x - state.x);
                fleeZ += (m.z - state.z);
              }
            } else {
              if (species.predatorOf?.includes(state.speciesId)) {
                // I am a predator, they are prey! Hunt if hungry
                if (m.hunger > 30) {
                   preyTargetX = state.x;
                   preyTargetZ = state.z;
                }
              } else if (otherSpecies.predatorOf?.includes(species.id) || dist < 3) {
                strangersCount++;
                fleeX += (m.x - state.x);
                fleeZ += (m.z - state.z);
              }
            }
          }
          
          if (isDead) {
             m.hasDied = true;
             liveAnimals.delete(spawn.id);
             onDeath(spawn.id);
             return;
          }
          
          if (strangersCount > 0 && species.locomotion !== "aquatic") {
            m.status = "Fleeing";
            m.headingTarget = Math.atan2(fleeX, fleeZ);
          } else if (preyTargetX !== null && preyTargetZ !== null) {
            m.status = "Hunting";
            m.headingTarget = Math.atan2(preyTargetX - m.x, preyTargetZ - m.z);
          } else {
            m.wanderTimer -= dt;
            if (m.wanderTimer <= 0) {
              if (m.hunger < WELL_FED_LEVEL && m.thirst < WELL_FED_LEVEL && Math.random() < 0.25) {
                m.status = "Idle";
                m.wanderTimer = 3 + Math.random() * 4;
              } else {
                m.status = "Roaming";
                m.wanderTimer = 1.5 + Math.random() * 2.5;
                
                let candidateHeading = m.heading + (Math.random() - 0.5) * Math.PI;
                if (friendsCount > 0) {
                  const towardCenter = Math.atan2(friendsX / friendsCount - m.x, friendsZ / friendsCount - m.z);
                  const avgHeading = friendsHeading / friendsCount;
                  
                  let totalSin = Math.sin(candidateHeading) + Math.sin(avgHeading) * 0.3 + Math.sin(towardCenter) * 0.2;
                  let totalCos = Math.cos(candidateHeading) + Math.cos(avgHeading) * 0.3 + Math.cos(towardCenter) * 0.2;
                  candidateHeading = Math.atan2(totalSin, totalCos);
                }
                
                if (fleeX !== 0 || fleeZ !== 0) {
                  const sepHeading = Math.atan2(fleeX, fleeZ);
                  let totalSin = Math.sin(candidateHeading) + Math.sin(sepHeading) * 0.8;
                  let totalCos = Math.cos(candidateHeading) + Math.cos(sepHeading) * 0.8;
                  candidateHeading = Math.atan2(totalSin, totalCos);
                }
                
                for (let attempt = 0; attempt < WANDER_TRIES; attempt++) {
                  const spread = attempt === 0 ? 0 : Math.PI * 2;
                  const candidate = candidateHeading + (Math.random() - 0.5) * spread;
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
            } else if (m.status === "Roaming" && (fleeX !== 0 || fleeZ !== 0)) {
               const sepHeading = Math.atan2(fleeX, fleeZ);
               let totalSin = Math.sin(m.headingTarget) + Math.sin(sepHeading) * 0.15;
               let totalCos = Math.cos(m.headingTarget) + Math.cos(sepHeading) * 0.15;
               m.headingTarget = Math.atan2(totalSin, totalCos);
            }
          }
          if (m.status === "Idle") {
            moving = false;
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

          // Compute Potential Field for Obstacles (mapping all exact object positions)
          let avoidX = 0, avoidZ = 0;
          let avoidStrength = 0;
          
          if (species.id !== "hawk") {
            for (const v of VEGETATION) {
              const dx = m.x - v.x;
              const dz = m.z - v.z;
              const dist = Math.hypot(dx, dz);
              // Scale radius based on vegetation scale and animal size
              const safeRadius = (species.selectionRadius * 0.5) + (v.scale * 0.6) + 0.4;
              if (dist < safeRadius) {
                 const push = Math.pow((safeRadius - dist) / safeRadius, 2);
                 avoidX += (dx / dist) * push;
                 avoidZ += (dz / dist) * push;
                 avoidStrength += push;
              }
            }
          }
          
          // Avoid cliffs and invalid terrain (sample in a circle)
          const lookahead = 1.0;
          for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
              const cx = m.x + Math.sin(angle) * lookahead;
              const cz = m.z + Math.cos(angle) * lookahead;
              const ground = sampleGround(cx, cz);
              if (!ground || ground.normalY < MIN_GROUND_NORMAL_Y || (!canOccupy(species, ground) && !stranded)) {
                  avoidX -= Math.sin(angle) * 0.8; // Push away from this angle
                  avoidZ -= Math.cos(angle) * 0.8;
                  avoidStrength += 0.8;
              }
          }

          let finalHeadingTarget = m.headingTarget;
          if (avoidStrength > 0) {
             // Blend current target heading with avoidance vector
             const targetVecX = Math.sin(m.headingTarget) * 0.4 + avoidX;
             const targetVecZ = Math.cos(m.headingTarget) * 0.4 + avoidZ;
             finalHeadingTarget = Math.atan2(targetVecX, targetVecZ);
          }

          const diff = Math.atan2(
            Math.sin(finalHeadingTarget - m.heading),
            Math.cos(finalHeadingTarget - m.heading)
          );
          
          let speedMult = 1.0;
          if (m.status === "Fleeing") speedMult = 2.5;
          else if (m.status === "Hunting") speedMult = 2.0;
          else if (m.status === "Seeking food" || m.status === "Seeking water") speedMult = 1.4;
          
          // If heavily avoiding something, slow down slightly so they don't clip through while turning
          if (avoidStrength > 1.0) speedMult *= 0.6;

          // Turn much faster when actively avoiding objects to prevent getting stuck
          m.heading += diff * Math.min(1, species.turnSpeed * (speedMult > 1 ? 1.5 : 1.0) * dt * (avoidStrength > 0 ? 3.0 : 1.0));

          const nextX = m.x + Math.sin(m.heading) * species.moveSpeed * speedMult * dt;
          const nextZ = m.z + Math.cos(m.heading) * species.moveSpeed * speedMult * dt;
          const ahead = sampleGround(nextX, nextZ);

          // Hard safety check
          if (ahead && (canOccupy(species, ahead) || stranded) && ahead.normalY >= MIN_GROUND_NORMAL_Y) {
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
    group.position.set(m.x, m.y + m.jumpY, m.z);

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
      {isPOV && (
        <PerspectiveCamera
          makeDefault
          position={[
            0, 
            (species.modelYOffset || 0) + species.selectionRadius * 1.2 + (species.id === "hawk" ? 1.2 : 0.3), 
            -species.selectionRadius * 2.5 - (species.id === "hawk" ? 1.5 : 0.6)
          ]}
          rotation={[species.id === "hawk" ? 0.6 : 0.15, Math.PI, 0]}
          fov={75}
        />
      )}
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
