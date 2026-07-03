export type TimeScale = 0 | 1 | 4;

export type AnimalStatus =
  | "Roaming"
  | "Seeking water"
  | "Drinking"
  | "Seeking food"
  | "Eating";

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
// Only affects the bar color for now; death arrives in the next step.
export const CRITICAL_LEVEL = 90;

// Shared payload for the selected animal, polled by the UI every 250 ms.
export interface AnimalVitals {
  x: number;
  z: number;
  hunger: number;
  thirst: number;
  status: AnimalStatus;
}
