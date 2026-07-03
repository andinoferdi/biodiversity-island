import { Box3, Raycaster, Vector3, type Object3D } from "three";
import { WATER_LEVEL, MIN_GROUND_NORMAL_Y } from "./simulation";

// Runtime terrain access shared by every animal: the mounted terrain.glb
// scene registers itself here, and all ground queries raycast against it.
// The mesh is BVH-accelerated (drei <Bvh> in EnvironmentModels.tsx), so the
// dozens of per-frame rays stay cheap.

export const TERRAIN_URL = "/assets/environment/terrain/terrain.glb";
export const TERRAIN_THUMBNAIL_URL = "/assets/environment/terrain/thumbnail.jpg";
// World transform applied to the GLB scene. The offline-sampled heights in
// simulation.ts/IslandScene.tsx assume exactly these values.
export const TERRAIN_SCALE = 3;
export const TERRAIN_Y = 0.6;

export interface GroundSample {
  // Height of the topmost surface (water counts as a surface).
  y: number;
  // Y of the hit triangle's normal; below MIN_GROUND_NORMAL_Y = cliff.
  normalY: number;
  // True when the surface sits at or below the water level (River biome).
  water: boolean;
}

export interface VegetationSpec {
  kind: "tree" | "rock" | "log";
  x: number;
  y: number;
  z: number;
  scale: number;
  rotY: number;
}

// Deterministic vegetation layout on the new terrain: trees cluster on the
// eastern and western flats, rocks sit near the foothills, logs near the
// banks. All positions verified on land, clear of the river, the northern
// mountains, and the food spots in simulation.ts.
export const VEGETATION: VegetationSpec[] = [
  { kind: "tree", x: 4.5, y: 0.43, z: 1.2, scale: 1.0, rotY: 0.4 },
  { kind: "tree", x: 5.5, y: 0.65, z: 2.4, scale: 1.15, rotY: 1.2 },
  { kind: "tree", x: 3.6, y: 0.43, z: 3.0, scale: 0.9, rotY: 2.1 },
  { kind: "tree", x: 5.0, y: 0.39, z: 4.0, scale: 1.05, rotY: 0.8 },
  { kind: "tree", x: 2.4, y: 0.43, z: 4.4, scale: 1.1, rotY: 2.8 },
  { kind: "tree", x: -4.6, y: 0.43, z: -3.2, scale: 0.95, rotY: 1.7 },
  { kind: "tree", x: -5.4, y: 0.4, z: -1.2, scale: 1.2, rotY: 3.0 },
  { kind: "tree", x: -6.0, y: 0.38, z: 1.0, scale: 0.9, rotY: 0.2 },
  { kind: "tree", x: -3.4, y: 0.43, z: -4.4, scale: 1.0, rotY: 1.4 },
  { kind: "tree", x: 0.5, y: 0.43, z: -4.2, scale: 1.05, rotY: 0.6 },
  { kind: "rock", x: -1.5, y: 0.43, z: -5.0, scale: 1.0, rotY: 0.9 },
  { kind: "rock", x: 6.0, y: 0.59, z: -2.0, scale: 1.2, rotY: 2.0 },
  { kind: "rock", x: -6.2, y: 0.99, z: 3.2, scale: 0.85, rotY: 4.1 },
  { kind: "log", x: 0.5, y: 0.35, z: 4.8, scale: 1.0, rotY: 1.6 },
  { kind: "log", x: 5.8, y: 0.43, z: -0.5, scale: 0.9, rotY: 4.4 },
  { kind: "tree", x: 6.2, y: 0.43, z: -0.8, scale: 1.0, rotY: 1.1 },
  { kind: "tree", x: -2.5, y: 0.43, z: 3.5, scale: 1.1, rotY: 0.5 },
  { kind: "tree", x: 1.5, y: 0.43, z: 2.0, scale: 0.95, rotY: 2.3 },
];

let terrainRoot: Object3D | null = null;
const listeners = new Set<() => void>();

