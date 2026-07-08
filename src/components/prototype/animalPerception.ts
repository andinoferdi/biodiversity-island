/**
 * animalPerception.ts
 * Builds a PerceptionVector from live world state.
 * Called every AI frame per animal — must be cheap (no allocation hot paths).
 */

import { PERCEPTION_SIZE, clamp01, encodedAngle, type PerceptionVector } from "./animalBrain";
import { liveAnimals } from "./simulation";
import { nearestWaterEdge, sampleGround, VEGETATION } from "./terrain";
import { getSpecies, type Species } from "./species";
import { FOOD_SPOTS, NEED_MAX, HUNT_HUNGER_THRESHOLD, HEARING_RANGE } from "./simulation";

const MAX_SENSE_DIST = 20;

function nearest2D(
  ax: number, az: number,
  items: { x: number; z: number }[],
): { item: { x: number; z: number }; dist: number } | null {
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (const it of items) {
    const d = Math.hypot(it.x - ax, it.z - az);
    if (d < bestD) { bestD = d; best = it; }
  }
  return best ? { item: best, dist: bestD } : null;
}

export function buildPerception(
  selfId: string,
  x: number,
  z: number,
  heading: number,
  hunger: number,
  thirst: number,
  speed: number,
  maxSpeed: number,
  species: Species,
): PerceptionVector {
  const v = new Float32Array(PERCEPTION_SIZE);

  // [0] hunger, [1] thirst
  v[0] = clamp01(hunger / NEED_MAX);
  v[1] = clamp01(thirst / NEED_MAX);

  // [2] normalised speed
  v[2] = clamp01(speed / Math.max(maxSpeed, 0.01));

  // [3-5] nearest food
  const isAquatic = species.locomotion === "aquatic";
  // Predator tidak makan petak tanaman (lihat foodSpotsFor di animalDecision).
  const foodCandidates = species.predatorOf?.length ? [] : FOOD_SPOTS.filter(s =>
    isAquatic ? s.biomeId === "river" : s.biomeId !== "river"
  );
  const foodRes = nearest2D(x, z, foodCandidates);
  if (foodRes) {
    v[3] = clamp01(1 - foodRes.dist / MAX_SENSE_DIST);
    const [fs, fc] = encodedAngle(x, z, heading, foodRes.item.x, foodRes.item.z);
    v[4] = fs; v[5] = fc;
  }

  // [6-8] nearest water edge (land/amphibian) or always-watered (aquatic)
  if (isAquatic) {
    v[6] = 1; v[7] = 0; v[8] = 1;
  } else {
    const edge = nearestWaterEdge(x, z);
    if (edge) {
      const wd = Math.hypot(edge.x - x, edge.z - z);
      v[6] = clamp01(1 - wd / MAX_SENSE_DIST);
      const [ws, wc] = encodedAngle(x, z, heading, edge.x, edge.z);
      v[7] = ws; v[8] = wc;
    }
  }

  // [9-12] threat / prey detection
  let nearestThreatDist = Infinity;
  let threatX = 0, threatZ = 0;
  let nearestPreyDist = Infinity;
  let friendsCount = 0;

  const isPredator = (species.predatorOf?.length ?? 0) > 0;
  const sightDist = species.sightDistance ?? 10;
  const fovHalf = (species.fov ?? 2.0) / 2;
  const huntThreshold = species.huntHungerThreshold ?? HUNT_HUNGER_THRESHOLD;

  for (const [id, state] of liveAnimals.entries()) {
    if (id === selfId) continue;
    const dx = state.x - x;
    const dz = state.z - z;
    const dist = Math.hypot(dx, dz);
    if (dist > Math.max(sightDist, HEARING_RANGE)) continue;

    // FOV check (hearing bypasses FOV)
    if (dist > HEARING_RANGE) {
      const angle = Math.atan2(dx, dz);
      let diff = Math.abs(angle - heading);
      while (diff > Math.PI) diff -= Math.PI * 2;
      if (Math.abs(diff) > fovHalf) continue;
    }

    const other = getSpecies(state.speciesId);

    // Is this animal a predator of me?
    if (other.predatorOf?.includes(species.id)) {
      if (dist < nearestThreatDist) {
        nearestThreatDist = dist; threatX = state.x; threatZ = state.z;
      }
    }

    // Is this animal my prey?
    if (isPredator && species.predatorOf!.includes(state.speciesId)) {
      if (hunger > huntThreshold && dist < nearestPreyDist) {
        nearestPreyDist = dist;
      }
    }

    // Flocking — same species, within 5 units
    if (state.speciesId === species.id && dist < 5) {
      friendsCount++;
    }
  }

  if (nearestThreatDist < Infinity) {
    v[9] = 1;
    v[10] = clamp01(1 - nearestThreatDist / sightDist);
    const [ts, tc] = encodedAngle(x, z, heading, threatX, threatZ);
    v[11] = ts; v[12] = tc;
  }

  // [13-14] prey
  if (nearestPreyDist < Infinity) {
    v[13] = 1;
    v[14] = clamp01(1 - nearestPreyDist / sightDist);
  }

  // [15] flock cohesion
  v[15] = clamp01(friendsCount / 5);

  return v;
}

// Obstacle awareness — returns a push vector away from vegetation + terrain edges
export interface ObstaclePush { x: number; z: number; strength: number }

export function computeObstaclePush(
  ax: number, az: number,
  species: Species,
  stranded: boolean,
  // Saat mencari minum, air BUKAN penghalang — tanpa ini hewan darat
  // terkunci ~1 unit dari tepi sungai (di luar DRINK_RANGE 0.6) dan mati
  // dehidrasi (bug kolaps lama yang sempat balik lagi di rewrite AI).
  seekingWater = false,
): ObstaclePush {
  let ox = 0, oz = 0, str = 0;
  const LOOKAHEAD = 1.0;
  const CLIFF_PUSH = 0.9;

  // Vegetation avoidance
  if (species.locomotion !== "aerial") {
    for (const v of VEGETATION) {
      const dx = ax - v.x; const dz = az - v.z;
      const dist = Math.hypot(dx, dz);
      const baseRadius = v.kind === "tree" ? 0.1 : (v.kind === "rock" ? 0.6 : 0.5);
      const safeR = species.selectionRadius * 0.3 + v.scale * baseRadius;
      if (dist < safeR && dist > 0) {
        const push = Math.pow((safeR - dist) / safeR, 2);
        ox += (dx / dist) * push; oz += (dz / dist) * push; str += push;
      }
    }
  }

  // Terrain edge avoidance (8 directions)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const cx = ax + Math.sin(angle) * LOOKAHEAD;
    const cz = az + Math.cos(angle) * LOOKAHEAD;
    const g = sampleGround(cx, cz);
    const bad = !g || g.normalY < 0.6 ||
      (g.water && species.locomotion === "terrestrial" && !stranded && !seekingWater) ||
      (!g.water && species.locomotion === "aquatic" && !stranded);
    if (bad) {
      ox -= Math.sin(angle) * CLIFF_PUSH;
      oz -= Math.cos(angle) * CLIFF_PUSH;
      str += CLIFF_PUSH;
    }
  }

  return { x: ox, z: oz, strength: str };
}
