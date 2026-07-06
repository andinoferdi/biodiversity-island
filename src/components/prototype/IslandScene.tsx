"use client";

import {
  Suspense,
  useSyncExternalStore,
  useRef,
  useMemo,
  useEffect,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { MapControls, useProgress } from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
} from "@react-three/postprocessing";
import * as THREE from "three";
import Animal from "./Animal";
import { Log, Rock, TerrainGLB, Tree } from "./EnvironmentModels";
import {
  isTerrainReady,
  subscribeTerrain,
  TERRAIN_THUMBNAIL_URL,
  TERRAIN_Y,
  VEGETATION,
  sampleGround,
} from "./terrain";
import { getSpecies, type AnimalSpawn } from "./species";
import {
  RESOURCES,
  type AnimalVitals,
  type ResourceSpot,
  type TimeScale,
} from "./simulation";

const VEGETATION_COMPONENTS = { tree: Tree, rock: Rock, log: Log } as const;

function RealisticRainSystem({
  isRaining,
  timeScale,
}: {
  isRaining: boolean;
  timeScale: TimeScale;
}) {
  const DROP_COUNT = 400;
  const SPLASH_COUNT = 100;

  const dropsRef = useRef<THREE.InstancedMesh>(null);
  const splashRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Drops state
  const drops = useMemo(() => {
    const data = [];
    for (let i = 0; i < DROP_COUNT; i++) {
      data.push({
        x: (Math.random() - 0.5) * 20,
        y: Math.random() * 8,
        z: (Math.random() - 0.5) * 20,
        speed: 15 + Math.random() * 10,
      });
    }
    return data;
  }, []);

  // Splash state
  const splashes = useMemo(() => {
    const data = [];
    for (let i = 0; i < SPLASH_COUNT; i++) {
      data.push({
        x: 0,
        y: -10,
        z: 0,
        age: 1.0,
        lifeTime: 0.15 + Math.random() * 0.1,
      });
    }
    return data;
  }, []);

  const splashIdx = useRef(0);

  useFrame((_, delta) => {
    if (!isRaining || timeScale === 0) return;
    const move = delta * timeScale;

    // Update Drops
    if (dropsRef.current) {
      for (let i = 0; i < DROP_COUNT; i++) {
        const p = drops[i];
        p.y -= p.speed * move;
        p.x -= p.speed * move * 0.1; // wind slant

        const ground = sampleGround(p.x, p.z);
        const groundY = ground ? ground.y : -10; // If over void, fall to -10

        if (p.y < groundY + 0.1 || p.y < -2) {
          // Spawn a splash only if it hit actual ground
          if (ground) {
            const s = splashes[splashIdx.current];
            s.x = p.x;
            s.y = groundY + 0.05; // slightly above ground to prevent Z-fighting
            s.z = p.z;
            s.age = 0;
            splashIdx.current = (splashIdx.current + 1) % SPLASH_COUNT;
          }

          // Reset drop to the sky, forcing it to spawn over valid terrain
          p.y = 6 + Math.random() * 3;
          let tx = 0,
            tz = 0;
          for (let attempt = 0; attempt < 5; attempt++) {
            tx = (Math.random() - 0.5) * 20;
            tz = (Math.random() - 0.5) * 20;
            if (sampleGround(tx, tz) !== null) break;
          }
          p.x = tx;
          p.z = tz;
        }

        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(0, 0, 0.1);
        dummy.scale.set(1, 8, 1); // stretch droplet for motion blur effect
        dummy.updateMatrix();
        dropsRef.current.setMatrixAt(i, dummy.matrix);
      }
      dropsRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update Splashes
    if (splashRef.current) {
      for (let i = 0; i < SPLASH_COUNT; i++) {
        const s = splashes[i];
        s.age += move;
        if (s.age < s.lifeTime) {
          const progress = s.age / s.lifeTime;
          const scale = 0.2 + progress * 0.6; // ripple expands rapidly
          dummy.position.set(s.x, s.y, s.z);
          dummy.rotation.set(-Math.PI / 2, 0, 0); // flat on the ground
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          splashRef.current.setMatrixAt(i, dummy.matrix);
        } else {
          // Hide dead splashes
          dummy.position.set(0, -10, 0);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          splashRef.current.setMatrixAt(i, dummy.matrix);
        }
      }
      splashRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!isRaining) return null;

  return (
    <group>
      <instancedMesh ref={dropsRef} args={[undefined, undefined, DROP_COUNT]}>
        <sphereGeometry args={[0.015, 4, 4]} />
        <meshBasicMaterial color="#a5c4e3" transparent opacity={0.5} />
      </instancedMesh>
      <instancedMesh
        ref={splashRef}
        args={[undefined, undefined, SPLASH_COUNT]}
      >
        <ringGeometry args={[0.05, 0.1, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.4}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}

function RealisticClouds({
  isRaining,
  timeScale,
}: {
  isRaining: boolean;
  timeScale: TimeScale;
}) {
  const NUM_CLOUDS = 12;
  const PUFFS_PER_CLOUD = 15;
  const count = NUM_CLOUDS * PUFFS_PER_CLOUD;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const softMeshRef = useRef<THREE.InstancedMesh>(null);
  // ONE shadow circle per cloud cluster — NOT per puff — to prevent alpha stacking
  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Generate a soft radial gradient texture for the cloud puffs
  const cloudTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d")!;

    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
    gradient.addColorStop(0.3, "rgba(255, 255, 255, 0.8)");
    gradient.addColorStop(0.7, "rgba(255, 255, 255, 0.2)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Soft radial gradient for shadows — feathered edges allow overlapping shadows to merge
  const shadowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;

    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0,   "rgba(0, 0, 0, 0.55)");
    gradient.addColorStop(0.4, "rgba(0, 0, 0, 0.35)");
    gradient.addColorStop(0.75, "rgba(0, 0, 0, 0.10)");
    gradient.addColorStop(1,   "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
  }, []);

  const puffs = useMemo(() => {
    const data = [];
    for (let c = 0; c < NUM_CLOUDS; c++) {
      // Each cloud has a central position and an orbit speed
      const cloudAngle = Math.random() * Math.PI * 2;
      const cloudRadius = Math.random() * 6; // Cluster tightly together
      const baseY = 5 + Math.random() * 1.5; // Slightly higher altitude
      const cloudSpeed = 0.01 + Math.random() * 0.02;

      for (let p = 0; p < PUFFS_PER_CLOUD; p++) {
        // Spread puffs horizontally to form the cloud's width
        const ox = (Math.random() - 0.5) * 2.5;
        const oz = (Math.random() - 0.5) * 2.5;

        // Distance from center determines height and size (billowy in middle, flat on edges)
        const distFromCenter = Math.sqrt(ox * ox + oz * oz);
        const heightFactor = Math.max(0, 1 - distFromCenter / 1.8); // 0 at edges, 1 at center

        const oy = heightFactor * (0.5 + Math.random() * 0.8); // Bulges upward
        const scale = 1 + heightFactor * 1.5 + Math.random() * 0.8;

        data.push({
          cloudAngle,
          cloudRadius,
          baseY,
          cloudSpeed,
          ox,
          oy,
          oz,
          scale,
        });
      }
    }
    return data;
  }, []);

  useFrame(({ camera }, delta) => {
    if (!meshRef.current || timeScale === 0) return;

    const move = delta * timeScale;

    for (let i = 0; i < count; i++) {
      const p = puffs[i];
      p.cloudAngle += p.cloudSpeed * move;

      const cx = Math.sin(p.cloudAngle) * p.cloudRadius;
      const cz = Math.cos(p.cloudAngle) * p.cloudRadius;

      const c = Math.floor(i / PUFFS_PER_CLOUD);
      const isSolidType = c % 4 === 0;

      if (isSolidType) {
        dummy.position.set(cx + p.ox, p.baseY + p.oy, cz + p.oz);
        dummy.quaternion.identity();
        dummy.scale.set(p.scale, p.scale * 0.8, p.scale);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);

        if (softMeshRef.current) {
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          softMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
      } else {
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);

        if (softMeshRef.current) {
          dummy.position.set(cx + p.ox, p.baseY + p.oy, cz + p.oz);
          dummy.quaternion.copy(camera.quaternion);
          dummy.scale.setScalar(p.scale * 1.5);
          dummy.updateMatrix();
          softMeshRef.current.setMatrixAt(i, dummy.matrix);
        }
      }

      // Draw exactly ONE soft gradient shadow per cluster — large enough to overlap neighbours and merge
      if (i % PUFFS_PER_CLOUD === 0 && shadowMeshRef.current) {
        dummy.position.set(cx, TERRAIN_Y + 0.05, cz);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(5.5); // Large + soft edges = natural merging between nearby clusters
        dummy.updateMatrix();
        shadowMeshRef.current.setMatrixAt(c, dummy.matrix);
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (softMeshRef.current) softMeshRef.current.instanceMatrix.needsUpdate = true;
    if (shadowMeshRef.current) shadowMeshRef.current.instanceMatrix.needsUpdate = true;
  });

  const cloudColor = isRaining ? "#6c7a89" : "#ffffff";
  const opacity = isRaining ? 0.01 : 0.05; // Soft halo — very light in clear sky

  return (
    <group>
      {/* Visual cloud layer 1 (solid low-poly spheres) */}
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow={false}>
        <sphereGeometry args={[0.5, 8, 8]} />
        <meshLambertMaterial
          color={cloudColor}
          flatShading
          transparent
          opacity={isRaining ? 0.45 : 0.25}
        />
      </instancedMesh>

      {/* Visual cloud layer 2 (soft billowy planes) */}
      <instancedMesh ref={softMeshRef} args={[undefined, undefined, count]} castShadow={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          color={cloudColor}
          transparent
          opacity={opacity}
          depthWrite={false}
          map={cloudTexture}
        />
      </instancedMesh>

      {/* Ground decal shadows — soft gradient planes that blend at edges when overlapping */}
      <instancedMesh ref={shadowMeshRef} args={[undefined, undefined, NUM_CLOUDS]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={shadowTexture}
          transparent
          depthWrite={false}
          alphaTest={0}
        />
      </instancedMesh>
    </group>
  );
}

function DynamicSun({
  graphicQuality,
  timeScale,
  isRaining,
}: {
  graphicQuality: GraphicQuality;
  timeScale: TimeScale;
  isRaining: boolean;
}) {
  const lightRef = useRef<THREE.DirectionalLight>(null);
  const timeAccum = useRef(0);

  useFrame((_state, delta) => {
    if (!lightRef.current) return;
    if (timeScale > 0) {
      timeAccum.current += delta * timeScale * 0.04;
    }

    const ORBIT_R = 15;
    const SUN_HEIGHT = ORBIT_R * Math.tan((30 * Math.PI) / 180);
    const angle = timeAccum.current;

    const px = Math.sin(angle) * ORBIT_R;
    const py = TERRAIN_Y + SUN_HEIGHT;
    const pz = Math.cos(angle) * ORBIT_R;

    lightRef.current.position.set(px, py, pz);
    lightRef.current.target.position.set(0, TERRAIN_Y, 0);
    lightRef.current.target.updateMatrixWorld();
  });

  const mapSize = graphicQuality === "high" ? 2048 : 1024;
  const doShadows = graphicQuality !== "low";

  return (
    <directionalLight
      ref={lightRef}
      castShadow={doShadows}
      position={[10, 16, 8]}
      intensity={isRaining ? 0.4 : 1.6}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
      shadow-camera-near={0.5}
      shadow-camera-far={60}
      shadow-bias={-0.001}
    />
  );
}


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
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[spot.radius, 24]} />
        <meshStandardMaterial color="#8fae3c" />
      </mesh>
      {[
        [-0.25, 0.2],
        [0.25, 0.05],
        [0, -0.25],
      ].map(([bx, bz]) => (
        <mesh
          key={`${bx},${bz}`}
          castShadow
          receiveShadow
          position={[bx, 0.1, bz]}
        >
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
        <hemisphereLight
          args={[
            isRaining ? "#7a8c9e" : "#bfd9ff",
            "#3f5a36",
            graphicQuality === "low"
              ? isRaining
                ? 0.4
                : 0.7
              : isRaining
                ? 0.2
                : 0.5,
          ]}
        />
        {/* Secondary fill light simulates bounced global illumination */}
        {graphicQuality !== "low" && (
          <directionalLight
            position={[-8, 6, -10]}
            intensity={
              graphicQuality === "high"
                ? isRaining
                  ? 0.2
                  : 0.6
                : isRaining
                  ? 0.1
                  : 0.4
            }
            color="#a8c4e0"
          />
        )}
        <DynamicSun
          graphicQuality={graphicQuality}
          timeScale={timeScale}
          isRaining={isRaining}
        />
        <Sea />
        {/* The terrain and vegetation GLBs suspend while streaming in; the
            HTML overlay below covers the wait, and the animals hold still
            until the ground raycasts start hitting. */}
        <Suspense fallback={null}>
          <TerrainGLB />
          <Vegetation />
        </Suspense>
        {isCloudy && (
          <RealisticClouds isRaining={isRaining} timeScale={timeScale} />
        )}
        <RealisticRainSystem isRaining={isRaining} timeScale={timeScale} />
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
            isRaining={isRaining}
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