// Shared, recycled scratch objects — the frame loop never allocates.
const raycaster = new Raycaster();
// three-mesh-bvh honours this flag once drei <Bvh> installs its accelerated
// raycast; it isn't part of three's Raycaster type, hence the cast.
(raycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
const rayOrigin = new Vector3();
const RAY_DOWN = new Vector3(0, -1, 0);
const RAY_HEIGHT = 30;

export function setTerrainRoot(root: Object3D | null) {
  terrainRoot = root;
  waterEdges = null;
  for (const listener of listeners) listener();
}

// useSyncExternalStore contract for the loading overlay in IslandScene.
export function subscribeTerrain(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isTerrainReady(): boolean {
  return terrainRoot !== null;
}

// Drops a ray straight down at (x, z) and reports the topmost surface.
// null = no terrain there (either still loading, or past the mesh edge —
// the world boundary).
export function sampleGround(x: number, z: number): GroundSample | null {
  if (!terrainRoot) return null;
  rayOrigin.set(x, RAY_HEIGHT, z);
  raycaster.set(rayOrigin, RAY_DOWN);
  const hits = raycaster.intersectObject(terrainRoot, true);
  const hit = hits[0];
  if (!hit) return null;
  // The terrain transform is uniform scale + translation only, so the
  // geometry normal's Y equals the world normal's Y.
  return {
    y: hit.point.y,
    normalY: hit.face?.normal.y ?? 1,
    water: hit.point.y <= WATER_LEVEL,
  };
}

// --- River banks -----------------------------------------------------------
// Thirsty land animals no longer walk to a pond spot: they walk to the
// nearest point of the water/land boundary. That boundary is found once per
// terrain load by classifying a coarse raycast grid and keeping every
// walkable land cell that touches a water cell.

interface EdgePoint {
  x: number;
  z: number;
}

const GRID_N = 64;
let waterEdges: EdgePoint[] | null = null;

function buildWaterEdges(): EdgePoint[] {
  const edges: EdgePoint[] = [];
  if (!terrainRoot) return edges;
  const bounds = new Box3().setFromObject(terrainRoot);
  const cells: (GroundSample | null)[] = new Array(GRID_N * GRID_N);
  const xs = new Array<number>(GRID_N);
  const zs = new Array<number>(GRID_N);
  for (let i = 0; i < GRID_N; i++) {
    xs[i] = bounds.min.x + ((i + 0.5) / GRID_N) * (bounds.max.x - bounds.min.x);
    zs[i] = bounds.min.z + ((i + 0.5) / GRID_N) * (bounds.max.z - bounds.min.z);
  }
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      cells[j * GRID_N + i] = sampleGround(xs[i], zs[j]);
    }
  }
  for (let j = 0; j < GRID_N; j++) {
    for (let i = 0; i < GRID_N; i++) {
      const cell = cells[j * GRID_N + i];
      if (!cell || cell.water || cell.normalY < MIN_GROUND_NORMAL_Y) continue;
      const neighbors = [
        i > 0 ? cells[j * GRID_N + i - 1] : null,
        i < GRID_N - 1 ? cells[j * GRID_N + i + 1] : null,
        j > 0 ? cells[(j - 1) * GRID_N + i] : null,
        j < GRID_N - 1 ? cells[(j + 1) * GRID_N + i] : null,
      ];
      if (neighbors.some((n) => n?.water)) {
        edges.push({ x: xs[i], z: zs[j] });
      }
    }
  }
  return edges;
}

// Nearest walkable land cell bordering water. Built lazily on first use so
// the BVH (installed by the parent <Bvh> effect) is guaranteed to exist.
export function nearestWaterEdge(x: number, z: number): EdgePoint | null {
  if (!terrainRoot) return null;
  waterEdges ??= buildWaterEdges();
  let best: EdgePoint | null = null;
  let bestDist = Infinity;
  for (const edge of waterEdges) {
    const dist = Math.hypot(edge.x - x, edge.z - z);
    if (dist < bestDist) {
      best = edge;
      bestDist = dist;
    }
  }
  return best;
}
