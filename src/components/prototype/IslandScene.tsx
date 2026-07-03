"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import Animal from "./Animal";
import { BIOMES } from "./biomes";
import { Log, Rock, Tree } from "./EnvironmentModels";
import { getSpecies, type AnimalSpawn } from "./species";
import {
  RESOURCES,
  WALK_RADIUS,
  type AnimalVitals,
  type ResourceSpot,
  type TimeScale,
} from "./simulation";

const GROUND_Y = 0.9;
// Radius of the biome ground wedges — matches the grass cylinder top.
const BIOME_RADIUS = 6.4;

interface VegetationSpec {
  kind: "tree" | "rock" | "log";
  x: number;
  z: number;
  scale: number;
  rotY: number;
}

// Deterministic vegetation layout, composed per biome: the forest sector
// (theta 0–120°) is dense trees + logs, the grassland (120–240°) sparse trees
// + rocks, the shore (240–360°) rocks + driftwood logs. All positions avoid
// the resource spots in simulation.ts.
const VEGETATION: VegetationSpec[] = [
  // Forest
  { kind: "tree", x: 4.4, z: -0.8, scale: 1.0, rotY: 0.4 },
  { kind: "tree", x: 5.0, z: -2.3, scale: 1.15, rotY: 1.2 },
  { kind: "tree", x: 3.3, z: -3.3, scale: 0.9, rotY: 2.1 },
  { kind: "tree", x: 4.8, z: -3.4, scale: 1.05, rotY: 0.8 },
  { kind: "tree", x: 3.3, z: -4.8, scale: 1.1, rotY: 2.8 },
  { kind: "tree", x: 1.5, z: -4.1, scale: 0.95, rotY: 1.7 },
  { kind: "tree", x: 0.5, z: -5.4, scale: 1.2, rotY: 3.0 },
  { kind: "tree", x: -0.4, z: -4.2, scale: 0.9, rotY: 0.2 },
  { kind: "tree", x: -1.8, z: -4.9, scale: 1.0, rotY: 1.4 },
  { kind: "log", x: 3.3, z: -0.9, scale: 1.0, rotY: 0.7 },
  { kind: "log", x: -0.6, z: -3.6, scale: 0.85, rotY: 2.3 },
  // Grassland
  { kind: "tree", x: -4.0, z: -4.0, scale: 1.05, rotY: 0.6 },
  { kind: "tree", x: -5.2, z: -0.5, scale: 0.95, rotY: 1.9 },
  { kind: "tree", x: -4.4, z: 3.7, scale: 1.1, rotY: 2.4 },
  { kind: "rock", x: -3.3, z: -2.3, scale: 1.0, rotY: 0.9 },
  { kind: "rock", x: -4.3, z: 1.1, scale: 1.2, rotY: 2.0 },
  { kind: "rock", x: -3.1, z: 3.7, scale: 0.85, rotY: 4.1 },
  // Shore
  { kind: "rock", x: -1.6, z: 4.3, scale: 1.1, rotY: 1.1 },
  { kind: "rock", x: 0.5, z: 5.5, scale: 0.9, rotY: 2.6 },
  { kind: "rock", x: 2.5, z: 4.6, scale: 1.25, rotY: 0.3 },
  { kind: "rock", x: 4.9, z: 0.9, scale: 1.0, rotY: 3.4 },
  { kind: "log", x: -0.9, z: 5.3, scale: 1.0, rotY: 1.6 },
  { kind: "log", x: 4.3, z: 3.6, scale: 0.9, rotY: 4.4 },
  { kind: "log", x: 3.9, z: 1.8, scale: 0.8, rotY: 2.9 },
];

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
            groundY={GROUND_Y}
            scale={spec.scale}
            rotY={spec.rotY}
          />
        );
      })}
    </group>
  );
}

function Island() {
  return (
    <group>
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[7.6, 8.4, 1.3, 48]} />
        <meshStandardMaterial color="#7d7468" />
      </mesh>
      <mesh receiveShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[7.1, 7.5, 0.4, 48]} />
        <meshStandardMaterial color="#dbc491" />
      </mesh>
      <mesh receiveShadow position={[0, 0.7, 0]}>
        <cylinderGeometry args={[6.4, 6.9, 0.4, 48]} />
        <meshStandardMaterial color="#4c9a3f" />
      </mesh>
      {/* Three tinted 120° wedges make the biome boundaries readable from the
          top-down camera. The wedge rotation maps geometry angle a to world
          direction (cos a, 0, -sin a) — the same convention as biomeAt(). */}
      {BIOMES.map((biome) => (
        <mesh
          key={biome.id}
          receiveShadow
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, GROUND_Y + 0.002, 0]}
        >
          <circleGeometry
            args={[BIOME_RADIUS, 48, biome.thetaStart, biome.thetaLength]}
          />
          <meshStandardMaterial color={biome.groundColor} />
        </mesh>
      ))}
    </group>
  );
}

// Pond and food patches carry no pointer handlers so clicks on them still
// reach the Canvas onPointerMissed deselect.
function Resource({ spot }: { spot: ResourceSpot }) {
  if (spot.kind === "water") {
    return (
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[spot.x, GROUND_Y + 0.01, spot.z]}
      >
        <circleGeometry args={[spot.radius, 32]} />
        <meshStandardMaterial color="#3b82c4" />
      </mesh>
    );
  }
  return (
    <group position={[spot.x, GROUND_Y, spot.z]}>
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

interface IslandSceneProps {
  population: AnimalSpawn[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeselect: () => void;
  onDeath: (id: string) => void;
  onReproduce: (parent: AnimalSpawn, x: number, z: number, heading: number) => void;
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
    <Canvas
      orthographic
      shadows="percentage"
      camera={{ position: [12, 14, 12], zoom: 38, near: 0.1, far: 120 }}
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
      <Island />
      {/* GLB vegetation suspends while the models stream in; the island,
          resources, and animals render immediately so the page is never
          blank. */}
      <Suspense fallback={null}>
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
          groundY={GROUND_Y}
          walkRadius={WALK_RADIUS}
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
        minZoom={18}
        maxZoom={120}
        maxPolarAngle={Math.PI / 2.4}
        target={[0, GROUND_Y, 0]}
      />
    </Canvas>
  );
}
