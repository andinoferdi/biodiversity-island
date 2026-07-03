"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Clone, useAnimations, useGLTF } from "@react-three/drei";
import type { Group } from "three";
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

// Maps the simulation status to one of the deer's animation clips.
function clipFor(status: AnimalStatus): "Walk" | "Eating" {
  return status === "Eating" || status === "Drinking" ? "Eating" : "Walk";
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
  const { actions } = useAnimations(animations, groupRef);
  const activeClip = useRef<string | null>(null);

  // Clip switching and playback speed are handled per frame (cheap ref
  // compares + AnimationAction method calls) so the deer follows the
  // simulation without React state: Pause freezes the pose, 4x speeds it up.
  useFrame(() => {
    const clip = clipFor(statusRef.current);
    if (clip !== activeClip.current) {
      const next = actions[clip];
      if (!next) return;
      const prev = activeClip.current ? actions[activeClip.current] : null;
      next.reset().fadeIn(0.2).play();
      prev?.fadeOut(0.2);
      activeClip.current = clip;
    }
    actions[clip]?.setEffectiveTimeScale(timeScale);
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
