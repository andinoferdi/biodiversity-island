import { Box3 } from "three";
import { sampleGround, VEGETATION, isTerrainReady, subscribeTerrain } from "./terrain";
import type { Locomotion } from "./species";
import { MIN_GROUND_NORMAL_Y } from "./simulation";

export interface NavNode {
  x: number;
  z: number;
  gridX: number;
  gridY: number;
  water: boolean;
  walkable: boolean;
}

export class NavGrid {
  nodes: NavNode[][] = [];
  bounds: Box3;
  gridN: number;
  cellSizeX: number;
  cellSizeZ: number;

  constructor(bounds: Box3, gridN: number) {
    this.bounds = bounds;
    this.gridN = gridN;
    this.cellSizeX = (bounds.max.x - bounds.min.x) / gridN;
    this.cellSizeZ = (bounds.max.z - bounds.min.z) / gridN;
  }

  worldToGrid(x: number, z: number): { gridX: number, gridY: number } {
    let gridX = Math.floor((x - this.bounds.min.x) / this.cellSizeX);
    let gridY = Math.floor((z - this.bounds.min.z) / this.cellSizeZ);
    gridX = Math.max(0, Math.min(this.gridN - 1, gridX));
    gridY = Math.max(0, Math.min(this.gridN - 1, gridY));
    return { gridX, gridY };
  }

  gridToWorld(gridX: number, gridY: number): { x: number, z: number } {
    return {
      x: this.bounds.min.x + (gridX + 0.5) * this.cellSizeX,
      z: this.bounds.min.z + (gridY + 0.5) * this.cellSizeZ,
    };
  }

  getNode(gridX: number, gridY: number): NavNode | null {
    if (gridX < 0 || gridX >= this.gridN || gridY < 0 || gridY >= this.gridN) return null;
    return this.nodes[gridY][gridX];
  }
}

let cachedNavGrid: NavGrid | null = null;
const GRID_N = 128; // High resolution for A*

export function getNavGrid(): NavGrid | null {
  if (cachedNavGrid) return cachedNavGrid;
  if (!isTerrainReady()) return null;

  // We need to access terrainRoot from terrain.ts, but it's private.
  // However, we can just use a dummy bounding box if we know the size, or export bounds from terrain.ts.
  // Actually, we can just sample the ground at extreme points to find bounds, 
  // or hardcode the known bounds of the island (roughly -10 to +10).
  // Let's assume bounds are -12 to 12 for both X and Z based on typical spawns.
  const bounds = new Box3();
  bounds.min.set(-12, 0, -12);
  bounds.max.set(12, 0, 12);
  
  const grid = new NavGrid(bounds, GRID_N);
  
  for (let j = 0; j < GRID_N; j++) {
    const row: NavNode[] = [];
    for (let i = 0; i < GRID_N; i++) {
      const { x, z } = grid.gridToWorld(i, j);
      const ground = sampleGround(x, z);
      
      let walkable = ground !== null && ground.normalY >= MIN_GROUND_NORMAL_Y;
      const water = ground ? ground.water : false;

      // Check vegetation collision
      if (walkable) {
        for (const v of VEGETATION) {
          const dist = Math.hypot(x - v.x, z - v.z);
          const baseRadius = v.kind === "tree" ? 0.1 : (v.kind === "rock" ? 0.6 : 0.5);
          if (dist < v.scale * baseRadius + 0.1) {
            walkable = false;
            break;
          }
        }
      }

      row.push({ x, z, gridX: i, gridY: j, walkable, water });
    }
    grid.nodes.push(row);
  }

  cachedNavGrid = grid;
  return grid;
}

// Subscribe to terrain reloads to clear the cache
subscribeTerrain(() => {
  cachedNavGrid = null;
});

