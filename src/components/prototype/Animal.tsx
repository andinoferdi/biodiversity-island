"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import {
  MathUtils,
  Vector3,
  type Group,
  type PerspectiveCamera as ThreePerspectiveCamera,
} from "three";
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
  killRewards,
  KILL_RANGE,
  HUNT_HUNGER_THRESHOLD,
  KILL_HUNGER_RESTORE,
  EAT_PREY_DURATION,
  HEARING_RANGE,
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
// Longest simulation step a single frame may take (hidden-tab safety).
const MAX_FRAME_DELTA = 0.1;

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

interface SenseResult {
  // Id predator yang berada dalam KILL_RANGE (mangsa mati frame ini).
  killerId: string | null;
  // Akumulasi arah menjauh dari ancaman/kerumunan (untuk Fleeing/separation).
  fleeX: number;
  fleeZ: number;
  threatCount: number;
  // Posisi mangsa terdekat yang terlihat (untuk Hunting), null jika tak ada.
  preyX: number | null;
  preyZ: number | null;
  // Akumulasi flocking sesama spesies (cohesion + alignment).
  friendsX: number;
  friendsZ: number;
  friendsHeading: number;
  friendsCount: number;
}

// Satu pass atas liveAnimals per hewan per frame: kill check, deteksi
// ancaman, pemilihan mangsa, dan data flocking sekaligus.
function sense(
  selfId: string,
  m: { x: number; z: number; heading: number; hunger: number },
  species: Species
): SenseResult {
  const r: SenseResult = {
    killerId: null,
    fleeX: 0,
    fleeZ: 0,
    threatCount: 0,
    preyX: null,
    preyZ: null,
    friendsX: 0,
    friendsZ: 0,
    friendsHeading: 0,
    friendsCount: 0,
  };
  let nearestPreyDist = Infinity;

  for (const [id, state] of liveAnimals.entries()) {
    if (id === selfId) continue;

    const dist = Math.hypot(state.x - m.x, state.z - m.z);
    const otherSpecies = getSpecies(state.speciesId);

    // Kill check: berlaku selalu, apa pun status mangsa.
    if (otherSpecies.predatorOf?.includes(species.id) && dist < KILL_RANGE) {
      r.killerId = id;
      return r;
    }

    // Sisanya butuh persepsi: terlihat (FOV + jarak) atau terdengar.
    if (dist > HEARING_RANGE && !canSee(m.x, m.z, m.heading, state.x, state.z, species)) {
      continue;
    }

    if (state.speciesId === species.id) {
      if (dist < 5) {
        r.friendsX += state.x;
        r.friendsZ += state.z;
        r.friendsHeading += state.heading;
        r.friendsCount++;
      }
      if (dist < KILL_RANGE) {
        r.fleeX += m.x - state.x;
        r.fleeZ += m.z - state.z;
      }
    } else if (species.predatorOf?.includes(state.speciesId)) {
      // Predator lapar memilih mangsa terlihat yang paling dekat.
      if (m.hunger > HUNT_HUNGER_THRESHOLD && dist < nearestPreyDist) {
        nearestPreyDist = dist;
        r.preyX = state.x;
        r.preyZ = state.z;
      }
    } else if (otherSpecies.predatorOf?.includes(species.id)) {
      // Ancaman nyata saja (bukan sekadar hewan lain yang kebetulan dekat)
      // yang memicu Fleeing; deteksinya sudah lolos gerbang lihat/dengar di atas.
      r.threatCount++;
      r.fleeX += m.x - state.x;
      r.fleeZ += m.z - state.z;
    }
  }

  return r;
}

