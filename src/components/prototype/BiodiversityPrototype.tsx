"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { AnimalPosition } from "./Animal";
import { ANIMAL_SPAWNS, SPECIES, getSpecies } from "./species";

const IslandScene = dynamic(() => import("./IslandScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-100">
      Loading island…
    </div>
  ),
});

const SPAWN_BY_ID = new Map(ANIMAL_SPAWNS.map((spawn) => [spawn.id, spawn]));

export default function BiodiversityPrototype() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coords, setCoords] = useState<AnimalPosition>({ x: 0, z: 0 });
  const animalPositionRef = useRef<AnimalPosition>({ x: 0, z: 0 });

  useEffect(() => {
    if (!selectedId) return;
    setCoords({ ...animalPositionRef.current });
    const interval = setInterval(() => {
      setCoords({ ...animalPositionRef.current });
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
        animalPositionRef={animalPositionRef}
      />

      <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-lg bg-slate-950/70 p-4 text-slate-100 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">Biodiversity Island</h1>
        <p className="text-sm text-slate-300">Species Roster</p>
        <p className="mt-1 text-xs text-slate-400">
          {SPECIES.length} species · {ANIMAL_SPAWNS.length} animals
        </p>
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
              <dd>Roaming</dd>
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
                X {Math.round(coords.x)}, Z {Math.round(coords.z)}
              </dd>
            </div>
          </dl>
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
