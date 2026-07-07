"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ANIMAL_SPAWNS, SPECIES, SPECIES_BY_ID, getSpecies, type AnimalSpawn } from "./species";
import {
  CRITICAL_LEVEL,
  MAX_POPULATION,
  NEED_MAX,
  WALK_RADIUS,
  type AnimalVitals,
  type TimeScale,
} from "./simulation";
import type { GraphicQuality } from "./IslandScene";

const IslandScene = dynamic(() => import("./IslandScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-100">
      Loading island…
    </div>
  ),
});

// Offspring start with moderate needs so they join the sim without instantly
// reproducing or dying.
const OFFSPRING_INITIAL_NEED = 40;
// How far from the parent an offspring appears.
const OFFSPRING_OFFSET = 0.9;

// Per-species counters continue the initial labels ("Grazer #3" → "#4").
function initialLabelCounters(): Map<string, number> {
  const counters = new Map<string, number>();
  for (const spawn of ANIMAL_SPAWNS) {
    counters.set(
      spawn.speciesId,
      (counters.get(spawn.speciesId) ?? 0) + 1
    );
  }
  return counters;
}

const TIME_OPTIONS: { scale: TimeScale; label: string }[] = [
  { scale: 0, label: "Pause" },
  { scale: 1, label: "1×" },
  { scale: 4, label: "4×" },
];

const GRAPHIC_OPTIONS: { quality: GraphicQuality; label: string }[] = [
  { quality: "low", label: "Low" },
  { quality: "medium", label: "Med" },
  { quality: "high", label: "High" },
];

const INITIAL_VITALS: AnimalVitals = {
  x: 0,
  z: 0,
  hunger: 0,
  thirst: 0,
  status: "Roaming",
  biome: "Land",
};

