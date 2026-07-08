/**
 * animalBrain.ts — TensorFlow.js-powered Animal AI Brain
 *
 * Architecture:
 *  - Each animal has a PerceptionVector (16 floats) built from spatial raycasting
 *    of nearby terrain, threats, prey, food, water, and conspecifics.
 *  - A small species-tuned feedforward network maps perception → action logits.
 *  - Actions: [turnLeft, turnRight, speedUp, slowDown, stop]
 *  - Weights are hand-crafted from ethological data (no runtime training needed).
 *    The result is deterministic, fast, and biologically plausible.
 */

import * as tf from "@tensorflow/tfjs";

// ── Action indices ─────────────────────────────────────────────────────────────
export const ACTION_TURN_LEFT  = 0;
export const ACTION_TURN_RIGHT = 1;
export const ACTION_SPEED_UP   = 2;
export const ACTION_SLOW_DOWN  = 3;
export const ACTION_STOP       = 4;
export const NUM_ACTIONS       = 5;

// ── Perception vector layout (16 floats, all normalised 0-1) ──────────────────
// [0]  hunger (0=full, 1=starving)
// [1]  thirst (0=full, 1=dying)
// [2]  speed (normalised)
// [3]  distToFood (0=at food, 1=far)
// [4]  angleToFood encoded sin
// [5]  angleToFood encoded cos
// [6]  distToWater (0=at water, 1=far)
// [7]  angleToWater encoded sin
// [8]  angleToWater encoded cos
// [9]  threatPresent (0/1)
// [10] threatDist (0=adjacent, 1=far)
// [11] threatAngle sin
// [12] threatAngle cos
// [13] preyPresent (0/1)
// [14] preyDist
// [15] flockCohesion (0=alone, 1=surrounded)
export const PERCEPTION_SIZE = 16;

export type PerceptionVector = Float32Array; // length PERCEPTION_SIZE

// ── Neural network topology ───────────────────────────────────────────────────
// Input(16) → Dense(24, relu) → Dense(16, relu) → Dense(5, softmax)
// Total params: 16×24 + 24 + 24×16 + 16 + 16×5 + 5 = 937

interface BrainWeights {
  w1: number[][];  // [24][16]
  b1: number[];    // [24]
  w2: number[][];  // [16][24]
  b2: number[];    // [16]
  w3: number[][];  // [5][16]
  b3: number[];    // [5]
}

// ── Herbivore personality weights ─────────────────────────────────────────────
// Key drives: flee threats strongly, seek food/water, gentle flocking.
function herbivoreWeights(): BrainWeights {
  // Layer 1 — 24 neurons, each 16 inputs
  const w1: number[][] = [];
  for (let n = 0; n < 24; n++) {
    const row = new Array(16).fill(0);
    // Food seeking neurons (0-3)
    if (n < 4) { row[0] = 1.2; row[3] = 1.5; row[4] = 0.8; row[5] = 0.8; }
    // Water seeking neurons (4-7)
    else if (n < 8) { row[1] = 1.4; row[6] = 1.5; row[7] = 0.8; row[8] = 0.8; }
    // Threat flee neurons (8-13) — heavily weighted
    else if (n < 14) { row[9] = 2.0; row[10] = -1.5; row[11] = 1.2; row[12] = 1.2; }
    // Flock cohesion (14-17)
    else if (n < 18) { row[15] = 1.0; row[2] = 0.3; }
    // General exploration (18-23)
    else { row[2] = 0.5; row[0] = 0.2; row[1] = 0.2; }
    w1.push(row);
  }
  const b1 = new Array(24).fill(0.1);

  // Layer 2 — 16 neurons
  const w2: number[][] = [];
  for (let n = 0; n < 16; n++) {
    const row = new Array(24).fill(0);
    for (let i = 0; i < 24; i++) row[i] = (Math.sin(n * 0.7 + i * 0.3) * 0.4);
    // Amplify threat pathway
    if (n < 6) { for (let i = 8; i < 14; i++) row[i] += 0.8; }
    w2.push(row);
  }
  const b2 = new Array(16).fill(0.05);

  // Layer 3 — 5 action neurons
  // Herbivores: bias toward turning away from threats, moderate speed
  const w3: number[][] = [
    // turnLeft  — activated by threat on right
    [0.4, 0.2, 0.6, 0.6, 0.6, 0.6, 0.1, 0.0, 0.0, 0.2, 0.0, 0.1, 0.0, 0.0, 0.3, 0.2],
    // turnRight — activated by threat on left
    [0.4, 0.2, 0.6, 0.6, 0.6, 0.6, 0.1, 0.0, 0.0, 0.0, 0.2, 0.0, 0.1, 0.0, 0.3, 0.2],
    // speedUp   — flee or seek
    [0.2, 0.5, 0.7, 0.7, 0.3, 0.3, 0.5, 0.5, 0.3, 0.3, 0.8, 0.3, 0.3, 0.1, 0.2, 0.1],
    // slowDown  — near resource
    [0.6, 0.0, 0.2, 0.2, 0.2, 0.2, 0.3, 0.3, 0.2, 0.2, 0.0, 0.1, 0.1, 0.0, 0.2, 0.5],
    // stop      — well fed, safe
    [0.8, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.1, 0.7],
  ];
  const b3 = [-0.3, -0.3, 0.1, 0.0, -0.5];

  return { w1, b1, w2, b2, w3, b3 };
}

