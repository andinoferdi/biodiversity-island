// How a species relates to the river: aquatic animals may only occupy water,
// amphibians roam water and land freely, terrestrial animals stay on land
// and only touch the river's edge when drinking.
export type Locomotion = "aquatic" | "amphibian" | "terrestrial" | "aerial";

export interface Species {
  id: string;
  name: string;
  habitat: string;
  locomotion: Locomotion;
  diet: string;
  // GLB model under public/, plus per-model corrections determined from the
  // GLB bounding boxes and verified in the browser: modelScale normalizes
  // wildly different source sizes (rabbit spans ~676 units, hawk ~1.5),
  // modelYOffset lifts models whose origin sits above their base, modelRotY
  // aligns the model's forward axis with the movement heading (+Z).
  modelUrl: string;
  modelScale: number;
  modelYOffset: number;
  modelRotY: number;
  // Only the deer ships animation clips; the rest are static meshes.
  animated: boolean;
  // Map of standard semantic actions to the GLB's specific clip names.
  animations?: {
    walk: string;
    eat?: string;
    idle?: string;
    // Klip cepat untuk status Hunting/Fleeing (mis. Gallop); fallback ke walk.
    run?: string;
  };
  // If true, the animal never stops moving (even while consuming resources).
  neverStops?: boolean;
  // If set, overrides the default simulation walk radius.
  roamRadius?: number;
  // Radius of the yellow selection ring, sized to the model's footprint.
  selectionRadius: number;
  moveSpeed: number;
  turnSpeed: number;
  hungerRate: number;
  thirstRate: number;
  consumeRate: number;
  // Offset kamera orang-pertama saat hewan dikontrol manual (mode POV).
  povCamera?: { height: number; back: number; pitch: number };
  // Real AI parameters
  predatorOf?: string[];
  // Ambang hunger untuk mulai berburu; fallback ke HUNT_HUNGER_THRESHOLD
  // global. Naikkan untuk predator yang terlalu dominan.
  huntHungerThreshold?: number;
  // Waktu well-fed beruntun (detik-simulasi) sebelum beranak; fallback ke
  // REPRODUCE_AFTER global. Predator harus jauh lebih lambat dari mangsa —
  // kalau sama, populasi predator tumbuh eksponensial dan memusnahkan mangsa.
  reproduceAfter?: number;
  fov?: number; // Field of view in radians (default ~2.0)
  sightDistance?: number; // How far they can see (default ~10)
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
    modelScale: 0.11,
    modelYOffset: 0,
    modelRotY: 0,
    animated: true,
    animations: { walk: "Walk", eat: "Eating" },
    selectionRadius: 0.33,
    // Cukup cepat agar flee 2.5× bisa lolos dari wolf dalam jendela
    // HUNT_GIVE_UP — pengejaran tidak boleh 100% sukses.
    moveSpeed: 0.42,
    turnSpeed: 2.2,
    hungerRate: 1.4,
    thirstRate: 1.8,
    consumeRate: 20,
    fov: 2.5, // Deer have wide peripheral vision
    sightDistance: 12,
  },
  {
    id: "wolf",
    name: "Wolf",
    habitat: "Wooded hills",
    locomotion: "terrestrial",
    diet: "Deer & rabbits",
    modelUrl: "/assets/animal/wolf/wolf.glb",
    // Bbox mentah GLB ~5.55 panjang / ~2.67 tinggi; 0.13 menghasilkan ukuran
    // sedikit di atas deer. KALIBRASI VISUAL di Step 5 sebelum dianggap final.
    modelScale: 0.13,
    modelYOffset: 0,
    modelRotY: 0,
    animated: true,
    animations: { walk: "Walk", run: "Gallop", eat: "Eating", idle: "Idle" },
    selectionRadius: 0.38,
    // Lebih lambat dari deer saat santai; menang saat mengejar berkat
    // speed multiplier Hunting 2.0x — tapi tidak terlalu jauh, supaya
    // deer yang kabur duluan bisa lolos sebelum HUNT_GIVE_UP.
    moveSpeed: 0.85,
    // Belok tajam: satu-satunya keunggulan wolf dalam kejaran — tanpa ini
    // wolf gagal semua kejaran pertama dan mati kelaparan (data sensus).
    turnSpeed: 2.8,
    // Metabolisme lambat: wolf butuh runway panjang antar-kill (sensus:
    // wolf berulang kali mati Starving sebelum kill pertama).
    hungerRate: 1.0,
    thirstRate: 1.4,
    consumeRate: 18,
    predatorOf: ["deer", "rabbit"],
    huntHungerThreshold: 60, // mulai berburu lebih awal — runway kill pertama
    reproduceAfter: 120,
    sightDistance: 14,
  },
  {
    id: "hawk",
    name: "Hawk",
    habitat: "Forest canopy",
    locomotion: "aerial",
    diet: "Rabbits, ducks & fish",
    modelUrl: "/assets/animal/hawk/hawk.glb",
    modelScale: 0.1,
    modelYOffset: 3,
    modelRotY: Math.PI,
    animated: true,
    animations: { walk: "metarig|Fly", idle: "metarig|Fly", eat: "metarig|Fly" },
    neverStops: true,
    roamRadius: 12,
    povCamera: { height: 1.2, back: 1.5, pitch: 0.6 },
    selectionRadius: 0.2,
    moveSpeed: 0.6,
    turnSpeed: 3.4,
    // Metabolisme pelan: predator hidup dari kill yang jarang (HUNT_COOLDOWN),
    // hungerRate tinggi membuat mereka mati sebelum boleh berburu lagi.
    hungerRate: 1.2,
    thirstRate: 2.4,
    consumeRate: 24,
    predatorOf: ["rabbit", "duck", "fish"],
    huntHungerThreshold: 70, // hawk baru berburu saat benar-benar lapar
    reproduceAfter: 120,
    fov: 1.8, // Hawks have focused forward vision
    sightDistance: 12, // sebelumnya 20 — tidak lagi melihat seisi pulau
  },
  {
    id: "horse",
    name: "Horse",
    habitat: "Open plains",
    locomotion: "terrestrial",
    diet: "Grass & shrubs",
    modelUrl: "/assets/animal/horse/horse.glb",
    modelScale: 0.11,
    modelYOffset: 0,
    modelRotY: 0,
    animated: true,
    animations: { walk: "Walk", eat: "Eating" },
    selectionRadius: 0.6,
    moveSpeed: 0.35,
    turnSpeed: 1.4,
    hungerRate: 1.0,
    thirstRate: 1.2,
    consumeRate: 16,
    fov: 2.5,
    sightDistance: 14,
  },
  {
    id: "duck",
    name: "Duck",
    habitat: "River & banks",
    locomotion: "amphibian",
    diet: "Sprouts & insects",
    modelUrl: "/assets/animal/duck/duck.glb",
    modelScale: 0.07,
    modelYOffset: 0.05,
    modelRotY: 0,
    animated: false,
    selectionRadius: 0.23,
    moveSpeed: 0.35,
    turnSpeed: 1.0,
    // Duck bolak-balik makanan darat <-> air sungai; laju kebutuhan tinggi
    // membuatnya mati di tengah komute (data sensus: semua duck mati
    // Starving/Dehydrated, bukan dimangsa).
    hungerRate: 1.2,
    thirstRate: 1.6,
    consumeRate: 22,
    reproduceAfter: 30, // mangsa hawk — lihat komentar rabbit
    fov: 2.2,
    sightDistance: 8,
  },
  {
    id: "rabbit",
    name: "Rabbit",
    habitat: "Riverside",
    locomotion: "terrestrial",
    diet: "Sea grass",
    modelUrl: "/assets/animal/rabbit/rabbit.glb",
    modelScale: 0.46,
    modelYOffset: 0.07,
    modelRotY: 0,
    animated: true,
    animations: { walk: "Bunny|Bunny_walk", idle: "Bunny|Bunny_idle" },
    selectionRadius: 0.3,
    // Lihat komentar deer: flee harus punya peluang lolos dari hawk.
    moveSpeed: 0.3,
    turnSpeed: 1.6,
    hungerRate: 0.9,
    thirstRate: 1.1,
    // Mangsa utama hawk: beranak lebih cepat dari default 45 agar kelahiran
    // mengimbangi laju predasi (~1 kill / 60 detik-sim).
    reproduceAfter: 30,
    consumeRate: 14,
    fov: 2.8, // Rabbits can see almost behind them
    sightDistance: 10,
  },
  {
    id: "fish",
    name: "Fish",
    habitat: "River",
    locomotion: "aquatic",
    diet: "Algae & plankton",
    modelUrl: "/assets/animal/fish/fish.glb",
    modelScale: 0.004,
    // Sits at the water surface; a slight dip keeps the body half-submerged.
    modelYOffset: 0,
    modelRotY: 0,
    animated: false,
    selectionRadius: 0.2,
    moveSpeed: 0.95,
    turnSpeed: 3.6,
    // Cukup rendah agar fish sanggup kabur dari hawk berkali-kali tanpa
    // kelaparan — satu-satunya petak makanan sungai kecil dan sering
    // ditinggal saat Fleeing.
    hungerRate: 1.4,
    thirstRate: 1.6,
    consumeRate: 24,
    reproduceAfter: 30, // mangsa hawk — lihat komentar rabbit
    fov: 2.0,
    sightDistance: 6,
  },
];

