export interface Species {
  id: string;
  name: string;
  habitat: string;
  diet: string;
  bodyColor: string;
  accentColor: string;
  scale: number;
  moveSpeed: number;
  turnSpeed: number;
  hungerRate: number;
  thirstRate: number;
  consumeRate: number;
}

export interface AnimalSpawn {
  id: string;
  speciesId: string;
  label: string;
  x: number;
  z: number;
  heading: number;
  // Offspring start with fixed moderate needs; the initial roster derives
  // deterministic needs from position instead (see initialNeed in Animal.tsx).
  initialHunger?: number;
  initialThirst?: number;
}

export const SPECIES: Species[] = [
  {
    id: "island-grazer",
    name: "Island Grazer",
    habitat: "Grassland",
    diet: "Grass & shrubs",
    bodyColor: "#c47a3d",
    accentColor: "#9c5f2e",
    scale: 1,
    moveSpeed: 1.2,
    turnSpeed: 2.2,
    hungerRate: 1.4,
    thirstRate: 1.8,
    consumeRate: 20,
  },
  {
    id: "dune-hopper",
    name: "Dune Hopper",
    habitat: "Sandy shore",
    diet: "Seeds & sprouts",
    bodyColor: "#e8e3d1",
    accentColor: "#b9b09a",
    scale: 0.55,
    moveSpeed: 2.1,
    turnSpeed: 3.4,
    hungerRate: 2.0,
    thirstRate: 2.5,
    consumeRate: 24,
  },
  {
    id: "highland-strider",
    name: "Highland Strider",
    habitat: "Inland meadow",
    diet: "Leaves & bark",
    bodyColor: "#4f6b8f",
    accentColor: "#3a4f6b",
    scale: 1.45,
    moveSpeed: 0.7,
    turnSpeed: 1.4,
    hungerRate: 1.0,
    thirstRate: 1.2,
    consumeRate: 16,
  },
];

const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));

export function getSpecies(speciesId: string): Species {
  const species = SPECIES_BY_ID.get(speciesId);
  if (!species) {
    throw new Error(`Unknown species id: ${speciesId}`);
  }
  return species;
}

// Deterministic spawn layout: spread across the island, all within WALK_RADIUS (5.2).
export const ANIMAL_SPAWNS: AnimalSpawn[] = [
  { id: "grazer-1", speciesId: "island-grazer", label: "Grazer #1", x: 2, z: 0, heading: 0 },
  { id: "grazer-2", speciesId: "island-grazer", label: "Grazer #2", x: -2.4, z: -2.2, heading: 2.1 },
  { id: "grazer-3", speciesId: "island-grazer", label: "Grazer #3", x: 0.8, z: 3.2, heading: 4.4 },
  { id: "hopper-1", speciesId: "dune-hopper", label: "Hopper #1", x: -3.6, z: 1.8, heading: 1.2 },
  { id: "hopper-2", speciesId: "dune-hopper", label: "Hopper #2", x: 3.4, z: -2.8, heading: 5.3 },
  { id: "hopper-3", speciesId: "dune-hopper", label: "Hopper #3", x: -0.6, z: -4.1, heading: 3.0 },
  { id: "strider-1", speciesId: "highland-strider", label: "Strider #1", x: -1.2, z: 1.1, heading: 0.7 },
  { id: "strider-2", speciesId: "highland-strider", label: "Strider #2", x: 4.1, z: 1.9, heading: 3.8 },
];
