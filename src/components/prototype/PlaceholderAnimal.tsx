"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Group } from "three";

export interface AnimalPosition {
  x: number;
  z: number;
}

interface PlaceholderAnimalProps {
  groundY: number;
  walkRadius: number;
  selected: boolean;
  onSelect: () => void;
  positionRef: React.RefObject<AnimalPosition>;
}

const MOVE_SPEED = 1.2;
const TURN_SPEED = 2.2;

const BODY_COLOR = "#c47a3d";
const BODY_COLOR_SELECTED = "#e09454";

export default function PlaceholderAnimal({
  groundY,
  walkRadius,
  selected,
  onSelect,
  positionRef,
}: PlaceholderAnimalProps) {
  const groupRef = useRef<Group>(null);
  // Per-frame movement state lives in a ref so animation never triggers React renders.
  const motion = useRef({
    x: 2,
    z: 0,
    heading: 0,
    headingTarget: 0,
    wanderTimer: 0,
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const m = motion.current;

    // Pick a new wander direction every few seconds.
    m.wanderTimer -= delta;
    if (m.wanderTimer <= 0) {
      m.wanderTimer = 2 + Math.random() * 3;
      m.headingTarget = m.heading + (Math.random() - 0.5) * Math.PI;
    }

    // Near the shoreline, steer back toward the island center instead of bouncing.
    const distFromCenter = Math.hypot(m.x, m.z);
    if (distFromCenter > walkRadius * 0.85) {
      m.headingTarget = Math.atan2(-m.x, -m.z);
    }

    // Turn smoothly along the shortest arc toward the target heading.
    const diff = Math.atan2(
      Math.sin(m.headingTarget - m.heading),
      Math.cos(m.headingTarget - m.heading)
    );
    m.heading += diff * Math.min(1, TURN_SPEED * delta);

    m.x += Math.sin(m.heading) * MOVE_SPEED * delta;
    m.z += Math.cos(m.heading) * MOVE_SPEED * delta;

    // Hard clamp as a safety net so the animal can never leave the grass.
    const dist = Math.hypot(m.x, m.z);
    if (dist > walkRadius) {
      m.x *= walkRadius / dist;
      m.z *= walkRadius / dist;
    }

    group.position.set(m.x, groundY, m.z);
    group.rotation.y = m.heading;

    positionRef.current.x = m.x;
    positionRef.current.z = m.z;
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    document.body.style.cursor = "";
  };

  const bodyColor = selected ? BODY_COLOR_SELECTED : BODY_COLOR;

  return (
    <group
      ref={groupRef}
      position={[2, groundY, 0]}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.6, 0.5, 1.1]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={selected ? "#7a3d10" : "#000000"}
        />
      </mesh>
      <mesh castShadow position={[0, 0.85, 0.65]}>
        <sphereGeometry args={[0.26, 16, 16]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={selected ? "#7a3d10" : "#000000"}
        />
      </mesh>
      {[
        [-0.2, 0.45],
        [0.2, 0.45],
        [-0.2, -0.45],
        [0.2, -0.45],
      ].map(([lx, lz]) => (
        <mesh key={`${lx},${lz}`} castShadow position={[lx, 0.15, lz]}>
          <boxGeometry args={[0.14, 0.3, 0.14]} />
          <meshStandardMaterial color="#9c5f2e" />
        </mesh>
      ))}
      <mesh castShadow position={[0, 0.6, -0.65]} rotation={[0.6, 0, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.35]} />
        <meshStandardMaterial color="#9c5f2e" />
      </mesh>
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1, 40]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}
    </group>
  );
}
