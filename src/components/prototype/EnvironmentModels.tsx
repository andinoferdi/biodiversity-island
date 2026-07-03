"use client";

import { useMemo } from "react";
import { Clone, useGLTF } from "@react-three/drei";

// First GLB pipeline of the project: the three small environment models are
// loaded once via useGLTF, rendered per instance with drei <Clone> (shared
// geometry/material), and preloaded so Suspense resolves quickly.
const TREE_URL = "/assets/environment/tree/tree.glb";
const ROCK_URL = "/assets/environment/rock/rock.glb";
const LOG_URL = "/assets/environment/log/log.glb";

useGLTF.preload(TREE_URL);
useGLTF.preload(ROCK_URL);
useGLTF.preload(LOG_URL);

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
const TREE_SCALE = 1.5;
const TREE_LIFT = 1.25 * TREE_SCALE;
const ROCK_SCALE = 1.1;
const LOG_SCALE = 0.45;

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
