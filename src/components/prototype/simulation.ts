export type TimeScale = 0 | 1 | 4;

export type AnimalStatus =
  | "Roaming"
  | "Seeking water"
  | "Drinking"
  | "Seeking food"
  | "Eating"
  | "Starving"
  | "Dehydrated";

import type { BiomeId } from "./biomes";

export interface ResourceSpot {
  id: string;
  kind: "water" | "food";
  biomeId: BiomeId;
  x: number;
  z: number;
  radius: number;
}

// Deterministic per-biome resource layout: 2 ponds + 3 food patches, all
// inside WALK_RADIUS (5.2) and clear of the vegetation in IslandScene. Every
// biome has its own food patch. Two ponds cannot cover three biomes, so the
// meadow pond sits right on the forest–grassland boundary: it belongs to the
// grassland, and forest animals reach it through the global seek fallback in
// Animal.tsx.
export const RESOURCES: ResourceSpot[] = [
  { id: "pond-shore", kind: "water", biomeId: "shore", x: 1.5, z: 2.6, radius: 1.2 },
  { id: "pond-meadow", kind: "water", biomeId: "grassland", x: -1.55, z: -2.68, radius: 1.0 },
  { id: "food-forest", kind: "food", biomeId: "forest", x: 1.6, z: -2.77, radius: 0.7 },
  { id: "food-grass", kind: "food", biomeId: "grassland", x: -3.2, z: 0.28, radius: 0.7 },
  { id: "food-shore", kind: "food", biomeId: "shore", x: 0.9, z: 3.3, radius: 0.7 },
];

export const WATER_SPOTS = RESOURCES.filter((spot) => spot.kind === "water");
export const FOOD_SPOTS = RESOURCES.filter((spot) => spot.kind === "food");

export const NEED_MAX = 100;
// A need above this makes the animal seek the matching resource.
export const SEEK_THRESHOLD = 55;
// Consumption stops once the need drops to this level.
export const SATISFIED_LEVEL = 10;
// Above this level the need bar turns red as a visual warning.
export const CRITICAL_LEVEL = 90;

// Animals can walk anywhere inside this radius; also bounds offspring spawns.
export const WALK_RADIUS = 5.2;

// Sim-seconds a need must sit at NEED_MAX before the animal dies.
export const DEATH_AFTER_CRITICAL = 20;
// Both needs must stay below this level to count as well-fed. Must sit above
// SEEK_THRESHOLD: needs routinely climb to ~55 before an animal reacts, so a
// lower value would reset the reproduction timer every cycle and no animal
// could ever reproduce.
export const WELL_FED_LEVEL = 65;
// Sim-seconds of continuous well-fed time required to reproduce.
export const REPRODUCE_AFTER = 45;
// Global population cap; reproduction is silently skipped at the cap.
export const MAX_POPULATION = 24;
// Added to the parent's hunger and thirst as the cost of reproducing.
export const REPRODUCTION_NEED_PENALTY = 25;

// Shared payload for the selected animal, polled by the UI every 250 ms.
export interface AnimalVitals {
  x: number;
  z: number;
  hunger: number;
  thirst: number;
  status: AnimalStatus;
}
