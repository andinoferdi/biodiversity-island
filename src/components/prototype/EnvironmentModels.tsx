"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Bvh, Clone, useGLTF } from "@react-three/drei";
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { setTerrainRoot, TERRAIN_SCALE, TERRAIN_URL, TERRAIN_Y } from "./terrain";
import { WIND } from "./effects/weather";

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

const APPLE_TREE_URL = "/assets/environment/apple_tree/apple_tree.glb";
const APPLE_URL = "/assets/environment/apple/apple.glb";
const GRASS_URL = "/assets/environment/grass/grass.glb";

useGLTF.preload(APPLE_TREE_URL);
useGLTF.preload(APPLE_URL);
useGLTF.preload(GRASS_URL);

type GLTFMaterials = Record<string, THREE.Material & { userData: Record<string, unknown> }>;

interface TreeCenter { x: number; y: number; z: number; count: number; maxY: number }

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

// Shared time uniform for the terrain's procedural shaders (river ripple,
// spruce sway). Module-level so it can be wired during render-time surgery
// and advanced from the frame loop without touching memoized values.
const TERRAIN_TIME = { value: 0 };

const SPRUCE_CLUSTER_RADIUS_SQ = 0.09; // 0.3 radius squared
const SPRUCE_MIN_HEIGHT = 0.1; // only spruce trees exceed this (bushes are shorter)
const SPRUCE_CANOPY_RADIUS_SQ = 0.15; // 0.38 radius to catch all connected canopy vertices
const SPRUCE_TRUNK_RADIUS_SQ = 0.04; // trunks are thin; 0.20 radius so we don't hit the bridge
const SPRUCE_SINK_Y = -5;
const BRIDGE_CENTER = { x: -0.155, y: -0.10, z: 0.158 };
const BRIDGE_RADIUS = 0.28; // the bridge fits perfectly within this local radius
const BRIDGE_SCALE = 1.5;

