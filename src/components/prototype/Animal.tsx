"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { MathUtils, Vector3, type Group, type PerspectiveCamera as ThreePerspectiveCamera } from "three";
import AnimalModel from "./AnimalModel";
import { getSpecies, type AnimalSpawn, type Species } from "./species";
import { biomeForHeight } from "./biomes";
import { nearestWaterEdge, sampleGround, VEGETATION } from "./terrain";
import {
  DEATH_AFTER_CRITICAL, NEED_MAX, REPRODUCE_AFTER, REPRODUCTION_NEED_PENALTY,
  WELL_FED_LEVEL, WALK_RADIUS, liveAnimals, killRewards,
  KILL_HUNGER_RESTORE, EAT_PREY_DURATION,
  type AnimalStatus, type AnimalVitals, type TimeScale,
} from "./simulation";

// AI modules
import { initBrains, runBrain, isReady, type PerceptionVector } from "./animalBrain";
import { buildPerception, computeObstaclePush } from "./animalPerception";
import { decide, checkKilled } from "./animalDecision";
import { findPath } from "./pathfinding";

interface AnimalProps {
  spawn: AnimalSpawn;
  species: Species;
  timeScale: TimeScale;
  selected: boolean;
  onSelect: (id: string) => void;
  onDeath: (id: string) => void;
  onReproduce: (parent: AnimalSpawn, x: number, z: number, heading: number) => void;
  vitalsRef: React.RefObject<AnimalVitals>;
  isRaining: boolean;
  isPOV: boolean;
}

const MAX_FRAME_DELTA = 0.1;
const GROUND_SNAP_SPEED = 12;

// AI decision cadence: run neural network every N frames (cheap inference ~0.2ms)
const AI_TICK_INTERVAL = 0.12; // seconds between full perception+inference

// ── Keyboard controls (for selected/manual animal) ────────────────────────────
const CONTROL_KEYS = ["w","a","s","d","ArrowUp","ArrowLeft","ArrowDown","ArrowRight"," "] as const;
type ControlKey = (typeof CONTROL_KEYS)[number];
const JUMP_VELOCITY = 4;
const GRAVITY = 15;
const MANUAL_TURN_MULT = 2.0;

function useKeyboardControls(active: boolean) {
  const keys = useRef<Record<ControlKey, boolean>>(
    Object.fromEntries(CONTROL_KEYS.map(k => [k, false])) as Record<ControlKey, boolean>
  );
  useEffect(() => {
    if (!active) return;
    const isKey = (k: string): k is ControlKey => (CONTROL_KEYS as readonly string[]).includes(k);
    const dn = (e: KeyboardEvent) => { if (isKey(e.key)) keys.current[e.key] = true; };
    const up = (e: KeyboardEvent) => { if (isKey(e.key)) keys.current[e.key] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    const snap = keys.current;
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
      for (const k of CONTROL_KEYS) snap[k] = false;
    };
  }, [active]);
  return keys;
}

// ── POV Camera ────────────────────────────────────────────────────────────────
const POV_DEFAULT = { height: 0.3, back: 0.6, pitch: 0.15 };
const POV_DAMPING = 6;

function PovCamera({ species }: { species: Species }) {
  const camRef = useRef<ThreePerspectiveCamera>(null);
  const pov = species.povCamera ?? POV_DEFAULT;
  const target = useMemo(() => new Vector3(
    0,
    (species.modelYOffset || 0) + species.selectionRadius * 1.2 + pov.height,
    -species.selectionRadius * 2.5 - pov.back,
  ), [species, pov]);
  useFrame((_, delta) => {
    const cam = camRef.current;
    if (!cam) return;
    cam.position.lerp(target, Math.min(1, delta * POV_DAMPING));
  });
  return (
    <PerspectiveCamera
      ref={camRef} makeDefault
      position={[target.x, target.y + 0.4, target.z - 0.3]}
      rotation={[pov.pitch, Math.PI, 0]} fov={75}
    />
  );
}

