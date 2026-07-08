/**
 * animalDecision.ts
 * Translates TF.js action probabilities + perception into concrete movement
 * decisions: desired heading, speed multiplier, status label.
 */

import {
  ACTION_TURN_LEFT, ACTION_TURN_RIGHT,
  ACTION_SPEED_UP, ACTION_SLOW_DOWN, ACTION_STOP,
} from "./animalBrain";
import type { AnimalStatus } from "./simulation";
import {
  SEEK_THRESHOLD, SATISFIED_LEVEL, WELL_FED_LEVEL, CRITICAL_LEVEL,
  HUNT_HUNGER_THRESHOLD, KILL_RANGE, FOOD_SPOTS,
  liveAnimals, killRewards, HEARING_RANGE, FLEE_DISTANCE,
} from "./simulation";
import { nearestWaterEdge, sampleGround } from "./terrain";
import { getSpecies, type Species } from "./species";

export const WANDER_LOOKAHEAD = 1.5;
const WANDER_TRIES = 8;

function nearest2D<T extends { x: number; z: number }>(
  ax: number, az: number, items: T[]
): T | null {
  let best: T | null = null; let d = Infinity;
  for (const it of items) {
    const nd = Math.hypot(it.x - ax, it.z - az);
    if (nd < d) { d = nd; best = it; }
  }
  return best;
}

function foodSpotsFor(species: Species) {
  // Predator hanya makan dari hasil buruan (kill reward) — tanpa ini mereka
  // ikut merumput di petak makanan, tidak pernah lapar sungguhan, dan
  // beranak tanpa batas meski mangsa sudah habis (mesin monokultur).
  if (species.predatorOf?.length) return [];
  return FOOD_SPOTS.filter(s =>
    species.locomotion === "aquatic" ? s.biomeId === "river" : s.biomeId !== "river"
  );
}

function canOccupy(species: Species, water: boolean, normalY: number): boolean {
  if (normalY < 0.6) return false;
  if (species.locomotion === "aquatic") return water;
  if (species.locomotion === "terrestrial") return !water;
  return true;
}

export interface DecisionInput {
  x: number; z: number; heading: number; headingTarget: number;
  hunger: number; thirst: number;
  currentStatus: AnimalStatus;
  species: Species;
  actionProbs: Float32Array; // [5] from TF.js
  wanderTimer: number;
  avoidanceTimer: number;
  // Sisa hunt cooldown (detik-simulasi); > 0 berarti dilarang berburu.
  huntCooldown: number;
  stranded: boolean;
  isRaining: boolean;
}

export interface Decision {
  status: AnimalStatus;
  headingTarget: number;
  speedMult: number;
  moving: boolean;
  consumeFood: boolean;
  consumeWater: boolean;
  wanderTimer: number;
  pathTarget: { x: number; z: number } | null;
}