function enableShadows(scene: THREE.Object3D): void {
  scene.traverse((object) => {
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

// Pass 1: discover spruce tree cluster centers from mat9 (canopy) vertices.
function collectSpruceCenters(scene: THREE.Object3D, materials: GLTFMaterials): TreeCenter[] {
  let treeCenters: TreeCenter[] = [];
  scene.traverse((object) => {
    if (isMesh(object) && object.geometry && object.material === materials.mat9) {
      if (!object.geometry.userData.treeCenters) {
        const posAttr = object.geometry.attributes.position;
        const posArray = posAttr.array;
        const clusters: TreeCenter[] = [];
        for (let i = 0; i < posAttr.count; i++) {
          const x = posArray[i * 3];
          const y = posArray[i * 3 + 1];
          const z = posArray[i * 3 + 2];
          let found = false;
          for (const c of clusters) {
            const dx = c.x - x, dy = c.y - y, dz = c.z - z;
            if (dx * dx + dy * dy + dz * dz < SPRUCE_CLUSTER_RADIUS_SQ) {
              c.x = (c.x * c.count + x) / (c.count + 1);
              c.y = (c.y * c.count + y) / (c.count + 1);
              c.z = (c.z * c.count + z) / (c.count + 1);
              c.maxY = Math.max(c.maxY, y);
              c.count++;
              found = true;
              break;
            }
          }
          if (!found) clusters.push({ x, y, z, count: 1, maxY: y });
        }
        object.geometry.userData.treeCenters = clusters.filter(
          (c) => c.maxY > SPRUCE_MIN_HEIGHT,
        );
      }
      treeCenters = object.geometry.userData.treeCenters as TreeCenter[];
    }
  });
  return treeCenters;
}

// Pass 2: sink spruce canopy (mat9) and trunk (mat20) vertices to y=-5 so
// the GLB spruces are replaced by the standalone tree.glb models.
function removeSpruceTrees(
  scene: THREE.Object3D,
  materials: GLTFMaterials,
  centers: TreeCenter[],
): void {
  scene.traverse((object) => {
    if (
      isMesh(object) &&
      object.geometry &&
      (object.material === materials.mat9 || object.material === materials.mat20)
    ) {
      if (object.geometry.userData.spruceRemoved) return;
      object.geometry.userData.spruceRemoved = true;
      const posAttr = object.geometry.attributes.position;
      const posArray = posAttr.array;
      let modified = false;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posArray[i * 3];
        const z = posArray[i * 3 + 2];
        for (const center of centers) {
          const dx = x - center.x;
          const dz = z - center.z;
          const dist2 = dx * dx + dz * dz;
          if (dist2 < SPRUCE_CANOPY_RADIUS_SQ) {
            if (object.material === materials.mat9) {
              posArray[i * 3] = center.x;
              posArray[i * 3 + 1] = SPRUCE_SINK_Y;
              posArray[i * 3 + 2] = center.z;
              modified = true;
              break;
            } else if (
              object.material === materials.mat20 &&
              dist2 < SPRUCE_TRUNK_RADIUS_SQ
            ) {
              posArray[i * 3] = center.x;
              posArray[i * 3 + 1] = SPRUCE_SINK_Y;
              posArray[i * 3 + 2] = center.z;
              modified = true;
              break;
            }
          }
        }
      }
      if (modified) {
        posAttr.needsUpdate = true;
        object.geometry.computeBoundingBox();
        object.geometry.computeBoundingSphere();
        object.geometry.computeVertexNormals();
      }
    }
  });
}

// Scale the bridge up (mat20). We modify the CPU geometry so that the
// BVH raycasting for animal physics matches the new visual size!
function scaleBridge(scene: THREE.Object3D, materials: GLTFMaterials): void {
  scene.traverse((object) => {
    if (isMesh(object) && object.geometry && object.material === materials.mat20) {
      if (object.geometry.userData.bridgeScaled) return;
      object.geometry.userData.bridgeScaled = true;
      const posAttr = object.geometry.attributes.position;
      const posArray = posAttr.array;
      let modified = false;
      for (let i = 0; i < posAttr.count; i++) {
        const dx = posArray[i * 3] - BRIDGE_CENTER.x;
        const dy = posArray[i * 3 + 1] - BRIDGE_CENTER.y;
        const dz = posArray[i * 3 + 2] - BRIDGE_CENTER.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < BRIDGE_RADIUS) {
          posArray[i * 3] = BRIDGE_CENTER.x + dx * BRIDGE_SCALE;
          posArray[i * 3 + 1] = BRIDGE_CENTER.y + dy * BRIDGE_SCALE;
          posArray[i * 3 + 2] = BRIDGE_CENTER.z + dz * BRIDGE_SCALE;
          modified = true;
        }
      }
      if (modified) {
        posAttr.needsUpdate = true;
        object.geometry.computeBoundingBox();
        object.geometry.computeBoundingSphere();
        // Recompute normals for accurate lighting on the scaled logs
        object.geometry.computeVertexNormals();
      }
    }
  });
}

// Procedural river ripple on the water materials (mat3/mat4).
function hookRiverWaves(materials: GLTFMaterials, uTime: { value: number }): void {
  const waterMats = [materials.mat3, materials.mat4].filter(Boolean);
  for (const mat of waterMats) {
    if (mat.userData.shaderHooked) continue;
    mat.userData.shaderHooked = true;
    mat.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uTime = uTime;
      shader.vertexShader = `
        uniform float uTime;
        ${shader.vertexShader}
      `;
      shader.vertexShader = shader.vertexShader.replace(
        `#include <begin_vertex>`,
        `
        #include <begin_vertex>
        // Subtle procedural river ripple
        float wave = sin(position.x * 8.0 + uTime * 2.0) * 0.006 +
                     sin(position.z * 6.0 + uTime * 2.5) * 0.006;
        transformed.y += wave;
        `
      );
    };
    mat.needsUpdate = true;
  }
}

// Wind sway on the remaining spruce/bush canopies (mat9), biased along the
// shared WIND direction so trees lean the same way the clouds and rain move.
function hookSpruceSway(materials: GLTFMaterials, uTime: { value: number }): void {
  if (!materials.mat9 || materials.mat9.userData.shaderHooked) return;
  materials.mat9.userData.shaderHooked = true;
  const biasX = (WIND.x * 0.015).toFixed(4);
  const biasZ = (WIND.z * 0.015).toFixed(4);
  materials.mat9.onBeforeCompile = (shader: THREE.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uTime = uTime;
    shader.vertexShader = `
      uniform float uTime;
      ${shader.vertexShader}
    `;
    shader.vertexShader = shader.vertexShader.replace(
      `#include <begin_vertex>`,
      `
      #include <begin_vertex>
      // Procedural wind sway for vegetation.
      // Sway is stronger higher up; bottom of canopy is approx y=-0.11
      float swayAmount = max(0.0, position.y + 0.2) * 0.02;
      float swayX = sin(uTime * 1.5 + position.x * 2.0 + position.z) * swayAmount;
      float swayZ = cos(uTime * 1.2 + position.z * 2.0 + position.x) * swayAmount;
      transformed.x += swayX + float(${biasX});
      transformed.z += swayZ + float(${biasZ});
      `
    );
  };
  materials.mat9.needsUpdate = true;
}

