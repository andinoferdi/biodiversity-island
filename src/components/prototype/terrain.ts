import { Box3, Raycaster, Vector3, type Object3D } from "three";
import { WATER_LEVEL, MIN_GROUND_NORMAL_Y, WALK_RADIUS } from "./simulation";

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
  { kind: "tree", x: -4.6, y: 0.43, z: -3.2, scale: 0.95, rotY: 1.7 },
  { kind: "tree", x: 0.5, y: 0.43, z: -4.2, scale: 1.05, rotY: 0.6 },
  { kind: "rock", x: -1.5, y: 0.43, z: -5.0, scale: 1.0, rotY: 0.9 },
  { kind: "rock", x: 6.0, y: 0.59, z: -2.0, scale: 1.2, rotY: 2.0 },
  { kind: "rock", x: -6.2, y: 0.99, z: 3.2, scale: 0.85, rotY: 4.1 },
  { kind: "log", x: 0.5, y: 0.35, z: 4.8, scale: 1.0, rotY: 1.6 },
  { kind: "log", x: 5.8, y: 0.43, z: -0.5, scale: 0.9, rotY: 4.4 },
  { kind: "tree", x: 6.2, y: 0.43, z: -0.8, scale: 1.0, rotY: 1.1 },
  { kind: "tree", x: 1.5, y: 0.43, z: 2.0, scale: 0.95, rotY: 2.3 },
  { kind: "tree", x: -0.67, y: 0.43, z: 4.31, scale: 1.16, rotY: 4.22 },
  { kind: "tree", x: -4.31, y: 0.43, z: 3.89, scale: 0.87, rotY: 0.25 },
  { kind: "tree", x: -2.17, y: 0.43, z: 4.08, scale: 1.02, rotY: 3.42 },
  { kind: "tree", x: 0.64, y: 0.43, z: 1.80, scale: 0.90, rotY: 5.02 },
  { kind: "tree", x: 0.42, y: 0.43, z: -1.15, scale: 1.02, rotY: 1.87 },
  { kind: "tree", x: -1.50, y: 0.43, z: -0.02, scale: 1.04, rotY: 6.06 },
  { kind: "tree", x: -3.99, y: 0.43, z: 1.11, scale: 1.19, rotY: 0.92 },
  { kind: "tree", x: -5.71, y: 0.43, z: 2.20, scale: 0.92, rotY: 2.93 },
  { kind: "tree", x: -5.48, y: 0.43, z: 0.38, scale: 1.02, rotY: 4.99 },
  { kind: "tree", x: 3.52, y: 0.43, z: 4.29, scale: 1.12, rotY: 4.47 },
  { kind: "tree", x: 5.25, y: 0.43, z: 4.58, scale: 0.81, rotY: 2.87 },
  { kind: "tree", x: 5.27, y: 0.43, z: -2.04, scale: 0.97, rotY: 5.19 },
  { kind: "tree", x: 5.40, y: 0.43, z: -0.03, scale: 0.80, rotY: 4.68 },
  { kind: "tree", x: 3.75, y: 0.43, z: 3.08, scale: 1.03, rotY: 0.21 },
  { kind: "tree", x: 5.78, y: 0.43, z: 3.10, scale: 1.11, rotY: 5.86 },
  { kind: "tree", x: 5.94, y: 0.43, z: 2.27, scale: 1.12, rotY: 3.21 },
  { kind: "tree", x: 4.71, y: 0.43, z: -2.79, scale: 1.13, rotY: 0.53 },
  { kind: "tree", x: 5.39, y: 0.43, z: -3.92, scale: 1.05, rotY: 6.25 },
  { kind: "tree", x: 4.02, y: 0.43, z: -4.60, scale: 0.98, rotY: 2.48 },
  { kind: "tree", x: 3.98, y: 0.43, z: -5.12, scale: 0.89, rotY: 3.86 },
  { kind: "tree", x: -6.50, y: 0.43, z: 3.27, scale: 0.83, rotY: 4.68 },
  { kind: "tree", x: 5.90, y: 0.43, z: -5.43, scale: 0.98, rotY: 2.10 },
  { kind: "tree", x: 1.23, y: 0.43, z: -2.37, scale: 0.83, rotY: 0.35 },
  { kind: "tree", x: 2.17, y: 0.43, z: -3.35, scale: 1.10, rotY: 2.57 },
  { kind: "tree", x: 1.50, y: 0.43, z: -4.20, scale: 1.19, rotY: 3.13 },
  { kind: "tree", x: 0.52, y: 0.43, z: -4.03, scale: 1.11, rotY: 3.27 },
  { kind: "tree", x: -0.47, y: 0.43, z: -4.76, scale: 1.13, rotY: 3.62 },
  { kind: "tree", x: -1.22, y: 0.43, z: -3.71, scale: 0.86, rotY: 3.04 },
  { kind: "tree", x: -1.42, y: 0.43, z: -1.87, scale: 0.84, rotY: 5.77 },
  { kind: "tree", x: -3.71, y: 0.43, z: -0.35, scale: 1.05, rotY: 5.88 },
  { kind: "tree", x: -4.61, y: 0.43, z: -1.87, scale: 1.11, rotY: 2.97 },
  { kind: "tree", x: -6.44, y: 0.43, z: -1.93, scale: 1.11, rotY: 4.42 },
  { kind: "tree", x: -5.88, y: 0.43, z: -3.59, scale: 1.00, rotY: 0.78 },
  { kind: "tree", x: -4.83, y: 0.43, z: -3.36, scale: 0.96, rotY: 6.14 },
  { kind: "tree", x: -3.65, y: 0.43, z: -2.79, scale: 0.87, rotY: 6.14 },
  { kind: "tree", x: -3.55, y: 0.43, z: -1.82, scale: 1.15, rotY: 1.37 },
  { kind: "tree", x: -2.40, y: 0.43, z: -2.98, scale: 1.04, rotY: 1.02 },
  { kind: "tree", x: -3.53, y: 0.43, z: -4.54, scale: 0.98, rotY: 1.77 },
  { kind: "tree", x: -4.62, y: 0.43, z: -5.03, scale: 1.13, rotY: 2.36 },
  { kind: "tree", x: -0.90, y: 0.43, z: -5.57, scale: 1.01, rotY: 5.93 },
  { kind: "tree", x: 6.10, y: 0.43, z: 4.04, scale: 1.01, rotY: 2.71 },
  { kind: "tree", x: 6.28, y: 0.43, z: 0.50, scale: 1.02, rotY: 2.41 },
  { kind: "tree", x: -5.55, y: 0.43, z: -6.01, scale: 0.98, rotY: 2.78 },
  { kind: "tree", x: -3.74, y: 0.43, z: -5.43, scale: 1.19, rotY: 0.84 },
  { kind: "tree", x: -2.13, y: 0.43, z: -4.61, scale: 1.05, rotY: 3.67 },
  { kind: "tree", x: -1.34, y: 0.43, z: -5.68, scale: 0.86, rotY: 0.85 },
  { kind: "tree", x: 2.63, y: 0.43, z: -4.36, scale: 0.96, rotY: 3.29 },
];