function NeedBar({ label, value }: { label: string; value: number }) {
  const critical = value >= CRITICAL_LEVEL;
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={critical ? "text-red-400" : undefined}>
          {Math.round(value)}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${
            critical ? "bg-red-500" : "bg-amber-400"
          }`}
          style={{ width: `${(value / NEED_MAX) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function BiodiversityPrototype() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeScale, setTimeScale] = useState<TimeScale>(1);
  const [graphicQuality, setGraphicQuality] = useState<GraphicQuality>("high");
  const [isRaining, setIsRaining] = useState(false);
  const [isCloudy, setIsCloudy] = useState(true);
  const [isFoggy, setIsFoggy] = useState(true);
  const [isPOV, setIsPOV] = useState(false);
  const [vitals, setVitals] = useState<AnimalVitals>(INITIAL_VITALS);
  const [population, setPopulation] = useState<AnimalSpawn[]>(ANIMAL_SPAWNS);
  const vitalsRef = useRef<AnimalVitals>({ ...INITIAL_VITALS });
  const labelCounters = useRef<Map<string, number> | null>(null);

  const handleDeath = useCallback((id: string) => {
    setPopulation((prev) => prev.filter((spawn) => spawn.id !== id));
    setSelectedId((prev) => {
      if (prev === id) {
        setIsPOV(false);
        return null;
      }
      return prev;
    });
  }, []);

  const handleReproduce = useCallback(
    (parent: AnimalSpawn, x: number, z: number, heading: number) => {
      setPopulation((prev) => {
        if (prev.length >= MAX_POPULATION) return prev;

        const counters = (labelCounters.current ??= initialLabelCounters());
        const next = (counters.get(parent.speciesId) ?? 0) + 1;
        counters.set(parent.speciesId, next);

        // Deterministic offset from the parent's heading, clamped so the
        // offspring always spawns inside the walkable area.
        let childX = x + Math.sin(heading + Math.PI / 2) * OFFSPRING_OFFSET;
        let childZ = z + Math.cos(heading + Math.PI / 2) * OFFSPRING_OFFSET;
        const dist = Math.hypot(childX, childZ);
        if (dist > WALK_RADIUS) {
          childX *= WALK_RADIUS / dist;
          childZ *= WALK_RADIUS / dist;
        }

        const labelBase = parent.label.split(" #")[0];
        return [
          ...prev,
          {
            id: `${parent.speciesId}-${next}`,
            speciesId: parent.speciesId,
            label: `${labelBase} #${next}`,
            x: childX,
            z: childZ,
            heading,
            initialHunger: OFFSPRING_INITIAL_NEED,
            initialThirst: OFFSPRING_INITIAL_NEED,
          },
        ];
      });
    },
    []
  );

  const spawnById = useMemo(
    () => new Map(population.map((spawn) => [spawn.id, spawn])),
    [population]
  );

  useEffect(() => {
    if (!selectedId) return;
    setVitals({ ...vitalsRef.current });
    const interval = setInterval(() => {
      setVitals({ ...vitalsRef.current });
    }, 250);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedSpawn = selectedId ? spawnById.get(selectedId) : undefined;
  const selectedSpecies = selectedSpawn
    ? getSpecies(selectedSpawn.speciesId)
    : undefined;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-900">
      <IslandScene
        population={population}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDeselect={() => { setSelectedId(null); setIsPOV(false); }}
        onDeath={handleDeath}
        onReproduce={handleReproduce}
        timeScale={timeScale}
        vitalsRef={vitalsRef}
        graphicQuality={graphicQuality}
        isRaining={isRaining}
        isCloudy={isCloudy}
        isFoggy={isFoggy}
        isPOV={isPOV}
      />

      <div className="absolute left-4 top-4 max-w-xs rounded-lg bg-slate-950/70 p-4 text-slate-100 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">Biodiversity Island</h1>
        <p className="text-sm text-slate-300">Animal Species</p>
        <p className="mt-1 text-xs text-slate-400">
          {SPECIES.length} species · {population.length} animals
        </p>
        <div className="mt-2 flex gap-1" role="group" aria-label="Simulation speed">
          {TIME_OPTIONS.map(({ scale, label }) => (
            <button
              key={scale}
              type="button"
              aria-pressed={timeScale === scale}
              onClick={() => setTimeScale(scale)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                timeScale === scale
                  ? "bg-amber-400 text-slate-900"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1" role="group" aria-label="Graphic quality">
          {GRAPHIC_OPTIONS.map(({ quality, label }) => (
            <button
              key={quality}
              type="button"
              aria-pressed={graphicQuality === quality}
              onClick={() => setGraphicQuality(quality)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                graphicQuality === quality
                  ? "bg-amber-400 text-slate-900"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1" role="group" aria-label="Weather">
          <button
            type="button"
            aria-pressed={isRaining}
            onClick={() => setIsRaining(!isRaining)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isRaining
                ? "bg-blue-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Rain {isRaining ? "On" : "Off"}
          </button>
          <button
            type="button"
            aria-pressed={isCloudy}
            onClick={() => setIsCloudy(!isCloudy)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isCloudy
                ? "bg-slate-400 text-slate-900"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Clouds {isCloudy ? "On" : "Off"}
          </button>
          <button
            type="button"
            aria-pressed={isFoggy}
            onClick={() => setIsFoggy(!isFoggy)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              isFoggy
                ? "bg-slate-300 text-slate-900"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Fog {isFoggy ? "On" : "Off"}
          </button>
        </div>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          <li>Drag to rotate, right-drag to pan</li>
          <li>Scroll to zoom</li>
          <li>Click an animal to select it</li>
        </ul>
      </div>

      {selectedSpawn && selectedSpecies && (
        <div className="absolute bottom-4 left-4 w-56 rounded-lg bg-slate-950/80 p-4 text-slate-100 backdrop-blur-sm">
          <h2 className="text-base font-semibold">{selectedSpecies.name}</h2>
          <p className="text-xs text-slate-400">{selectedSpawn.label}</p>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Status</dt>
              <dd>{vitals.status}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Biome</dt>
              <dd>{vitals.biome}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Habitat</dt>
              <dd>{selectedSpecies.habitat}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Diet</dt>
              <dd className="text-right">{selectedSpecies.diet}</dd>
            </div>
            {selectedSpecies.predatorOf && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Prey</dt>
                <dd className="text-right">
                  {selectedSpecies.predatorOf
                    .map((id) => SPECIES_BY_ID.get(id)?.name ?? id)
                    .join(", ")}
                </dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-slate-400">Position</dt>
              <dd>
                X {Math.round(vitals.x)}, Z {Math.round(vitals.z)}
              </dd>
            </div>
          </dl>
          <div className="mt-3 space-y-2">
            <NeedBar label="Hunger" value={vitals.hunger} />
            <NeedBar label="Thirst" value={vitals.thirst} />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setIsPOV(!isPOV)}
              className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              {isPOV ? "Exit POV" : "Enter POV"}
            </button>
            <button
              type="button"
              aria-label="Deselect animal"
              onClick={() => { setSelectedId(null); setIsPOV(false); }}
              className="w-full rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-white"
            >
              Deselect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
