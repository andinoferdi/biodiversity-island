// How a species relates to the river: aquatic animals may only occupy water,
// amphibians roam water and land freely, terrestrial animals stay on land
// and only touch the river's edge when drinking.
export type Locomotion = "aquatic" | "amphibian" | "terrestrial";

export interface Species {
  id: string;
  name: string;
  habitat: string;
  locomotion: Locomotion;
  diet: string;
  // GLB model under public/, plus per-model corrections determined from the
  // GLB bounding boxes and verified in the browser: modelScale normalizes
  // wildly different source sizes (turtle spans ~676 units, dove ~1.5),
  // modelYOffset lifts models whose origin sits above their base, modelRotY
  // aligns the model's forward axis with the movement heading (+Z).
  modelUrl: string;
  modelScale: number;
  modelYOffset: number;
  modelRotY: number;
  // Only the deer ships animation clips; the rest are static meshes.
  animated: boolean;
  // Radius of the yellow selection ring, sized to the model's footprint.
  selectionRadius: number;
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
    id: "deer",
    name: "Deer",
    habitat: "Wooded hills",
    locomotion: "terrestrial",
    diet: "Leaves & shoots",
    modelUrl: "/assets/animal/deer/deer.glb",
    modelScale: 0.33,
    modelYOffset: 0,
    modelRotY: 0,
    animated: true,
    selectionRadius: 1.0,
    moveSpeed: 1.3,
    turnSpeed: 2.2,
    hungerRate: 1.4,
    thirstRate: 1.8,
    consumeRate: 20,
  },
  {
    id: "dove",
    name: "Dove",
    habitat: "Treetops",
    locomotion: "terrestrial",
    diet: "Seeds & berries",
    modelUrl: "/assets/animal/dove/dove.glb",
    modelScale: 0.3,
    modelYOffset: 0,
    modelRotY: 0,
    animated: false,
    selectionRadius: 0.6,
    moveSpeed: 2.1,
    turnSpeed: 3.4,
    hungerRate: 2.0,
    thirstRate: 2.4,
    consumeRate: 24,
  },
  {
    id: "elephant",
    name: "Elephant",
    habitat: "Open plains",
    locomotion: "terrestrial",
    diet: "Grass & shrubs",
    modelUrl: "/assets/animal/elephant/elephant.glb",
    modelScale: 0.0135,
    modelYOffset: 1.26,
    modelRotY: 0,
    animated: false,
    selectionRadius: 1.8,
    moveSpeed: 0.7,
    turnSpeed: 1.4,
    hungerRate: 1.0,
    thirstRate: 1.2,
    consumeRate: 16,
  },
  {
    id: "duck",
    name: "Duck",
    habitat: "River & banks",
    locomotion: "amphibian",
    diet: "Sprouts & insects",
    modelUrl: "/assets/animal/duck/duck.glb",
    modelScale: 0.22,
    modelYOffset: 0.17,
    modelRotY: 0,
    animated: false,
    selectionRadius: 0.7,
    moveSpeed: 1.7,
    turnSpeed: 3.0,
    hungerRate: 1.8,
    thirstRate: 2.2,
    consumeRate: 22,
  },
  {
    id: "turtle",
    name: "Turtle",
    habitat: "Riverside",
    locomotion: "terrestrial",
    diet: "Sea grass",
    modelUrl: "/assets/animal/turtle/turtle.glb",
    modelScale: 0.0015,
    modelYOffset: 0.11,
    modelRotY: 0,
    animated: false,
    selectionRadius: 0.9,
    moveSpeed: 0.5,
    turnSpeed: 1.6,
    hungerRate: 0.9,
    thirstRate: 1.1,
    consumeRate: 14,
  },
  {
    id: "fish",
    name: "Fish",
    habitat: "River",
    locomotion: "aquatic",
    diet: "Algae & plankton",
    modelUrl: "/assets/animal/fish/fish.glb",
    modelScale: 0.012,
    // Sits at the water surface; a slight dip keeps the body half-submerged.
    modelYOffset: 0,
    modelRotY: 0,
    animated: false,
    selectionRadius: 0.6,
    moveSpeed: 1.9,
    turnSpeed: 3.6,
    hungerRate: 2.2,
    thirstRate: 1.6,
    consumeRate: 24,
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

// Deterministic spawn layout validated against the terrain.glb heightmap
// (scale 3, lift 0.6): fish start inside the river, ducks on/near it, and
// the terrestrial species on flat land away from the northern mountains.
export const ANIMAL_SPAWNS: AnimalSpawn[] = [
  { id: "deer-1", speciesId: "deer", label: "Deer #1", x: 3.8, z: 2.6, heading: 0.7 },
  { id: "deer-2", speciesId: "deer", label: "Deer #2", x: 5.2, z: 1.0, heading: 3.8 },
  { id: "dove-1", speciesId: "dove", label: "Dove #1", x: 4.6, z: 4.0, heading: 2.4 },
  { id: "dove-2", speciesId: "dove", label: "Dove #2", x: 2.6, z: 3.6, heading: 5.1 },
  { id: "elephant-1", speciesId: "elephant", label: "Elephant #1", x: -4.2, z: -1.6, heading: 0 },
  { id: "elephant-2", speciesId: "elephant", label: "Elephant #2", x: -2.8, z: -3.2, heading: 2.1 },
  { id: "duck-1", speciesId: "duck", label: "Duck #1", x: 1.4, z: -1.0, heading: 1.2 },
  { id: "duck-2", speciesId: "duck", label: "Duck #2", x: -1.8, z: 1.6, heading: 5.3 },
  { id: "turtle-1", speciesId: "turtle", label: "Turtle #1", x: 0.8, z: 1.4, heading: 3.0 },
  { id: "turtle-2", speciesId: "turtle", label: "Turtle #2", x: -2.0, z: -2.0, heading: 0.4 },
  { id: "fish-1", speciesId: "fish", label: "Fish #1", x: 0.6, z: -0.3, heading: 2.0 },
  { id: "fish-2", speciesId: "fish", label: "Fish #2", x: 2.4, z: -2.1, heading: 4.6 },
];
