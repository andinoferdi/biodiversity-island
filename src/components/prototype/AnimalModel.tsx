"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Clone, useAnimations, useGLTF } from "@react-three/drei";
import type { AnimationAction, Group } from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SPECIES, type Species } from "./species";
import type { AnimalStatus, TimeScale } from "./simulation";

// All six animal GLBs are preloaded so Suspense resolves quickly.
for (const species of SPECIES) {
  useGLTF.preload(species.modelUrl);
}

export interface AnimalModelProps {
  species: Species;
  timeScale: TimeScale;
  // Read per frame by the deer to pick its animation clip; written by
  // Animal.tsx's frame loop (never triggers React renders).
  statusRef: React.RefObject<AnimalStatus>;
}

// Maps the simulation status to one of the species' configured animation clips.
function clipFor(
  status: AnimalStatus,
  species: Species,
  actions: Record<string, AnimationAction | null>
): string | null {
  const anims = species.animations;
  if (!anims) {
    // Fallback: pick the first available animation if none configured
    const available = Object.keys(actions);
    return available.length > 0 ? available[0] : null;
  }

  if (status === "Eating" || status === "Drinking") {
    return anims.eat || anims.idle || anims.walk;
  }
  if (status === "Idle") {
    return anims.idle || anims.walk;
  }

  if (status === "Hunting" || status === "Fleeing") {
    return anims.run || anims.walk || anims.idle || Object.keys(actions)[0] || null;
  }

  // By default, the animal is moving (Roaming, Seeking, Fleeing)
  return anims.walk || anims.idle || Object.keys(actions)[0] || null;
}

// The deer is the only skinned + animated model: <Clone> cannot duplicate
// skinned meshes, so each instance clones via SkeletonUtils and drives its
// own mixer. The clip follows the simulation status and the mixer runs at
// timeScale, so Pause freezes the pose and 4x speeds it up.
function AnimatedModel({ species, timeScale, statusRef }: AnimalModelProps) {
  const groupRef = useRef<Group>(null);
  const { scene, animations } = useGLTF(species.modelUrl);
  const clone = useMemo(() => {
    const cloned = cloneSkeleton(scene);
    cloned.traverse((object) => {
      object.castShadow = true;
    });
    return cloned;
  }, [scene]);
  // Attach AnimationMixer to the clone itself (not groupRef) so the mixer
  // finds the cloned skeleton bones immediately — groupRef may not have
  // children yet when useAnimations runs on mount, causing T-pose.
  const cloneRef = useRef(clone);
  const { actions } = useAnimations(animations, cloneRef);
  const activeClip = useRef<string | null>(null);

  // Start the default animation immediately on mount so the model never
  // appears in T-pose, even if the frame loop hasn't ticked yet.
  useEffect(() => {
    const defaultClip = clipFor("Roaming", species, actions);
    if (!defaultClip) return;
    const action = actions[defaultClip];
    if (!action) return;
    action.reset().fadeIn(0).play();
    activeClip.current = defaultClip;
  }, [actions, species]);

  // Clip switching and playback speed are handled per frame (cheap ref
  // compares + AnimationAction method calls) so the deer follows the
  // simulation without React state: Pause freezes the pose, 4x speeds it up.
  useFrame(() => {
    const clip = clipFor(statusRef.current, species, actions);
    if (!clip) return;

    if (clip !== activeClip.current) {
      const next = actions[clip];
      if (!next) return;
      const prev = activeClip.current ? actions[activeClip.current] : null;
      next.reset().fadeIn(0.2).play();
      prev?.fadeOut(0.2);
      activeClip.current = clip;
    }
    
    // Play animations faster if the animal is fleeing
    const speedMultiplier = statusRef.current === "Fleeing" ? 2.5 : 1.0;
    actions[clip]?.setEffectiveTimeScale(timeScale * speedMultiplier);
  });

  return (
    <group
      ref={groupRef}
      position={[0, species.modelYOffset, 0]}
      rotation={[0, species.modelRotY, 0]}
      scale={species.modelScale}
    >
      <primitive object={clone} />
    </group>
  );
}

// Static models share geometry/material across instances via drei <Clone>,
// with castShadow enabled once on the source scene (copied by Clone).
function StaticModel({ species }: AnimalModelProps) {
  const { scene } = useGLTF(species.modelUrl);
  useMemo(() => {
    scene.traverse((object) => {
      object.castShadow = true;
    });
  }, [scene]);
  return (
    <Clone
      object={scene}
      position={[0, species.modelYOffset, 0]}
      rotation={[0, species.modelRotY, 0]}
      scale={species.modelScale}
    />
  );
}

export default function AnimalModel(props: AnimalModelProps) {
  return props.species.animated ? (
    <AnimatedModel {...props} />
  ) : (
    <StaticModel {...props} />
  );
}
