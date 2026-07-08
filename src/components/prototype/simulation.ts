export type TimeScale = 0 | 1 | 4;

export type AnimalStatus =
  | "Idle"
  | "Roaming"
  | "Seeking water"
  | "Drinking"
  | "Seeking food"
  | "Eating"
  | "Starving"
  | "Dehydrated"
  | "Fleeing"
  | "Hunting";

import type { BiomeId } from "./biomes";

export interface ResourceSpot {
  id: string;
  kind: "food";
  biomeId: BiomeId;
  x: number;
  // Terrain height at (x, z), sampled offline from terrain.glb with the
  // world transform in terrain.ts. Static props use it directly; animals
  // re-derive their own Y per frame via raycast.
  y: number;
  z: number;
  radius: number;
}

// The terrain water surface sits at world Y ≈ 0.345–0.358 (terrain.glb at
// scale 3, lifted 0.6). Any raycast hit at or below this height is River;
// everything above is Land. The nearest land around the banks starts at
// ≈ 0.38, so the threshold cleanly separates the two.
export const WATER_LEVEL = 0.36;

// Minimum walkable steepness: a ground triangle whose normal has Y below
// this is a cliff wall — animals treat it as an obstacle and turn away.
export const MIN_GROUND_NORMAL_Y = 0.6;

// Deterministic food layout on the new terrain: four patches on Land (one
// per quadrant) plus one in the River for the fish. Water is no longer a
// resource spot — drinking targets the river banks found by terrain.ts.
export const RESOURCES: ResourceSpot[] = [
  { id: "food-north-east", kind: "food", biomeId: "land", x: 3.0, y: 0.41, z: 0, radius: 0.7 },
  { id: "food-east", kind: "food", biomeId: "land", x: 2.6, y: 0.41, z: 2.2, radius: 0.7 },
  { id: "food-west", kind: "food", biomeId: "land", x: -4.8, y: 0.43, z: -2.4, radius: 0.7 },
  { id: "food-south", kind: "food", biomeId: "land", x: -1.6, y: 0.38, z: 4.2, radius: 0.7 },
  { id: "food-north", kind: "food", biomeId: "land", x: 1.8, y: 0.43, z: -3.4, radius: 0.7 },
  { id: "food-river", kind: "food", biomeId: "river", x: -0.5, y: 0.35, z: 0.5, radius: 0.8 },
  // Dua petak sungai tambahan: segmen sungai bisa terputus untuk A* aquatic,
  // jadi tiap kelompok fish butuh petak makanan yang terjangkau berenang.
  { id: "food-river-south", kind: "food", biomeId: "river", x: 1.8, y: 0.35, z: -1.6, radius: 0.8 },
  { id: "food-river-mid", kind: "food", biomeId: "river", x: 0.6, y: 0.35, z: -0.3, radius: 0.8 },
  // Lengan sungai tenggara: fish di segmen ini kelaparan karena A* aquatic
  // tidak bisa menyeberang ke petak sungai lain (data kematian sensus).
  { id: "food-river-southeast", kind: "food", biomeId: "river", x: 4.5, y: 0.35, z: -3.5, radius: 0.8 },
];

export const FOOD_SPOTS = RESOURCES.filter((spot) => spot.kind === "food");

export const NEED_MAX = 100;
// A need above this makes the animal seek the matching resource.
export const SEEK_THRESHOLD = 55;
// Consumption stops once the need drops to this level.
export const SATISFIED_LEVEL = 10;
// Above this level the need bar turns red as a visual warning.
export const CRITICAL_LEVEL = 90;

// Batas jelajah + clamp posisi anak.
export const WALK_RADIUS = 6.0;

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
  // Live biome name at the animal's position ("River" | "Land").
  biome: string;
}

export interface AnimalState {
  x: number;
  z: number;
  speciesId: string;
  status: AnimalStatus;
  heading: number;
}

export const liveAnimals = new Map<string, AnimalState>();

// ---- Predator–prey tuning -------------------------------------------------
// Jarak predator–mangsa yang mengakibatkan kill instan.
export const KILL_RANGE = 0.8;
// Predator hanya berburu ketika hunger di atas ambang ini.
export const HUNT_HUNGER_THRESHOLD = 55;
// Hunger predator berkurang sebesar ini untuk tiap mangsa yang dibunuh.
export const KILL_HUNGER_RESTORE = 75;
// Lama (detik-simulasi) predator berstatus Eating setelah membunuh.
export const EAT_PREY_DURATION = 4;
// Dalam jarak ini hewan "mendengar" hewan lain meski di luar FOV penglihatan.
export const HEARING_RANGE = 3;
// Jeda (detik-simulasi) setelah predator memakan hasil buruan sebelum ia
// boleh berburu lagi. Memberi jendela pemulihan populasi mangsa.
export const HUNT_COOLDOWN = 60;
// Predator menyerah setelah mengejar selama ini (detik-simulasi) tanpa
// membunuh, lalu masuk HUNT_COOLDOWN. Tanpa ini setiap pengejaran pasti
// berujung kill (predator selalu lebih cepat) dan salah satu pihak punah.
export const HUNT_GIVE_UP = 8;
// Jeda singkat setelah pengejaran gagal — cukup untuk memutus kejaran dan
// memberi mangsa jarak, tapi tidak membunuh predator lewat kelaparan
// (cooldown penuh HUNT_COOLDOWN hanya setelah makan hasil buruan).
export const HUNT_GIVE_UP_COOLDOWN = 10;
// Mangsa baru kabur ketika predator lebih dekat dari ini. Tanpa batas ini
// mangsa kabur sepanjang predator terlihat (sight 10–12 ≈ separuh pulau),
// tidak pernah sempat makan/minum, lalu mati kelaparan sambil lari.
export const FLEE_DISTANCE = 4;

// Predator beranak setiap N kill (bukan via timer well-fed — siklus hunger
// predator tidak pernah memberi jendela well-fed kontinu yang cukup, jadi
// timer membuat mereka mandul dan punah pasti). Kopling kelahiran-ke-mangsa
// ini sekaligus umpan balik negatif klasik Lotka-Volterra.
export const PREDATOR_REPRODUCE_KILLS = 3;

// Mailbox antar-hewan: komponen Animal hanya boleh memutasi ref miliknya
// sendiri, jadi mangsa yang mati menulis id pembunuhnya ke sini dan predator
// mengklaimnya di awal frame berikutnya (hunger turun + status Eating).
export const killRewards = new Map<string, number>();