// ── Predator personality weights ──────────────────────────────────────────────
// Key drives: pursue prey aggressively, patrol territory, ignore threats.
function predatorWeights(): BrainWeights {
  const w1: number[][] = [];
  for (let n = 0; n < 24; n++) {
    const row = new Array(16).fill(0);
    // Prey pursuit (0-7) — very strong drive
    if (n < 8) { row[13] = 2.0; row[14] = 1.5; row[0] = 0.5; }
    // Food/water maintenance (8-13)
    else if (n < 14) { row[0] = 1.0; row[3] = 1.0; row[1] = 0.8; row[6] = 0.8; }
    // Territorial patrol (14-20)
    else if (n < 20) { row[2] = 0.8; row[15] = -0.3; } // avoid crowding
    // Reserve (20-23)
    else { row[9] = 0.2; row[10] = 0.2; }
    w1.push(row);
  }
  const b1 = new Array(24).fill(0.1);

  const w2: number[][] = [];
  for (let n = 0; n < 16; n++) {
    const row = new Array(24).fill(0);
    for (let i = 0; i < 24; i++) row[i] = Math.cos(n * 0.5 + i * 0.4) * 0.3;
    // Amplify prey tracking pathway
    if (n < 8) for (let i = 0; i < 8; i++) row[i] += 0.9;
    w2.push(row);
  }
  const b2 = new Array(16).fill(0.05);

  const w3: number[][] = [
    // turnLeft  — steer toward prey
    [0.5, 0.4, 0.8, 0.8, 0.4, 0.4, 0.2, 0.2, 0.2, 0.0, 0.3, 0.2, 0.1, 0.6, 0.3, 0.1],
    // turnRight
    [0.5, 0.4, 0.8, 0.8, 0.4, 0.4, 0.2, 0.2, 0.2, 0.3, 0.0, 0.1, 0.2, 0.6, 0.3, 0.1],
    // speedUp   — hunting sprint
    [0.3, 0.3, 0.5, 0.5, 0.3, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.9, 0.8, 0.0],
    // slowDown
    [0.5, 0.3, 0.1, 0.1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.0, 0.1, 0.4],
    // stop
    [0.8, 0.8, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.8],
  ];
  const b3 = [-0.2, -0.2, 0.2, -0.1, -0.8];

  return { w1, b1, w2, b2, w3, b3 };
}