export function decide(inp: DecisionInput): Decision {
  const { x, z, heading, hunger, thirst, species, actionProbs } = inp;

  const CONSUME_MARGIN = 0.25;
  const DRINK_RANGE    = 0.6;

  // -- Resource proximity
  const foodSpot = nearest2D(x, z, foodSpotsFor(species));
  const atFood = foodSpot
    ? Math.hypot(foodSpot.x - x, foodSpot.z - z) < foodSpot.radius + CONSUME_MARGIN
    : false;

  // Semua non-aquatic minum di tepi sungai. Amphibian juga: target seek-nya
  // adalah sel bank (darat), jadi syarat "berdiri di air" tidak pernah
  // terpenuhi dan bebek mati dehidrasi sambil mengitari tepi sungai.
  const drinksAtBank = species.locomotion !== "aquatic";
  const waterEdge = drinksAtBank ? nearestWaterEdge(x, z) : null;
  const ground = sampleGround(x, z);
  const atWater = drinksAtBank
    ? waterEdge !== null && Math.hypot(waterEdge.x - x, waterEdge.z - z) < DRINK_RANGE
    : (ground?.water ?? false);

  // -- Detect nearby threats & prey from liveAnimals
  let threatPresent = false; let threatHeading = heading;
  let preyPresent   = false; let preyHeading   = heading;
  let nearestThreatDist = Infinity, nearestPreyDist = Infinity;

  const sightDist = species.sightDistance ?? 10;
  const fovHalf   = (species.fov ?? 2.0) / 2;
  const isPredator = (species.predatorOf?.length ?? 0) > 0;
  const huntThreshold = species.huntHungerThreshold ?? HUNT_HUNGER_THRESHOLD;

  for (const state of liveAnimals.values()) {
    const dx = state.x - x; const dz = state.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > Math.max(sightDist, HEARING_RANGE)) continue;

    if (dist > HEARING_RANGE) {
      const ang = Math.atan2(dx, dz);
      let diff = Math.abs(ang - heading);
      while (diff > Math.PI) diff -= Math.PI * 2;
      if (Math.abs(diff) > fovHalf) continue;
    }

    const other = getSpecies(state.speciesId);
    if (other.predatorOf?.includes(species.id) &&
        dist < FLEE_DISTANCE && dist < nearestThreatDist) {
      nearestThreatDist = dist;
      threatPresent = true;
      // Flee direction: away from threat
      threatHeading = Math.atan2(x - state.x, z - state.z);
    }
    // thirst < CRITICAL: predator yang hampir mati haus harus minum dulu —
    // tanpa gerbang ini Hunting terus menimpa Drinking sampai mati dehidrasi.
    if (isPredator && hunger > huntThreshold && inp.huntCooldown <= 0 &&
        inp.thirst < CRITICAL_LEVEL &&
        species.predatorOf!.includes(state.speciesId) && dist < nearestPreyDist) {
      nearestPreyDist = dist;
      preyPresent = true;
      preyHeading = Math.atan2(state.x - x, state.z - z);
    }
  }

  // -- Neural action weights (from TF.js softmax)
  const pTurnL  = actionProbs[ACTION_TURN_LEFT];
  const pTurnR  = actionProbs[ACTION_TURN_RIGHT];
  const pSpeedU = actionProbs[ACTION_SPEED_UP];
  const pSpeedD = actionProbs[ACTION_SLOW_DOWN];
  const pStop   = actionProbs[ACTION_STOP];

  // -- Build decision
  let status: AnimalStatus = inp.currentStatus;
  let headingTarget = inp.headingTarget;
  let speedMult = 1.0;
  let moving = true;
  let consumeFood = false;
  let consumeWater = false;
  let wanderTimer = inp.wanderTimer;
  let pathTarget: { x: number; z: number } | null = null;

  // Priority 1: Threat — override everything. Aquatic ikut kabur (berenang);
  // gerbang gerak di Animal.tsx tetap menahannya di dalam air.
  if (threatPresent) {
    status = "Fleeing";
    headingTarget = threatHeading;
    speedMult = 2.5;

  // Priority 2: Predator hunting prey
  } else if (preyPresent) {
    status = "Hunting";
    headingTarget = preyHeading;
    speedMult = 2.0;
    pathTarget = { x: preyHeading, z: preyHeading }; // just to trigger something if we want A* for hunting, but direct pursuit is usually better for moving targets. Actually let's use direct pursuit.
    pathTarget = null; // Direct line-of-sight pursuit is better for hunting


  // Priority 3: Critical needs
  } else if (atWater && thirst > SATISFIED_LEVEL && inp.currentStatus === "Drinking") {
    status = "Drinking";
    consumeWater = true;
    if (!species.neverStops) moving = false;

  } else if (atFood && hunger > SATISFIED_LEVEL && inp.currentStatus === "Eating") {
    status = "Eating";
    consumeFood = true;
    if (!species.neverStops) moving = false;

  } else if (thirst > SEEK_THRESHOLD) {
    if (atWater) {
      status = "Drinking";
      consumeWater = true;
      if (!species.neverStops) moving = false;
    } else {
      status = "Seeking water";
      const target = waterEdge ?? nearestWaterEdge(x, z);
      if (target) {
        pathTarget = target;
        if (inp.avoidanceTimer <= 0)
          headingTarget = Math.atan2(target.x - x, target.z - z);
      }
      speedMult = 1.4;
    }

  } else if (hunger > SEEK_THRESHOLD) {
    if (atFood) {
      status = "Eating";
      consumeFood = true;
      if (!species.neverStops) moving = false;
    } else {
      status = "Seeking food";
      if (foodSpot) {
        pathTarget = foodSpot;
        if (inp.avoidanceTimer <= 0)
          headingTarget = Math.atan2(foodSpot.x - x, foodSpot.z - z);
      }
      speedMult = 1.4;
    }

  // Priority 4: Neural-guided wander
  } else {
    // Neural stop decision
    if (pStop > 0.45 && hunger < WELL_FED_LEVEL && thirst < WELL_FED_LEVEL) {
      status = "Idle"; moving = false;
    } else {
      status = "Roaming";

      if (wanderTimer <= 0) {
        // Neural turn signal
        const netTurn = (pTurnR - pTurnL) * 0.8; // radians bias per decision
        const candidate = heading + netTurn + (Math.random() - 0.5) * 0.6;

        // Validate candidate against terrain
        let found = false;
        for (let t = 0; t < WANDER_TRIES; t++) {
          const spread = t === 0 ? 0 : Math.PI * 2;
          const c = candidate + (Math.random() - 0.5) * spread;
          const lx = x + Math.sin(c) * WANDER_LOOKAHEAD;
          const lz = z + Math.cos(c) * WANDER_LOOKAHEAD;
          const g = sampleGround(lx, lz);
          if (g && canOccupy(species, g.water, g.normalY)) {
            headingTarget = c; found = true; break;
          }
        }
        if (!found) headingTarget = heading + Math.PI + (Math.random() - 0.5) * 0.5;
        wanderTimer = 1.5 + Math.random() * 2.5;
      }

      // Neural speed signal
      speedMult = 0.8 + pSpeedU * 0.4 - pSpeedD * 0.2;
    }
  }

  if (status === "Idle") moving = false;

  return { status, headingTarget, speedMult, moving, consumeFood, consumeWater, wanderTimer, pathTarget };
}

// Kill detection: returns killer id if this animal is being killed this frame
export function checkKilled(
  selfId: string,
  x: number, z: number,
  species: Species,
): string | null {
  for (const [id, state] of liveAnimals.entries()) {
    if (id === selfId) continue;
    // Hanya predator yang sedang berburu yang membunuh. Predator kenyang
    // yang kebetulan lewat tidak lagi mendapat kill gratis (akar monokultur:
    // kill gratis -> hunger selalu rendah -> reproduksi tanpa henti).
    if (state.status !== "Hunting") continue;
    // Satu kill per buruan: predator dengan reward yang belum diklaim tidak
    // membunuh lagi frame ini — tanpa guard ini satu terkaman ke tengah
    // kawanan memusnahkan semua mangsa dalam KILL_RANGE sekaligus.
    if (killRewards.has(id)) continue;
    const dist = Math.hypot(state.x - x, state.z - z);
    if (dist >= KILL_RANGE) continue;
    const other = getSpecies(state.speciesId);
    if (other.predatorOf?.includes(species.id)) return id;
  }
  return null;
}