// A* Implementation
export function findPath(
  startX: number, startZ: number,
  endX: number, endZ: number,
  locomotion: Locomotion
): { x: number, z: number }[] | null {
  const grid = getNavGrid();
  if (!grid) return null;

  const startCoord = grid.worldToGrid(startX, startZ);
  const endCoord = grid.worldToGrid(endX, endZ);

  const startNode = grid.getNode(startCoord.gridX, startCoord.gridY);
  const endNode = grid.getNode(endCoord.gridX, endCoord.gridY);

  if (!startNode || !endNode) return null;

  // Helper to check if a node is traversable by this locomotion
  const canTraverse = (node: NavNode) => {
    if (!node.walkable) return false;
    if (locomotion === "aquatic" && !node.water) return false;
    if (locomotion === "terrestrial" && node.water) return false;
    return true; // amphibian and aerial can traverse anything walkable (or we can let aerial fly over unwalkable, but this is fine)
  };

  // If the exact end node is unwalkable (e.g. food inside a slightly steep area), 
  // we might want to still find a path *near* it. 
  // For simplicity, we just run standard A*.

  const openSet = new Set<NavNode>();
  const closedSet = new Set<NavNode>();
  
  const gScore = new Map<NavNode, number>();
  const fScore = new Map<NavNode, number>();
  const cameFrom = new Map<NavNode, NavNode>();

  openSet.add(startNode);
  gScore.set(startNode, 0);
  fScore.set(startNode, heuristic(startNode, endNode));

  let iterations = 0;
  const MAX_ITERATIONS = 2000; // safety limit to prevent frame drops

  while (openSet.size > 0) {
    if (iterations++ > MAX_ITERATIONS) return null;

    let current: NavNode | null = null;
    let lowestF = Infinity;
    for (const node of openSet) {
      const score = fScore.get(node) ?? Infinity;
      if (score < lowestF) {
        lowestF = score;
        current = node;
      }
    }

    if (!current) break;

    // If we reached the target or adjacent to it
    if (current === endNode || heuristic(current, endNode) <= 1.5) {
      return reconstructPath(cameFrom, current);
    }

    openSet.delete(current);
    closedSet.add(current);

    const neighbors = getNeighbors(grid, current);
    for (const neighbor of neighbors) {
      if (closedSet.has(neighbor)) continue;
      
      // If neighbor is not traversable, AND it's not the final destination
      if (!canTraverse(neighbor) && neighbor !== endNode) {
        continue;
      }

      // Diagonal movement has weight sqrt(2), orthog has 1
      const isDiagonal = neighbor.gridX !== current.gridX && neighbor.gridY !== current.gridY;
      const tentativeG = (gScore.get(current) ?? Infinity) + (isDiagonal ? 1.414 : 1.0);

      if (tentativeG < (gScore.get(neighbor) ?? Infinity)) {
        cameFrom.set(neighbor, current);
        gScore.set(neighbor, tentativeG);
        fScore.set(neighbor, tentativeG + heuristic(neighbor, endNode));
        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    }
  }

  return null; // no path found
}

function heuristic(a: NavNode, b: NavNode) {
  // Octile distance
  const dx = Math.abs(a.gridX - b.gridX);
  const dy = Math.abs(a.gridY - b.gridY);
  return 1.0 * (dx + dy) + (1.414 - 2.0) * Math.min(dx, dy);
}

function getNeighbors(grid: NavGrid, node: NavNode): NavNode[] {
  const neighbors: NavNode[] = [];
  for (let y = -1; y <= 1; y++) {
    for (let x = -1; x <= 1; x++) {
      if (x === 0 && y === 0) continue;
      const n = grid.getNode(node.gridX + x, node.gridY + y);
      if (n) neighbors.push(n);
    }
  }
  return neighbors;
}

function reconstructPath(cameFrom: Map<NavNode, NavNode>, current: NavNode): {x: number, z: number}[] {
  const path = [{ x: current.x, z: current.z }];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.push({ x: current.x, z: current.z });
  }
  path.reverse();
  // Remove the first node (which is the start position) to point to the next step
  if (path.length > 1) {
    path.shift();
  }
  return path;
}
