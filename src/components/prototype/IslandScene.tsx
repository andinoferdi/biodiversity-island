"use client";

import { Suspense, useSyncExternalStore } from "react";
import * as React from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { MapControls, useProgress } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
} from "@react-three/postprocessing";
import Animal from "./Animal";
import Sky from "./effects/Sky";
import Clouds from "./effects/Clouds";
import Rain from "./effects/Rain";
import { Log, Rock, TerrainGLB, Tree, AppleTreeModel, AppleModel, GrassModel } from "./EnvironmentModels";
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

// MapControls hanya dipasang selama kamera default masih ortografis; saat
// mode POV, PerspectiveCamera menjadi default sehingga kontrol dilepas dan
// terpasang kembali begitu keluar dari POV (posisi kamera tetap tersimpan).
function CustomMapControls({ isPOV }: { isPOV: boolean }) {
  const camera = useThree((state) => state.camera);

  if (camera.type !== "OrthographicCamera") return null;

  return (
    <MapControls
      camera={camera}
      enabled={!isPOV}
      enableDamping
      dampingFactor={0.08}
      minZoom={54}
      maxZoom={360}
      maxPolarAngle={Math.PI / 2.4}
      target={[0, TERRAIN_Y, 0]}
    />
  );
}

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
      <AppleTreeModel scale={0.05} />
      
      {/* Grass patches around the tree base */}
      {[
        [0.15, 0.15, 0],
        [-0.15, 0.25, 1.2],
        [0.25, -0.15, 2.5],
        [-0.2, -0.25, 3.8],
        [0.0, -0.35, 5.1],
        [-0.35, 0.0, 0.8],
      ].map(([gx, gz, rotY], i) => (
        <group key={`grass-${i}`} position={[gx, 0.0, gz]} rotation={[0, rotY, 0]}>
          <GrassModel scale={0.4} />
        </group>
      ))}
      {[
        [-0.2, 0.2, 0.5],
        [0.2, 0.1, 1.2],
        [-0.1, -0.2, 2.5],
        [0.25, -0.15, 0.2],
        [-0.25, -0.1, 4.0],
        [0.05, 0.25, 5.1],
      ].map(([bx, bz, rotY], i) => (
        <group
          key={i}
          position={[bx, 0.01, bz]}
          rotation={[0, rotY, 0]}
        >
          <AppleModel scale={0.3} />
        </group>
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
  const terrainReady = useSyncExternalStore(
    subscribeTerrain,
    isTerrainReady,
    () => false,
  );
  const { progress } = useProgress();
  // Wait for BOTH: terrain BVH built (raycasts work) AND all GLBs fully
  // downloaded (animals, environment, terrain). The preload calls in
  // AnimalModel.tsx and EnvironmentModels.tsx feed into drei's progress.
  const allReady = terrainReady && progress >= 100;
  if (allReady) return null;
  return (
    <div
      className="absolute inset-0 z-10 flex items-end justify-center bg-slate-950 bg-cover bg-center pb-12"
      style={{ backgroundImage: `url(${TERRAIN_THUMBNAIL_URL})` }}
    >
      <div className="rounded-lg bg-slate-950/80 px-4 py-2 text-sm text-slate-100">
        Loading island… {Math.round(progress)}%
      </div>
    </div>
  );
}

export type GraphicQuality = "low" | "medium" | "high";

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
  graphicQuality: GraphicQuality;
  isRaining: boolean;
  isCloudy: boolean;
  isPOV: boolean;
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
  graphicQuality,
  isRaining,
  isCloudy,
  isPOV,
}: IslandSceneProps) {
  return (
    <div className="relative h-full w-full">
      <Canvas
        orthographic
        shadows={graphicQuality !== "low" ? "percentage" : false}
        camera={{ position: [-24, 0, 36], zoom: 80, near: 0.01, far: 120 }}
        onPointerMissed={onDeselect}
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-900 p-6 text-center text-slate-100">
            WebGL is not available in this browser, so the 3D island cannot be
            displayed.
          </div>
        }
      >
        <Sky graphicQuality={graphicQuality} timeScale={timeScale} isRaining={isRaining} />
        <Sea />
        {/* The terrain and vegetation GLBs suspend while streaming in; the
            HTML overlay below covers the wait, and the animals hold still
            until the ground raycasts start hitting. */}
        <Suspense fallback={null}>
          <TerrainGLB />
          <Vegetation />
          {RESOURCES.map((spot) => (
            <Resource key={spot.id} spot={spot} />
          ))}
        </Suspense>
        {isCloudy && <Clouds isRaining={isRaining} timeScale={timeScale} />}
        <Rain
          key={graphicQuality}
          isRaining={isRaining}
          timeScale={timeScale}
          graphicQuality={graphicQuality}
        />
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
            isRaining={isRaining}
            isPOV={isPOV && spawn.id === selectedId}
          />
        ))}
        <CustomMapControls isPOV={isPOV} />
        {graphicQuality !== "low" && (
          <EffectComposer multisampling={graphicQuality === "high" ? 8 : 4}>
            <Bloom
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
              intensity={graphicQuality === "high" ? 0.35 : 0.2}
            />
            <BrightnessContrast
              brightness={0}
              contrast={graphicQuality === "high" ? 0.1 : 0.05}
            />
          </EffectComposer>
        )}
      </Canvas>
      <TerrainLoadingOverlay />
    </div>
  );
}