const CONTROL_KEYS = ["w", "a", "s", "d", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", " "] as const;
type ControlKey = (typeof CONTROL_KEYS)[number];

// Keyboard state untuk hewan yang sedang dikontrol manual. Ref, bukan
// state: dibaca setiap frame oleh useFrame tanpa memicu render.
function useKeyboardControls(active: boolean) {
  const keys = useRef<Record<ControlKey, boolean>>(
    Object.fromEntries(CONTROL_KEYS.map((k) => [k, false])) as Record<ControlKey, boolean>,
  );
  useEffect(() => {
    if (!active) return;
    const isControlKey = (key: string): key is ControlKey =>
      (CONTROL_KEYS as readonly string[]).includes(key);
    const down = (e: KeyboardEvent) => { if (isControlKey(e.key)) keys.current[e.key] = true; };
    const up = (e: KeyboardEvent) => { if (isControlKey(e.key)) keys.current[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const snapshot = keys.current;
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      // Reset saat deselect agar hewan tidak "jalan sendiri" saat dipilih lagi.
      for (const k of CONTROL_KEYS) snapshot[k] = false;
    };
  }, [active]);
  return keys;
}

// Gerak manual (mode kontrol keyboard).
const JUMP_VELOCITY = 4;
const GRAVITY = 15;
const MANUAL_TURN_MULT = 2.0;

const POV_DEFAULT = { height: 0.3, back: 0.6, pitch: 0.15 };
const POV_DAMPING = 6;

// Kamera POV mengejar offset targetnya dengan damping ringan sehingga
// posisi kamera bergerak halus dan tidak menempel kaku. Saat masuk POV,
// kamera mulai sedikit lebih tinggi dan lebih jauh. Saat keluar POV, kamera
// langsung kembali ke ortografis. Transisi antarproyeksi tidak digunakan.
function PovCamera({ species }: { species: Species }) {
  const camRef = useRef<ThreePerspectiveCamera>(null);
  const pov = species.povCamera ?? POV_DEFAULT;
  const target = useMemo(
    () =>
      new Vector3(
        0,
        (species.modelYOffset || 0) + species.selectionRadius * 1.2 + pov.height,
        -species.selectionRadius * 2.5 - pov.back,
      ),
    [species, pov],
  );
  useFrame((_, delta) => {
    const cam = camRef.current;
    if (!cam) return;
    cam.position.lerp(target, Math.min(1, delta * POV_DAMPING));
  });
  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      position={[target.x, target.y + 0.4, target.z - 0.3]}
      rotation={[pov.pitch, Math.PI, 0]}
      fov={75}
    />
  );
}

// Bobot dan radius potential-field obstacle avoidance (nilai identik dengan
// implementasi inline sebelumnya, hanya diberi nama).
const AVOID_GOAL_WEIGHT = 0.4;      // bobot arah tujuan saat blending
const AVOID_CLIFF_PUSH = 0.8;       // dorongan menjauh dari tebing/air terlarang
const AVOID_LOOKAHEAD = 1.0;        // radius sampling lingkaran
const AVOID_SLOWDOWN_THRESHOLD = 1.0;
const AVOID_SLOWDOWN_FACTOR = 0.6;
const AVOID_TURN_BOOST = 3.0;

interface AvoidanceResult { x: number; z: number; strength: number }

// Potential field: dorongan menjauh dari vegetasi dan sel terlarang di
// sekeliling hewan. Saat status "Seeking water", air di depan adalah tujuan,
// bukan penghalang (perbaikan bug kolaps populasi — lihat Task 1).
function computeAvoidance(
  m: { x: number; z: number; status: AnimalStatus },
  species: Species,
  stranded: boolean,
): AvoidanceResult {
  let avoidX = 0;
  let avoidZ = 0;
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

  // Avoid cliffs and invalid terrain (sample in a circle).
  // While the animal is heading for a drink, water ahead is the
  // destination, not an obstacle: repelling from it pinned thirsty
  // animals at ~0.8-1.0 from the bank — just outside DRINK_RANGE
  // (0.6) — until they died of dehydration. The hard safety check
  // in the caller still prevents actually stepping into water.
  const waterIsGoal = m.status === "Seeking water";
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    const cx = m.x + Math.sin(angle) * AVOID_LOOKAHEAD;
    const cz = m.z + Math.cos(angle) * AVOID_LOOKAHEAD;
    const ground = sampleGround(cx, cz);
    const impassable = !ground || ground.normalY < MIN_GROUND_NORMAL_Y;
    const wrongBiome =
      ground &&
      !canOccupy(species, ground) &&
      !stranded &&
      !(waterIsGoal && ground.water);
    if (impassable || wrongBiome) {
      avoidX -= Math.sin(angle) * AVOID_CLIFF_PUSH; // Push away from this angle
      avoidZ -= Math.cos(angle) * AVOID_CLIFF_PUSH;
      avoidStrength += AVOID_CLIFF_PUSH;
    }
  }

  return { x: avoidX, z: avoidZ, strength: avoidStrength };
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
  const keys = useKeyboardControls(selected);

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
    // Sisa waktu predator "memakan" mangsanya setelah kill (status Eating).
    eatPreyTimer: 0,
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
    // and 4x accelerates it uniformly and frame-rate independently. The raw
    // delta is clamped: when the tab is hidden the frame loop stops entirely,
    // and the first frame after it resumes reports the whole gap as one huge
    // delta — unclamped, that single frame pinned every need at max AND
    // pushed criticalTimer past DEATH_AFTER_CRITICAL, mass-killing the
    // population on tab refocus.
    const dt = Math.min(delta, MAX_FRAME_DELTA) * timeScale;

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
        m.vy -= GRAVITY * dt;
        m.jumpY += m.vy * dt;
        if (m.jumpY <= 0) {
          m.jumpY = 0;
          m.vy = 0;
        }
      }

      // Sense pass: berjalan setiap frame agar mangsa yang sedang makan/minum
      // tetap bisa diserang dan tetap kabur.
      const senseResult = selected ? null : sense(spawn.id, m, species);

      if (senseResult?.killerId) {
        killRewards.set(
          senseResult.killerId,
          (killRewards.get(senseResult.killerId) ?? 0) + 1
        );
        m.hasDied = true;
        liveAnimals.delete(spawn.id);
        onDeath(spawn.id);
        return;
      }

      // Klaim hasil buruan yang ditulis mangsa pada frame kematiannya.
      const claimed = killRewards.get(spawn.id);
      if (claimed) {
        killRewards.delete(spawn.id);
        m.hunger = Math.max(0, m.hunger - KILL_HUNGER_RESTORE * claimed);
        m.eatPreyTimer = EAT_PREY_DURATION;
      }
      if (m.eatPreyTimer > 0) m.eatPreyTimer = Math.max(0, m.eatPreyTimer - dt);

      if (selected) {
        m.status = "Idle";
        const k = keys.current;
        let turn = 0;
        let forward = 0;

        if (k[" "] && m.jumpY === 0) {
          m.vy = JUMP_VELOCITY;
        }

        if (k.w || k.ArrowUp) forward = 1;
        if (k.s || k.ArrowDown) forward = -1;
        if (k.a || k.ArrowLeft) turn = 1;
        if (k.d || k.ArrowRight) turn = -1;

        if (turn !== 0) {
          m.heading += turn * species.turnSpeed * dt * MANUAL_TURN_MULT;
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
        // animals and birds must stand/hover next to the nearest river-bank
        // point. (Aerial species used to require being over the water itself,
        // but their seek target is a land bank cell, so they hovered exactly
        // on the bank forever without ever registering as "at water".)
        const drinksAtBank =
          species.locomotion === "terrestrial" || species.locomotion === "aerial";
        const waterEdge = drinksAtBank ? nearestWaterEdge(m.x, m.z) : null;
        const atWater = drinksAtBank
          ? waterEdge !== null &&
            Math.hypot(waterEdge.x - m.x, waterEdge.z - m.z) < DRINK_RANGE
          : here.water;

        let moving = true;
        if (m.eatPreyTimer > 0) {
          // Baru membunuh: berhenti dan makan mangsanya.
          m.status = "Eating";
          if (!species.neverStops) moving = false;
        } else if (senseResult!.threatCount > 0 && species.locomotion !== "aquatic") {
          // Ancaman terlihat/terdengar: kabur, override lapar/haus.
          m.status = "Fleeing";
          m.headingTarget = Math.atan2(senseResult!.fleeX, senseResult!.fleeZ);
        } else if (senseResult!.preyX !== null && senseResult!.preyZ !== null) {
          // Predator lapar: kejar mangsa terdekat.
          m.status = "Hunting";
          m.headingTarget = Math.atan2(
            senseResult!.preyX - m.x,
            senseResult!.preyZ - m.z
          );
        } else if (atWater && m.thirst > SATISFIED_LEVEL && m.status === "Drinking") {
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
          // AI: wander + flocking (fleeing/hunting are already handled above
          // via senseResult, so this branch only needs cohesion/alignment).
          m.wanderTimer -= dt;
          if (m.wanderTimer <= 0) {
            if (m.hunger < WELL_FED_LEVEL && m.thirst < WELL_FED_LEVEL && Math.random() < 0.25) {
              m.status = "Idle";
              m.wanderTimer = 3 + Math.random() * 4;
            } else {
              m.status = "Roaming";
              m.wanderTimer = 1.5 + Math.random() * 2.5;

              let candidateHeading = m.heading + (Math.random() - 0.5) * Math.PI;
              if (senseResult!.friendsCount > 0) {
                const towardCenter = Math.atan2(
                  senseResult!.friendsX / senseResult!.friendsCount - m.x,
                  senseResult!.friendsZ / senseResult!.friendsCount - m.z
                );
                const avgHeading = senseResult!.friendsHeading / senseResult!.friendsCount;

                const totalSin = Math.sin(candidateHeading) + Math.sin(avgHeading) * 0.3 + Math.sin(towardCenter) * 0.2;
                const totalCos = Math.cos(candidateHeading) + Math.cos(avgHeading) * 0.3 + Math.cos(towardCenter) * 0.2;
                candidateHeading = Math.atan2(totalSin, totalCos);
              }

              if (senseResult!.fleeX !== 0 || senseResult!.fleeZ !== 0) {
                const sepHeading = Math.atan2(senseResult!.fleeX, senseResult!.fleeZ);
                const totalSin = Math.sin(candidateHeading) + Math.sin(sepHeading) * 0.8;
                const totalCos = Math.cos(candidateHeading) + Math.cos(sepHeading) * 0.8;
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
          } else if (m.status === "Roaming" && (senseResult!.fleeX !== 0 || senseResult!.fleeZ !== 0)) {
             const sepHeading = Math.atan2(senseResult!.fleeX, senseResult!.fleeZ);
             const totalSin = Math.sin(m.headingTarget) + Math.sin(sepHeading) * 0.15;
             const totalCos = Math.cos(m.headingTarget) + Math.cos(sepHeading) * 0.15;
             m.headingTarget = Math.atan2(totalSin, totalCos);
          }
        }
        if (m.status === "Idle") {
          moving = false;
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

          const avoid = computeAvoidance(m, species, stranded);

          let finalHeadingTarget = m.headingTarget;
          if (avoid.strength > 0) {
             // Blend current target heading with avoidance vector
             const targetVecX = Math.sin(m.headingTarget) * AVOID_GOAL_WEIGHT + avoid.x;
             const targetVecZ = Math.cos(m.headingTarget) * AVOID_GOAL_WEIGHT + avoid.z;
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
          if (avoid.strength > AVOID_SLOWDOWN_THRESHOLD) speedMult *= AVOID_SLOWDOWN_FACTOR;

          // Turn much faster when actively avoiding objects to prevent getting stuck
          m.heading += diff * Math.min(1, species.turnSpeed * (speedMult > 1 ? 1.5 : 1.0) * dt * (avoid.strength > 0 ? AVOID_TURN_BOOST : 1.0));

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
      {isPOV && <PovCamera species={species} />}
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
