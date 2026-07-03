"use client";

import { Canvas } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import Animal from "./Animal";
import { getSpecies, type AnimalSpawn } from "./species";
import {
  RESOURCES,
  WALK_RADIUS,
  type AnimalVitals,
  type ResourceSpot,
  type TimeScale,
} from "./simulation";

const GROUND_Y = 0.9;

interface TreeSpec {
  x: number;
  z: number;
  scale: number;
  rotY: number;
}

const TREES: TreeSpec[] = [
  { x: 2.6, z: 2.1, scale: 1.0, rotY: 0.4 },
  { x: -3.1, z: 1.4, scale: 1.15, rotY: 1.2 },
  { x: -1.8, z: -3.4, scale: 0.9, rotY: 2.1 },
  { x: 3.9, z: -1.6, scale: 1.05, rotY: 0.8 },
  { x: 0.6, z: 4.3, scale: 1.2, rotY: 2.8 },
  { x: -4.4, z: -1.2, scale: 0.95, rotY: 1.7 },
  { x: 4.6, z: 1.1, scale: 0.85, rotY: 3.0 },
  { x: -0.9, z: 2.9, scale: 1.1, rotY: 0.2 },
  { x: 1.7, z: -4.2, scale: 1.0, rotY: 1.4 },
  { x: -2.6, z: 4.0, scale: 0.9, rotY: 2.4 },
  { x: -4.1, z: 2.8, scale: 1.05, rotY: 0.6 },
  { x: 3.2, z: 3.8, scale: 0.95, rotY: 1.9 },
];

function Tree({ x, z, scale, rotY }: TreeSpec) {
  return (
    <group position={[x, GROUND_Y, z]} scale={scale} rotation={[0, rotY, 0]}>
      <mesh castShadow position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.12, 0.18, 1, 8]} />
        <meshStandardMaterial color="#6b4226" />
      </mesh>
      <mesh castShadow position={[0, 1.4, 0]}>
        <coneGeometry args={[0.7, 1.6, 10]} />
        <meshStandardMaterial color="#2f7d32" />
      </mesh>
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
      {TREES.map((tree) => (
        <Tree key={`${tree.x},${tree.z}`} {...tree} />
      ))}
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