// The island landmass: a single low-poly GLB with hills, cliffs, a river,
// and its water surfaces. <Bvh> builds a bounds tree for every mesh inside,
// which is what keeps the per-animal ground raycasts in Animal.tsx cheap.
// On mount the scene registers itself with terrain.ts so those raycasts
// (and the loading overlay in IslandScene) can find it.
export function TerrainGLB() {
  const { scene, materials } = useGLTF(TERRAIN_URL) as unknown as {
    scene: THREE.Group;
    materials: GLTFMaterials;
  };

  // The surgery must run during render (before <Bvh> builds its bounds tree
  // from the modified geometry), and each step self-guards via userData
  // flags so it only ever runs once per loaded GLB.
  useMemo(() => {
    enableShadows(scene);
    const centers = collectSpruceCenters(scene, materials);
    removeSpruceTrees(scene, materials, centers);
    scaleBridge(scene, materials);
    hookRiverWaves(materials, TERRAIN_TIME);
    hookSpruceSway(materials, TERRAIN_TIME);
  }, [scene, materials]);

  useEffect(() => {
    // The transform props below were applied during render; make sure the
    // world matrices reflect them before the first raycast runs.
    scene.updateMatrixWorld(true);
    setTerrainRoot(scene);
    return () => setTerrainRoot(null);
  }, [scene]);

  useFrame((_, delta) => {
    TERRAIN_TIME.value += Math.min(delta, 0.1);
  });

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
  const { nodes } = useGLTF(TREE_URL) as unknown as {
    nodes: Record<string, THREE.Mesh>;
  };
  const canopyRef = useRef<THREE.Group>(null);

  // Deterministic per-tree phase from position (no Math.random in useMemo).
  const phase = useMemo(() => ((x * 7.31 + z * 3.17) % (Math.PI * 2)), [x, z]);
  const timeAccum = useRef(phase);

  useFrame((_, delta) => {
    if (!canopyRef.current) return;
    const dt = Math.min(delta, 0.1);
    timeAccum.current += dt;
    const t = timeAccum.current;

    // Procedural wind swaying for the canopy, biased along the shared WIND.
    const swayX = (Math.sin(t * 1.5) + Math.sin(t * 2.7) * 0.5) * 0.04 + WIND.x * 0.015;
    const swayZ = (Math.cos(t * 1.2) + Math.cos(t * 3.1) * 0.5) * 0.04 + WIND.z * 0.015;

    canopyRef.current.rotation.set(swayX, 0, swayZ);
  });

  return (
    <group position={[x, groundY, z]} rotation={[0, rotY, 0]} scale={scale}>
      <group position={[0, TREE_LIFT, 0]} scale={TREE_SCALE}>
        {/* Trunk (static) */}
        <mesh
          castShadow
          receiveShadow
          geometry={nodes['Node-Mesh_1'].geometry}
          material={nodes['Node-Mesh_1'].material}
        />
        {/* Canopy (swaying) */}
        <group ref={canopyRef}>
          <mesh
            castShadow
            receiveShadow
            geometry={nodes['Node-Mesh'].geometry}
            material={nodes['Node-Mesh'].material}
          />
        </group>
      </group>
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

export function AppleTreeModel({ scale = 1 }: { scale?: number }) {
  const scene = useShadowedScene(APPLE_TREE_URL);
  return <Clone object={scene} scale={scale} />;
}

export function AppleModel({ scale = 1 }: { scale?: number }) {
  const scene = useShadowedScene(APPLE_URL);
  return <Clone object={scene} scale={scale} />;
}

export function GrassModel({ scale = 1 }: { scale?: number }) {
  const { scene } = useGLTF(GRASS_URL);

  const { geometry, material } = useMemo(() => {
    scene.updateMatrixWorld(true);
    const geometries: THREE.BufferGeometry[] = [];
    let mat: THREE.Material | null = null;

    scene.traverse((child) => {
      if (isMesh(child) && child.geometry) {
        if (!mat) {
          mat = Array.isArray(child.material) ? child.material[0] : child.material;
        }
        const geom = child.geometry.clone();
        geom.applyMatrix4(child.matrixWorld);
        geometries.push(geom);
      }
    });

    const mergedGeometry = geometries.length > 0
      ? BufferGeometryUtils.mergeGeometries(geometries, false)
      : new THREE.BufferGeometry();

    return { geometry: mergedGeometry, material: mat };
  }, [scene]);

  if (!material) return null;

  return (
    <mesh
      geometry={geometry}
      material={material}
      scale={scale}
      castShadow
      receiveShadow
    />
  );
}
