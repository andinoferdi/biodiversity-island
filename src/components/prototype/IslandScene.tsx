"use client";

import { Canvas } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import PlaceholderAnimal, { type AnimalPosition } from "./PlaceholderAnimal";

const GROUND_Y = 0.9;
const WALK_RADIUS = 5.2;

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

function Sea() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <circleGeometry args={[45, 64]} />
      <meshStandardMaterial color="#123a5e" />
    </mesh>
  );
}

interface IslandSceneProps {
  selected: boolean;
  onSelect: () => void;
  onDeselect: () => void;
  animalPositionRef: React.RefObject<AnimalPosition>;
}

export default function IslandScene({
  selected,
  onSelect,
  onDeselect,
  animalPositionRef,
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
      <PlaceholderAnimal
        groundY={GROUND_Y}
        walkRadius={WALK_RADIUS}
        selected={selected}
        onSelect={onSelect}
        positionRef={animalPositionRef}
      />
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