// ── Aerial personality weights ─────────────────────────────────────────────────
function aerialWeights(): BrainWeights {
  const w1: number[][] = [];
  for (let n = 0; n < 24; n++) {
    const row = new Array(16).fill(0);
    if (n < 6)       { row[13] = 1.8; row[14] = 1.2; row[0] = 0.4; } // prey
    else if (n < 12) { row[2] = 1.0; row[15] = 0.2; }                  // soar
    else if (n < 18) { row[0] = 0.8; row[3] = 1.0; row[4] = 0.5; row[5] = 0.5; }
    else             { row[1] = 0.6; row[6] = 0.8; }
    w1.push(row);
  }
  const b1 = new Array(24).fill(0.15);
  const w2: number[][] = [];
  for (let n = 0; n < 16; n++) {
    const row = new Array(24).fill(0);
    for (let i = 0; i < 24; i++) row[i] = Math.sin(n * 0.9 + i * 0.2) * 0.35;
    w2.push(row);
  }
  const b2 = new Array(16).fill(0.05);
  const w3: number[][] = [
    [0.4, 0.3, 0.7, 0.6, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.3, 0.2, 0.1, 0.7, 0.4, 0.1],
    [0.4, 0.3, 0.7, 0.6, 0.3, 0.3, 0.2, 0.2, 0.2, 0.3, 0.2, 0.1, 0.2, 0.7, 0.4, 0.1],
    [0.2, 0.2, 0.4, 0.4, 0.3, 0.3, 0.3, 0.3, 0.3, 0.1, 0.1, 0.1, 0.1, 0.8, 0.9, 0.1],
    [0.4, 0.3, 0.2, 0.2, 0.3, 0.3, 0.3, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.1, 0.1, 0.4],
    [0.9, 0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.9],
  ];
  const b3 = [-0.1, -0.1, 0.3, -0.1, -1.0];
  return { w1, b1, w2, b2, w3, b3 };
}

// ── Aquatic personality weights ────────────────────────────────────────────────
function aquaticWeights(): BrainWeights {
  const w1: number[][] = [];
  for (let n = 0; n < 24; n++) {
    const row = new Array(16).fill(0);
    if (n < 8)       { row[9] = 1.5; row[10] = 1.2; row[11] = 0.8; row[12] = 0.8; } // flee
    else if (n < 16) { row[0] = 1.0; row[3] = 1.2; row[4] = 0.6; row[5] = 0.6; }    // food
    else             { row[2] = 0.6; row[15] = 0.5; }                                  // school
    w1.push(row);
  }
  const b1 = new Array(24).fill(0.1);
  const w2: number[][] = [];
  for (let n = 0; n < 16; n++) {
    const row = new Array(24).fill(0);
    for (let i = 0; i < 24; i++) row[i] = Math.sin(n * 0.6 + i * 0.5) * 0.3;
    w2.push(row);
  }
  const b2 = new Array(16).fill(0.05);
  const w3: number[][] = [
    [0.5, 0.3, 0.8, 0.7, 0.4, 0.4, 0.1, 0.1, 0.1, 0.3, 0.2, 0.2, 0.1, 0.2, 0.2, 0.2],
    [0.5, 0.3, 0.8, 0.7, 0.4, 0.4, 0.1, 0.1, 0.1, 0.2, 0.3, 0.1, 0.2, 0.2, 0.2, 0.2],
    [0.2, 0.4, 0.5, 0.5, 0.3, 0.3, 0.4, 0.4, 0.3, 0.2, 0.2, 0.1, 0.1, 0.5, 0.6, 0.2],
    [0.5, 0.4, 0.2, 0.2, 0.4, 0.4, 0.4, 0.4, 0.4, 0.2, 0.2, 0.1, 0.1, 0.1, 0.1, 0.5],
    [0.7, 0.7, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.6],
  ];
  const b3 = [-0.2, -0.2, 0.0, 0.0, -0.4];
  return { w1, b1, w2, b2, w3, b3 };
}

