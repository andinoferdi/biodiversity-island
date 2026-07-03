export type BiomeId = "forest" | "grassland" | "shore";

export interface Biome {
  id: BiomeId;
  name: string;
  groundColor: string;
  // Angle of the ground wedge in circleGeometry coordinates. The wedge mesh
  // is rotated [-PI/2, 0, 0], which maps geometry angle a to the world
  // direction (cos a, 0, -sin a) — biomeAt() below uses the same mapping.
  thetaStart: number;
  thetaLength: number;
  // Roaming animals outside their home biome steer toward this point.
  centerX: number;
  centerZ: number;
}

const SECTOR = (Math.PI * 2) / 3;
// How far from the island center each biome's anchor point sits.
const CENTER_RADIUS = 3.2;

function makeBiome(
  id: BiomeId,
  name: string,
  groundColor: string,
  sectorIndex: number
): Biome {
  const thetaStart = SECTOR * sectorIndex;
  const mid = thetaStart + SECTOR / 2;
  return {
    id,
    name,
    groundColor,
    thetaStart,
    thetaLength: SECTOR,
    centerX: Math.cos(mid) * CENTER_RADIUS,
    centerZ: -Math.sin(mid) * CENTER_RADIUS,
  };
}

// Three 120° sectors of the island disc, ordered by thetaStart so biomeAt can
// index by angle.
export const BIOMES: Biome[] = [
  makeBiome("forest", "Forest", "#2d6a34", 0),
  makeBiome("grassland", "Grassland", "#68a83e", 1),
  makeBiome("shore", "Shore", "#d8c48c", 2),
];

const BIOMES_BY_ID = new Map(BIOMES.map((biome) => [biome.id, biome]));

export function getBiome(biomeId: BiomeId): Biome {
  return BIOMES_BY_ID.get(biomeId)!;
}

// O(1) biome lookup from a world position: normalize the wedge angle to
// [0, 2*PI) and index the 120° sector.
export function biomeAt(x: number, z: number): Biome {
  let angle = Math.atan2(-z, x);
  if (angle < 0) angle += Math.PI * 2;
  return BIOMES[Math.min(2, Math.floor(angle / SECTOR))];
}
