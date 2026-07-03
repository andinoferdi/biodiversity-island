"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
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
  const { scene, materials } = useGLTF(TERRAIN_URL) as any;
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useMemo(() => {
    let treeCenters: {x: number, z: number}[] = [];
    
    // First pass: discover spruce tree centers dynamically
    scene.traverse((object: any) => {
      if (object.isMesh && object.geometry && object.material === materials.mat9) {
        if (!object.geometry.userData.treeCenters) {
           const posAttr = object.geometry.attributes.position;
           const posArray = posAttr.array;
           const clusters: any[] = [];
           for (let i = 0; i < posAttr.count; i++) {
             const x = posArray[i * 3];
             const y = posArray[i * 3 + 1];
             const z = posArray[i * 3 + 2];
             let found = false;
             for (const c of clusters) {
               const dx = c.x - x, dy = c.y - y, dz = c.z - z;
               if (dx*dx + dy*dy + dz*dz < 0.09) { // 0.3 radius squared
                 c.x = (c.x * c.count + x) / (c.count + 1);
                 c.y = (c.y * c.count + y) / (c.count + 1);
                 c.z = (c.z * c.count + z) / (c.count + 1);
                 c.maxY = Math.max(c.maxY, y);
                 c.count++;
                 found = true;
                 break;
               }
             }
             if (!found) clusters.push({x, y, z, count: 1, maxY: y});
           }
           // Only spruce trees have a maxY > 0.1 (bushes are shorter)
           object.geometry.userData.treeCenters = clusters.filter(c => c.maxY > 0.1);
        }
        treeCenters = object.geometry.userData.treeCenters;
      }
    });

    scene.traverse((object: any) => {
      object.castShadow = true;
      object.receiveShadow = true;

      // Remove spruce trees (mat9 canopies, mat20 trunks) so we can replace them with tree.glb
      if (object.isMesh && object.geometry && (object.material === materials.mat9 || object.material === materials.mat20)) {
        if (!object.geometry.userData.spruceRemoved) {
          object.geometry.userData.spruceRemoved = true;
          const posAttr = object.geometry.attributes.position;
          const posArray = posAttr.array;
          let modified = false;
          for (let i = 0; i < posAttr.count; i++) {
            const x = posArray[i * 3];
            const y = posArray[i * 3 + 1];
            const z = posArray[i * 3 + 2];
            for (const center of treeCenters) {
               const dx = x - center.x;
               const dz = z - center.z;
               const dist2 = dx * dx + dz * dz;
               if (dist2 < 0.15) { // 0.38 radius to catch all connected canopy vertices
                 if (object.material === materials.mat9) {
                   posArray[i*3] = center.x; posArray[i*3+1] = -5; posArray[i*3+2] = center.z;
                   modified = true;
                   break;
                 } else if (object.material === materials.mat20 && dist2 < 0.04) {
                   // trunks are thin, only remove mat20 within 0.20 radius so we don't hit the bridge
                   posArray[i*3] = center.x; posArray[i*3+1] = -5; posArray[i*3+2] = center.z;
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
      }

      // Scale the bridge up (mat20). We modify the CPU geometry so that the
      // BVH raycasting for animal physics matches the new visual size!
      if (object.isMesh && object.geometry && object.material === materials.mat20) {
        if (!object.geometry.userData.bridgeScaled) {
          object.geometry.userData.bridgeScaled = true;
          const posAttr = object.geometry.attributes.position;
          const posArray = posAttr.array;
          let modified = false;
          for (let i = 0; i < posAttr.count; i++) {
            const x = posArray[i * 3];
            const y = posArray[i * 3 + 1];
            const z = posArray[i * 3 + 2];
            const dx = x - (-0.155);
            const dy = y - (-0.10);
            const dz = z - 0.158;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            // The bridge fits perfectly within a 0.28 local radius.
            if (dist < 0.28) {
              posArray[i * 3] = -0.155 + dx * 1.5;
              posArray[i * 3 + 1] = -0.10 + dy * 1.5;
              posArray[i * 3 + 2] = 0.158 + dz * 1.5;
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
      }
    });

    // Apply wave shader to water materials (mat3 and mat4)
    const waterMats = [materials.mat3, materials.mat4].filter(Boolean);
    waterMats.forEach((mat) => {
      if (!mat.userData.shaderHooked) {
        mat.userData.shaderHooked = true;
        mat.onBeforeCompile = (shader: any) => {
          shader.uniforms.uTime = uniforms.uTime;
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
    });

    // Apply wind sway shader to spruce trees/bushes (mat9)
    if (materials.mat9 && !materials.mat9.userData.shaderHooked) {
      materials.mat9.userData.shaderHooked = true;
      materials.mat9.onBeforeCompile = (shader: any) => {
        shader.uniforms.uTime = uniforms.uTime;
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
          transformed.x += swayX;
          transformed.z += swayZ;
          `
        );
      };
      materials.mat9.needsUpdate = true;
    }
  }, [scene, materials, uniforms]);

  useEffect(() => {
    // The transform props below were applied during render; make sure the
    // world matrices reflect them before the first raycast runs.
    scene.updateMatrixWorld(true);
    setTerrainRoot(scene);
    return () => setTerrainRoot(null);
  }, [scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    uniforms.uTime.value += dt;
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
  const { nodes } = useGLTF(TREE_URL) as any;
  const canopyRef = useRef<THREE.Group>(null);
  
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const timeAccum = useRef(phase);

  useFrame((_, delta) => {
    if (!canopyRef.current) return;
    const dt = Math.min(delta, 0.1);
    timeAccum.current += dt;
    const t = timeAccum.current;
    
    // Procedural wind swaying for the canopy
    const swayX = (Math.sin(t * 1.5) + Math.sin(t * 2.7) * 0.5) * 0.04;
    const swayZ = (Math.cos(t * 1.2) + Math.cos(t * 3.1) * 0.5) * 0.04;
    
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