let terrainRoot: Object3D | null = null;
const listeners = new Set<() => void>();

// Shared, recycled scratch objects — the frame loop never allocates.
const raycaster = new Raycaster();
// three-mesh-bvh handles standard raycasts very efficiently.
// We remove firstHitOnly so we can pierce through tall tree canopies.
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
// If currentY is provided, ignores any surfaces that are more than 1.5 units above it (e.g. tree canopies).
// null = no terrain there (either still loading, or past the mesh edge).
export function sampleGround(x: number, z: number, currentY?: number): GroundSample | null {
  if (!terrainRoot) return null;
  rayOrigin.set(x, RAY_HEIGHT, z);
  raycaster.set(rayOrigin, RAY_DOWN);
  const hits = raycaster.intersectObject(terrainRoot, true);
  
  // Find the highest flat surface (skipping steep tree canopies and anything too high)
  for (const hit of hits) {
    if (currentY !== undefined && hit.point.y - currentY > 1.5) continue;
    
    const normalY = hit.face?.normal.y ?? 1;
    if (normalY >= MIN_GROUND_NORMAL_Y) {
      return {
        y: hit.point.y,
        normalY,
        water: hit.point.y <= WATER_LEVEL,
      };
    }
  }

  // Fallback if no flat ground is found
  for (const hit of hits) {
    if (currentY !== undefined && hit.point.y - currentY > 1.5) continue;
    return {
      y: hit.point.y,
      normalY: hit.face?.normal.y ?? 1,
      water: hit.point.y <= WATER_LEVEL,
    };
  }
  
  return null;
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
        // Buang tepi pantai: skirt luar mesh turun di bawah WATER_LEVEL
        // (laut), sehingga tanpa filter ini hewan di barat daya dikirim ke
        // pantai di luar WALK_RADIUS — target yang mustahil dicapai karena
        // clamp, lalu mereka berosilasi di ring steer 0.85R sampai mati
        // dehidrasi. Hanya tepi sungai di dalam radius jelajah yang sah.
        if (Math.hypot(xs[i], zs[j]) > WALK_RADIUS - 0.3) continue;
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
