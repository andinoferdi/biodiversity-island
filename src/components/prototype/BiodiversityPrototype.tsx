"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ANIMAL_SPAWNS, SPECIES, getSpecies } from "./species";
import {
  CRITICAL_LEVEL,
  NEED_MAX,
  type AnimalVitals,
  type TimeScale,
} from "./simulation";

const IslandScene = dynamic(() => import("./IslandScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-100">
      Loading island…
    </div>
  ),
});

const SPAWN_BY_ID = new Map(ANIMAL_SPAWNS.map((spawn) => [spawn.id, spawn]));

const TIME_OPTIONS: { scale: TimeScale; label: string }[] = [
  { scale: 0, label: "Pause" },
  { scale: 1, label: "1×" },
  { scale: 4, label: "4×" },
];

const INITIAL_VITALS: AnimalVitals = {
  x: 0,
  z: 0,
  hunger: 0,
  thirst: 0,
  status: "Roaming",
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
  const [vitals, setVitals] = useState<AnimalVitals>(INITIAL_VITALS);
  const vitalsRef = useRef<AnimalVitals>({ ...INITIAL_VITALS });

  useEffect(() => {
    if (!selectedId) return;
    setVitals({ ...vitalsRef.current });
    const interval = setInterval(() => {
      setVitals({ ...vitalsRef.current });
    }, 250);
    return () => clearInterval(interval);
  }, [selectedId]);

  const selectedSpawn = selectedId ? SPAWN_BY_ID.get(selectedId) : undefined;
  const selectedSpecies = selectedSpawn
    ? getSpecies(selectedSpawn.speciesId)
    : undefined;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-900">
      <IslandScene
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDeselect={() => setSelectedId(null)}
        timeScale={timeScale}
        vitalsRef={vitalsRef}
      />

      <div className="absolute left-4 top-4 max-w-xs rounded-lg bg-slate-950/70 p-4 text-slate-100 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">Biodiversity Island</h1>
        <p className="text-sm text-slate-300">Simulation Needs</p>
        <p className="mt-1 text-xs text-slate-400">
          {SPECIES.length} species · {ANIMAL_SPAWNS.length} animals
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
              <dt className="text-slate-400">Habitat</dt>
              <dd>{selectedSpecies.habitat}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-slate-400">Diet</dt>
              <dd className="text-right">{selectedSpecies.diet}</dd>
            </div>
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
          <button
            type="button"
            aria-label="Deselect animal"
            onClick={() => setSelectedId(null)}
            className="mt-3 w-full rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-white"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
