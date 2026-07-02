"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { AnimalPosition } from "./PlaceholderAnimal";

const IslandScene = dynamic(() => import("./IslandScene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-slate-900 text-slate-100">
      Loading island…
    </div>
  ),
});

export default function BiodiversityPrototype() {
  const [selected, setSelected] = useState(false);
  const [coords, setCoords] = useState<AnimalPosition>({ x: 0, z: 0 });
  const animalPositionRef = useRef<AnimalPosition>({ x: 2, z: 0 });

  useEffect(() => {
    if (!selected) return;
    setCoords({ ...animalPositionRef.current });
    const interval = setInterval(() => {
      setCoords({ ...animalPositionRef.current });
    }, 250);
    return () => clearInterval(interval);
  }, [selected]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-900">
      <IslandScene
        selected={selected}
        onSelect={() => setSelected(true)}
        onDeselect={() => setSelected(false)}
        animalPositionRef={animalPositionRef}
      />

      <div className="pointer-events-none absolute left-4 top-4 max-w-xs rounded-lg bg-slate-950/70 p-4 text-slate-100 backdrop-blur-sm">
        <h1 className="text-lg font-semibold">Biodiversity Island</h1>
        <p className="text-sm text-slate-300">Day 1 Prototype</p>
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          <li>Drag to rotate, right-drag to pan</li>
          <li>Scroll to zoom</li>
          <li>Click the animal to select it</li>
        </ul>
      </div>

      {selected && (
        <div className="absolute bottom-4 left-4 w-56 rounded-lg bg-slate-950/80 p-4 text-slate-100 backdrop-blur-sm">
          <h2 className="text-base font-semibold">Island Grazer</h2>
          <dl className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Status</dt>
              <dd>Roaming</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Habitat</dt>
              <dd>Grassland</dd>
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
            onClick={() => setSelected(false)}
            className="mt-3 w-full rounded-md bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-white"
          >
            Deselect
          </button>
        </div>
      )}
    </div>
  );
}