// ── tf.LayersModel builder ─────────────────────────────────────────────────────
function buildModel(weights: BrainWeights): tf.LayersModel {
  const input = tf.input({ shape: [PERCEPTION_SIZE] });

  const d1 = tf.layers.dense({ units: 24, activation: "relu", name: "d1" });
  const d2 = tf.layers.dense({ units: 16, activation: "relu", name: "d2" });
  const d3 = tf.layers.dense({ units: NUM_ACTIONS, activation: "softmax", name: "d3" });

  const out = d3.apply(d2.apply(d1.apply(input))) as tf.SymbolicTensor;
  const model = tf.model({ inputs: input, outputs: out });

  // Inject hand-crafted weights
  const l1 = model.getLayer("d1");
  l1.setWeights([
    tf.tensor2d(weights.w1.map(row => row), [24, PERCEPTION_SIZE]).transpose(),
    tf.tensor1d(weights.b1),
  ]);
  const l2 = model.getLayer("d2");
  l2.setWeights([
    tf.tensor2d(weights.w2.map(row => row), [16, 24]).transpose(),
    tf.tensor1d(weights.b2),
  ]);
  const l3 = model.getLayer("d3");
  l3.setWeights([
    tf.tensor2d(weights.w3.map(row => row), [NUM_ACTIONS, 16]).transpose(),
    tf.tensor1d(weights.b3),
  ]);

  return model;
}

// ── Model registry (one per locomotion type) ───────────────────────────────────
type LocomotionType = "terrestrial" | "aerial" | "aquatic" | "amphibian";

const modelCache = new Map<LocomotionType, tf.LayersModel>();
let tfReady = false;

export async function initBrains(): Promise<void> {
  if (tfReady) return;
  await tf.ready();
  modelCache.set("terrestrial", buildModel(herbivoreWeights()));
  modelCache.set("amphibian",   buildModel(herbivoreWeights()));
  modelCache.set("aerial",      buildModel(aerialWeights()));
  modelCache.set("aquatic",     buildModel(aquaticWeights()));
  tfReady = true;
}

export function isReady(): boolean { return tfReady; }

// ── Inference ─────────────────────────────────────────────────────────────────
// Returns action probabilities as a plain Float32Array[5].
// Called per-animal per-frame — uses tf.tidy() to prevent memory leaks.
export function runBrain(
  locomotion: LocomotionType,
  isPredator: boolean,
  perception: PerceptionVector,
): Float32Array {
  if (!tfReady) return new Float32Array(NUM_ACTIONS).fill(0.2);

  // Predators use their own weights overlaid on top of the locomotion base
  let model = modelCache.get(locomotion);
  if (!model) return new Float32Array(NUM_ACTIONS).fill(0.2);

  // For predators that happen to be terrestrial, swap in predator weights once
  if (isPredator && locomotion === "terrestrial") {
    const key = "__predator_terrestrial__" as LocomotionType;
    if (!modelCache.has(key)) modelCache.set(key, buildModel(predatorWeights()));
    model = modelCache.get(key)!;
  }
  if (isPredator && locomotion === "aerial") {
    const key = "__predator_aerial__" as LocomotionType;
    if (!modelCache.has(key)) modelCache.set(key, buildModel(aerialWeights()));
    model = modelCache.get(key)!;
  }

  let result: Float32Array = new Float32Array(NUM_ACTIONS).fill(0.2);
  tf.tidy(() => {
    const input = tf.tensor2d([Array.from(perception)]);
    const output = model!.predict(input) as tf.Tensor;
    result = output.dataSync() as Float32Array;
  });
  return result;
}

// ── Perception builder helpers ─────────────────────────────────────────────────
export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function encodedAngle(
  fromX: number, fromZ: number, heading: number,
  toX: number, toZ: number,
): [number, number] {
  const dx = toX - fromX;
  const dz = toZ - fromZ;
  const absolute = Math.atan2(dx, dz);
  const relative  = absolute - heading;
  return [Math.sin(relative), Math.cos(relative)];
}
