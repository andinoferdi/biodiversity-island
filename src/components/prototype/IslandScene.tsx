"use client";

import { Suspense, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { MapControls, useProgress } from "@react-three/drei";
import Animal from "./Animal";
import { Log, Rock, TerrainGLB, Tree } from "./EnvironmentModels";
import {
  isTerrainReady,
  subscribeTerrain,
  TERRAIN_THUMBNAIL_URL,
  TERRAIN_Y,
  VEGETATION,
} from "./terrain";
import { getSpecies, type AnimalSpawn } from "./species";
import {
  RESOURCES,
  type AnimalVitals,
  type ResourceSpot,
  type TimeScale,
} from "./simulation";

const VEGETATION_COMPONENTS = { tree: Tree, rock: Rock, log: Log } as const;

function Vegetation() {
  return (
    <group>
      {VEGETATION.map((spec) => {
        const Model = VEGETATION_COMPONENTS[spec.kind];
        return (
          <Model
            key={`${spec.kind}:${spec.x},${spec.z}`}
            x={spec.x}
            z={spec.z}
            groundY={spec.y}
            scale={spec.scale}
            rotY={spec.rotY}
          />
        );
      })}
    </group>
  );
}

// Food patches carry no pointer handlers so clicks on them still reach the
// Canvas onPointerMissed deselect. The river in the terrain model replaced
// the old pond resources entirely.
function Resource({ spot }: { spot: ResourceSpot }) {
  return (
    <group position={[spot.x, spot.y, spot.z]}>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[spot.radius, 24]} />
        <meshStandardMaterial color="#8fae3c" />
      </mesh>
      {[
        [-0.25, 0.2],
        [0.25, 0.05],
        [0, -0.25],
      ].map(([bx, bz]) => (
        <mesh key={`${bx},${bz}`} castShadow position={[bx, 0.1, bz]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#c2452d" />
        </mesh>
      ))}
    </group>
  );
}

function Sea() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[45, 64]} />
      <meshStandardMaterial color="#123a5e" />
    </mesh>
  );
}

// HTML loading screen shown until the 2.3 MB terrain GLB registers itself:
// the thumbnail render of the island fills the screen so it is never blank.
function TerrainLoadingOverlay() {
  const ready = useSyncExternalStore(
    subscribeTerrain,
    isTerrainReady,
    () => false,
  );
  const { progress } = useProgress();
  if (ready) return null;
  return (
    <div
      className="absolute inset-0 z-10 flex items-end justify-center bg-slate-950 bg-cover bg-center pb-12"
      style={{ backgroundImage: `url(${TERRAIN_THUMBNAIL_URL})` }}
    >
      <div className="rounded-lg bg-slate-950/80 px-4 py-2 text-sm text-slate-100">
        Loading terrain… {Math.round(progress)}%
      </div>
    </div>
  );
}

interface IslandSceneProps {
  population: AnimalSpawn[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onDeath: (id: string) => void;
  onReproduce: (
    parent: AnimalSpawn,
    x: number,
    z: number,
    heading: number,
  ) => void;
  timeScale: TimeScale;
  vitalsRef: React.RefObject<AnimalVitals>;
}

export default function IslandScene({
  population,
  selectedId,
  onSelect,
  onDeselect,
  onDeath,
  onReproduce,
  timeScale,
  vitalsRef,
}: IslandSceneProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        shadows="percentage"
        camera={{ position: [12, 14, 12], zoom: 114, near: 0.01, far: 120 }}
        onPointerMissed={onDeselect}
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-900 p-6 text-center text-slate-100">
            WebGL is not available in this browser, so the 3D island cannot be
            displayed.
          </div>
        }
      >
        <hemisphereLight args={["#bfd9ff", "#3f5a36", 0.7]} />
        <directionalLight
          castShadow
          position={[10, 16, 8]}
          intensity={1.6}
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-12}
          shadow-camera-right={12}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <Sea />
        {/* The terrain and vegetation GLBs suspend while streaming in; the
            HTML overlay below covers the wait, and the animals hold still
            until the ground raycasts start hitting. */}
        <Suspense fallback={null}>
          <TerrainGLB />
          <Vegetation />
        </Suspense>
        {RESOURCES.map((spot) => (
          <Resource key={spot.id} spot={spot} />
        ))}
        {population.map((spawn) => (
          <Animal
            key={spawn.id}
            spawn={spawn}
            species={getSpecies(spawn.speciesId)}
            timeScale={timeScale}
            selected={spawn.id === selectedId}
            onSelect={onSelect}
            onDeath={onDeath}
            onReproduce={onReproduce}
            vitalsRef={vitalsRef}
          />
        ))}
        <MapControls
          enableDamping
          dampingFactor={0.08}
          minZoom={54}
          maxZoom={360}
          maxPolarAngle={Math.PI / 2.4}
          target={[0, TERRAIN_Y, 0]}
        />
      </Canvas>
      <TerrainLoadingOverlay />
    </div>
  );
}
