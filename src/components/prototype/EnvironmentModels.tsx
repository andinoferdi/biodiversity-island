"use client";

import { useEffect, useMemo } from "react";
import { Bvh, Clone, useGLTF } from "@react-three/drei";
import { setTerrainRoot, TERRAIN_SCALE, TERRAIN_URL, TERRAIN_Y } from "./terrain";

// First GLB pipeline of the project: the three small environment models are
// loaded once via useGLTF, rendered per instance with drei <Clone> (shared
// geometry/material), and preloaded so Suspense resolves quickly.
const TREE_URL = "/assets/environment/tree/tree.glb";
const ROCK_URL = "/assets/environment/rock/rock.glb";
const LOG_URL = "/assets/environment/log/log.glb";

useGLTF.preload(TREE_URL);
useGLTF.preload(ROCK_URL);
useGLTF.preload(LOG_URL);
useGLTF.preload(TERRAIN_URL);

// The island landmass: a single low-poly GLB with hills, cliffs, a river,
// and its water surfaces. <Bvh> builds a bounds tree for every mesh inside,
// which is what keeps the per-animal ground raycasts in Animal.tsx cheap.
// On mount the scene registers itself with terrain.ts so those raycasts
// (and the loading overlay in IslandScene) can find it.
export function TerrainGLB() {
  const { scene } = useGLTF(TERRAIN_URL);
  useMemo(() => {
    scene.traverse((object) => {
      object.castShadow = true;
      object.receiveShadow = true;
    });
  }, [scene]);
  useEffect(() => {
    // The transform props below were applied during render; make sure the
    // world matrices reflect them before the first raycast runs.
    scene.updateMatrixWorld(true);
    setTerrainRoot(scene);
    return () => setTerrainRoot(null);
  }, [scene]);
  return (
    <Bvh firstHitOnly>
      <primitive
        object={scene}
        position={[0, TERRAIN_Y, 0]}
        scale={TERRAIN_SCALE}
      />
    </Bvh>
  );
}

// Loads a GLB scene and enables shadow casting on all of its meshes once;
// <Clone> copies the flag onto every instance. Decided here, not per call
// site.
function useShadowedScene(url: string) {
  const { scene } = useGLTF(url);
  useMemo(() => {
    scene.traverse((object) => {
      object.castShadow = true;
    });
  }, [scene]);
  return scene;
}

export interface ModelInstanceProps {
  x: number;
  z: number;
  groundY: number;
  scale?: number;
  rotY?: number;
}

// Per-model corrections (verified against the GLB bounding boxes and in the
// browser): the tree's origin sits ~1.25 above its base, so it is lifted by
// 1.25 × its base scale; rock and log already rest on their origin plane.
const TREE_SCALE = 0.5;
const TREE_LIFT = 1.25 * TREE_SCALE;
const ROCK_SCALE = 0.35;
const LOG_SCALE = 0.15;

export function Tree({ x, z, groundY, scale = 1, rotY = 0 }: ModelInstanceProps) {
  const scene = useShadowedScene(TREE_URL);
  return (
    <group position={[x, groundY, z]} rotation={[0, rotY, 0]} scale={scale}>
      <Clone object={scene} position={[0, TREE_LIFT, 0]} scale={TREE_SCALE} />
    </group>
  );
}

export function Rock({ x, z, groundY, scale = 1, rotY = 0 }: ModelInstanceProps) {
  const scene = useShadowedScene(ROCK_URL);
  return (
    <group position={[x, groundY, z]} rotation={[0, rotY, 0]} scale={scale}>
      <Clone object={scene} scale={ROCK_SCALE} />
    </group>
  );
}

export function Log({ x, z, groundY, scale = 1, rotY = 0 }: ModelInstanceProps) {
  const scene = useShadowedScene(LOG_URL);
  return (
    <group position={[x, groundY, z]} rotation={[0, rotY, 0]} scale={scale}>
      <Clone object={scene} scale={LOG_SCALE} />
    </group>
  );
}