// ── Main Animal component ─────────────────────────────────────────────────────
export default function Animal({
  spawn, species, timeScale, selected,
  onSelect, onDeath, onReproduce, vitalsRef, isRaining, isPOV,
}: AnimalProps) {
  const groupRef = useRef<Group>(null);
  const keys = useKeyboardControls(selected);

  // Lazy-init TF.js brains once (no-op if already done)
  useEffect(() => { initBrains(); }, []);

  useEffect(() => {
    return () => { liveAnimals.delete(spawn.id); };
  }, [spawn.id]);

  const statusRef = useRef<AnimalStatus>("Roaming");

  const motion = useRef({
    x: spawn.x, z: spawn.z, y: 0,
    jumpY: 0, vy: 0,
    placed: false,
    heading: spawn.heading,
    headingTarget: spawn.heading,
    visualHeading: spawn.heading,
    // AI cadence
    aiTimer: Math.random() * AI_TICK_INTERVAL, // stagger per animal
    lastActionProbs: new Float32Array(5).fill(0.2) as PerceptionVector,
    lastPerception: new Float32Array(16) as PerceptionVector,
    currentSpeed: 0,
    // Needs
    hunger: spawn.initialHunger ?? (12 + (Math.round((spawn.x + 10) * 7 + (spawn.z + 10) * 13) * 37 % 33)),
    thirst: spawn.initialThirst ?? (12 + (Math.round((spawn.z + 10) * 11 + spawn.heading * 5) * 37 % 33)),
    status: "Roaming" as AnimalStatus,
    criticalTimer: 0,
    wellFedTimer: 0,
    eatPreyTimer: 0,
    avoidanceTimer: 0,
    wanderTimer: 0,
    stuckTimer: 0,
    activePath: null as { points: {x: number, z: number}[], index: number, target: {x: number, z: number} } | null,
    hasDied: false,
  });

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const m = motion.current;
    if (m.hasDied) return;

    liveAnimals.set(spawn.id, {
      x: m.x, z: m.z,
      speciesId: spawn.speciesId,
      status: m.status,
      heading: m.visualHeading,
    });

    let here = sampleGround(m.x, m.z);
    if (!here) return;

    const dt = Math.min(delta, MAX_FRAME_DELTA) * timeScale;

    if (dt > 0) {
      m.avoidanceTimer = Math.max(0, m.avoidanceTimer - dt);
      m.aiTimer = Math.max(0, m.aiTimer - dt);
      m.wanderTimer = Math.max(0, m.wanderTimer - dt);

      // ── Needs decay
      m.hunger = Math.min(NEED_MAX, m.hunger + species.hungerRate * dt);
      m.thirst = isRaining
        ? Math.max(0, m.thirst - species.consumeRate * 0.5 * dt)
        : Math.min(NEED_MAX, m.thirst + species.thirstRate * dt);

      // ── Death check
      if (m.hunger >= NEED_MAX || m.thirst >= NEED_MAX) {
        m.criticalTimer += dt;
        if (m.criticalTimer >= DEATH_AFTER_CRITICAL) {
          m.hasDied = true;
          liveAnimals.delete(spawn.id);
          onDeath(spawn.id);
          return;
        }
      } else {
        m.criticalTimer = 0;
      }

      // ── Reproduction
      if (m.hunger < WELL_FED_LEVEL && m.thirst < WELL_FED_LEVEL) {
        m.wellFedTimer += dt;
        if (m.wellFedTimer >= REPRODUCE_AFTER) {
          m.wellFedTimer = 0;
          m.hunger = Math.min(NEED_MAX, m.hunger + REPRODUCTION_NEED_PENALTY);
          m.thirst = Math.min(NEED_MAX, m.thirst + REPRODUCTION_NEED_PENALTY);
          onReproduce(spawn, m.x, m.z, m.heading);
        }
      } else {
        m.wellFedTimer = 0;
      }

      // ── Jump physics
      if (m.jumpY > 0 || m.vy !== 0) {
        m.vy -= GRAVITY * dt;
        m.jumpY += m.vy * dt;
        if (m.jumpY <= 0) { m.jumpY = 0; m.vy = 0; }
      }

      // ── Kill: did I get eaten this frame?
      const killerId = checkKilled(spawn.id, m.x, m.z, species);
      if (killerId) {
        killRewards.set(killerId, (killRewards.get(killerId) ?? 0) + 1);
        m.hasDied = true;
        liveAnimals.delete(spawn.id);
        onDeath(spawn.id);
        return;
      }

      // ── Claim kill reward
      const claimed = killRewards.get(spawn.id);
      if (claimed) {
        killRewards.delete(spawn.id);
        m.hunger = Math.max(0, m.hunger - KILL_HUNGER_RESTORE * claimed);
        m.eatPreyTimer = EAT_PREY_DURATION;
      }
      if (m.eatPreyTimer > 0) m.eatPreyTimer = Math.max(0, m.eatPreyTimer - dt);

      // ────────────────────────────────────────────────────────────────────────
      // Manual control (selected animal)
      // ────────────────────────────────────────────────────────────────────────
      if (selected) {
        m.status = "Idle";
        const k = keys.current;
        let turn = 0, forward = 0;
        if (k[" "] && m.jumpY === 0) m.vy = JUMP_VELOCITY;
        if (k.w || k.ArrowUp)    forward = 1;
        if (k.s || k.ArrowDown)  forward = -1;
        if (k.a || k.ArrowLeft)  turn = 1;
        if (k.d || k.ArrowRight) turn = -1;
        if (turn !== 0) {
          m.heading += turn * species.turnSpeed * dt * MANUAL_TURN_MULT;
          m.headingTarget = m.heading;
        }
        if (forward !== 0) {
          m.status = "Roaming";
          const speed = species.moveSpeed * dt * forward;
          const nx = m.x + Math.sin(m.heading) * speed;
          const nz = m.z + Math.cos(m.heading) * speed;
          const ahead = sampleGround(nx, nz, m.y);
          let hitVeg = false;
          if (species.locomotion !== "aerial" && m.jumpY <= 0.1) {
            for (const v of VEGETATION) {
              const baseRadius = v.kind === "tree" ? 0.1 : (v.kind === "rock" ? 0.6 : 0.5);
              const r = species.selectionRadius * 0.3 + v.scale * baseRadius;
              if (Math.hypot(v.x - nx, v.z - nz) < r &&
                  Math.hypot(v.x - nx, v.z - nz) <= Math.hypot(v.x - m.x, v.z - m.z)) {
                hitVeg = true; break;
              }
            }
          }
          const stranded = here && (
            (species.locomotion === "terrestrial" && here.water) ||
            (species.locomotion === "aquatic" && !here.water)
          );
          if (ahead && ahead.normalY >= 0.6 && !hitVeg &&
              (stranded || (species.locomotion !== "aquatic" ? !ahead.water : ahead.water))) {
            m.x = nx; m.z = nz; here = ahead;
          }
        }
        if (m.criticalTimer > 0)
          m.status = m.thirst >= NEED_MAX ? "Dehydrated" : "Starving";

      // ────────────────────────────────────────────────────────────────────────
      // AI control — TF.js neural network
      // ────────────────────────────────────────────────────────────────────────
      } else {
        // Eating prey
        if (m.eatPreyTimer > 0) {
          m.status = "Eating";
        } else {
          // ── AI tick: rebuild perception + run brain at cadence
          if (m.aiTimer <= 0 && isReady()) {
            m.aiTimer = AI_TICK_INTERVAL;
            const isPredator = (species.predatorOf?.length ?? 0) > 0;
            m.lastPerception = buildPerception(
              spawn.id, m.x, m.z, m.heading,
              m.hunger, m.thirst, m.currentSpeed, species.moveSpeed * 2.5,
              species,
            );
            m.lastActionProbs = runBrain(
              species.locomotion,
              isPredator,
              m.lastPerception,
            );
          }

          const stranded = !!(here && (
            (species.locomotion === "terrestrial" && here.water) ||
            (species.locomotion === "aquatic" && !here.water)
          ));

          const d = decide({
            x: m.x, z: m.z, heading: m.heading, headingTarget: m.headingTarget,
            hunger: m.hunger, thirst: m.thirst,
            currentStatus: m.status,
            species,
            actionProbs: m.lastActionProbs,
            wanderTimer: m.wanderTimer,
            avoidanceTimer: m.avoidanceTimer,
            stranded,
            isRaining,
          });

          m.status = d.status;
          
          // ── A* Pathfinding ──
          if (d.pathTarget && m.avoidanceTimer <= 0) {
            if (!m.activePath || Math.hypot(m.activePath.target.x - d.pathTarget.x, m.activePath.target.z - d.pathTarget.z) > 1.0) {
              const pts = findPath(m.x, m.z, d.pathTarget.x, d.pathTarget.z, species.locomotion);
              if (pts && pts.length > 0) {
                m.activePath = { points: pts, index: 0, target: d.pathTarget };
              } else {
                m.activePath = null;
              }
            }
            
            if (m.activePath) {
              const wp = m.activePath.points[m.activePath.index];
              if (Math.hypot(wp.x - m.x, wp.z - m.z) < 0.6) {
                if (m.activePath.index < m.activePath.points.length - 1) {
                  m.activePath.index++;
                } else {
                  m.activePath = null;
                }
              }
              if (m.activePath) {
                const currentWp = m.activePath.points[m.activePath.index];
                d.headingTarget = Math.atan2(currentWp.x - m.x, currentWp.z - m.z);
              }
            }
          } else {
            m.activePath = null;
          }

          m.headingTarget = d.headingTarget;
          m.wanderTimer = d.wanderTimer;

          // Consume resources
          if (d.consumeFood) m.hunger = Math.max(0, m.hunger - species.consumeRate * dt);
          if (d.consumeWater) m.thirst = Math.max(0, m.thirst - species.consumeRate * dt);

          if (m.criticalTimer > 0)
            m.status = m.thirst >= NEED_MAX ? "Dehydrated" : "Starving";

          if (d.moving) {
            // Stuck detection: if trying to move but blocked, increment stuckTimer
            let didMove = false;

            // Self-rescue
            if (stranded) {
              const edge = nearestWaterEdge(m.x, m.z);
              if (edge) d.headingTarget = Math.atan2(edge.x - m.x, edge.z - m.z);
            }

            // Soft boundary: steer back toward centre
            const effectiveRadius = species.roamRadius ?? WALK_RADIUS;
            const distFromCenter = Math.hypot(m.x, m.z);
            if (!stranded && m.status === "Roaming" && distFromCenter > effectiveRadius * 0.85)
              d.headingTarget = Math.atan2(-m.x, -m.z);

            // Obstacle push (terrain + vegetation)
            const obs = computeObstaclePush(m.x, m.z, species, stranded);
            let finalTarget = m.headingTarget;
            if (obs.strength > 0) {
              const bx = Math.sin(m.headingTarget) * 0.4 + obs.x;
              const bz = Math.cos(m.headingTarget) * 0.4 + obs.z;
              finalTarget = Math.atan2(bx, bz);
            }

            // Turn toward finalTarget
            const diff = Math.atan2(
              Math.sin(finalTarget - m.heading),
              Math.cos(finalTarget - m.heading),
            );
            const turnBoost = obs.strength > 0 ? 3.0 : 1.0;
            m.heading += diff * Math.min(1, species.turnSpeed * d.speedMult * dt * turnBoost);

            // Move
            const nx = m.x + Math.sin(m.heading) * species.moveSpeed * d.speedMult * dt;
            const nz = m.z + Math.cos(m.heading) * species.moveSpeed * d.speedMult * dt;
            const ahead = sampleGround(nx, nz, m.y);
            if (ahead && ahead.normalY >= 0.6 &&
                (stranded || (species.locomotion === "aquatic" ? ahead.water : !ahead.water) ||
                 species.locomotion === "aerial" || species.locomotion === "amphibian")) {
              m.x = nx; m.z = nz; here = ahead; didMove = true;
            }

            if (!didMove && d.speedMult > 0) {
              m.stuckTimer += dt;
              if (m.stuckTimer > 0.5) {
                // Force a turnaround if stuck for too long
                m.headingTarget = m.heading + Math.PI * 0.75 + Math.random() * Math.PI * 0.5;
                m.stuckTimer = 0;
                m.avoidanceTimer = 2.0; // ignore normal seeking targets for a bit
              }
            } else {
              m.stuckTimer = 0;
            }

            m.currentSpeed = species.moveSpeed * d.speedMult;

            // Hard clamp
            const dist = Math.hypot(m.x, m.z);
            const cap = species.roamRadius ?? WALK_RADIUS;
            if (dist > cap) { m.x *= cap / dist; m.z *= cap / dist; }
          } else {
            m.currentSpeed = 0;
          }
        }
      }
    }

    // Ground snap
    m.y = m.placed
      ? MathUtils.lerp(m.y, here.y, Math.min(1, delta * GROUND_SNAP_SPEED))
      : here.y;
    m.placed = true;
    group.position.set(m.x, m.y + m.jumpY, m.z);

    // Visual heading smoothing
    let targetVisual = m.heading;
    if (selected && (keys.current.s || keys.current.ArrowDown) &&
        !keys.current.w && !keys.current.ArrowUp) targetVisual += Math.PI;
    const dv = Math.atan2(
      Math.sin(targetVisual - m.visualHeading),
      Math.cos(targetVisual - m.visualHeading),
    );
    m.visualHeading += dv * Math.min(1, species.turnSpeed * delta * timeScale * 4.0);
    group.rotation.y = m.visualHeading;
    statusRef.current = m.status;

    if (selected) {
      const vitals = vitalsRef.current;
      vitals.x = m.x; vitals.z = m.z;
      vitals.hunger = m.hunger; vitals.thirst = m.thirst;
      vitals.status = m.status;
      vitals.biome = biomeForHeight(here.y).name;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[spawn.x, 0, spawn.z]}
      rotation={[0, spawn.heading, 0]}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(spawn.id); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      {isPOV && <PovCamera species={species} />}
      <Suspense fallback={null}>
        <AnimalModel species={species} timeScale={timeScale} statusRef={statusRef} />
      </Suspense>
      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={species.selectionRadius}>
          <ringGeometry args={[0.8, 1, 40]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}
    </group>
  );
}