export const SPECIES_BY_ID = new Map(SPECIES.map((species) => [species.id, species]));

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
  { id: "deer-3", speciesId: "deer", label: "Deer #3", x: 4.4, z: -1.8, heading: 5.5 },
  { id: "hawk-1", speciesId: "hawk", label: "Hawk #1", x: 4.6, z: 4.0, heading: 2.4 },
  { id: "hawk-2", speciesId: "hawk", label: "Hawk #2", x: 2.6, z: 3.6, heading: 5.1 },
  { id: "horse-1", speciesId: "horse", label: "Horse #1", x: -4.2, z: -1.6, heading: 0 },
  { id: "horse-2", speciesId: "horse", label: "Horse #2", x: -2.8, z: -3.2, heading: 2.1 },
  { id: "duck-1", speciesId: "duck", label: "Duck #1", x: 1.4, z: -1.0, heading: 1.2 },
  { id: "duck-2", speciesId: "duck", label: "Duck #2", x: -1.8, z: 1.6, heading: 5.3 },
  { id: "duck-3", speciesId: "duck", label: "Duck #3", x: 0.2, z: 2.8, heading: 2.7 },
  { id: "rabbit-1", speciesId: "rabbit", label: "Rabbit #1", x: 0.8, z: 1.4, heading: 3.0 },
  { id: "rabbit-2", speciesId: "rabbit", label: "Rabbit #2", x: -2.0, z: -2.0, heading: 0.4 },
  { id: "rabbit-3", speciesId: "rabbit", label: "Rabbit #3", x: 2.2, z: 0.6, heading: 1.8 },
  { id: "rabbit-4", speciesId: "rabbit", label: "Rabbit #4", x: -3.4, z: 3.0, heading: 4.2 },
  { id: "fish-1", speciesId: "fish", label: "Fish #1", x: 0.6, z: -0.3, heading: 2.0 },
  { id: "fish-2", speciesId: "fish", label: "Fish #2", x: 2.4, z: -2.1, heading: 4.6 },
  { id: "fish-3", speciesId: "fish", label: "Fish #3", x: -0.9, z: 0.1, heading: 0.9 },
  { id: "fish-4", speciesId: "fish", label: "Fish #4", x: 1.5, z: -1.2, heading: 3.3 },
  // Wolf spawn kenyang: butuh runway panjang untuk menemukan kill pertama
  // (mati kelaparan di menit-menit awal kalau spawn setengah lapar).
  { id: "wolf-1", speciesId: "wolf", label: "Wolf #1", x: -4.8, z: 2.4, heading: 2.6, initialHunger: 10 },
];
