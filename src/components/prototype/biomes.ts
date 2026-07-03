import { WATER_LEVEL } from "./simulation";

// Geographic biomes derived from terrain elevation. The old 120° angular
// wedges are gone: the terrain.glb model has real topography, so a point's
// biome is decided purely by the height the ground raycast reports there.
export type BiomeId = "river" | "land";

export interface Biome {
  id: BiomeId;
  name: string;
}

export const BIOMES: Biome[] = [
  { id: "river", name: "River" },
  { id: "land", name: "Land" },
];

const BIOMES_BY_ID = new Map(BIOMES.map((biome) => [biome.id, biome]));

export function getBiome(biomeId: BiomeId): Biome {
  return BIOMES_BY_ID.get(biomeId)!;
}

// The single biome rule: at or below the water surface is River, above is
// Land (the old Forest and Grassland merged into one terrestrial biome).
export function biomeForHeight(y: number): Biome {
  return y <= WATER_LEVEL ? BIOMES[0] : BIOMES[1];
}
