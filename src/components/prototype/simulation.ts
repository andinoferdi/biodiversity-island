export type TimeScale = 0 | 1 | 4;

export type AnimalStatus =
  | "Roaming"
  | "Seeking water"
  | "Drinking"
  | "Seeking food"
  | "Eating"
  | "Starving"
  | "Dehydrated";

export interface ResourceSpot {
  id: string;
  kind: "water" | "food";
  x: number;
  z: number;
  radius: number;
}

// Deterministic resource layout: one pond and three food patches, all inside
// WALK_RADIUS (5.2) and clear of the tree positions in IslandScene.
export const RESOURCES: ResourceSpot[] = [
  { id: "pond", kind: "water", x: -2.8, z: -2.6, radius: 1.1 },
  { id: "food-east", kind: "food", x: 3.1, z: 0.2, radius: 0.7 },
  { id: "food-center", kind: "food", x: -0.6, z: -1.5, radius: 0.7 },
  { id: "food-north", kind: "food", x: 0.4, z: 2.2, radius: 0.7 },
];

export const WATER_SPOT = RESOURCES.find((spot) => spot.kind === "water")!;
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
