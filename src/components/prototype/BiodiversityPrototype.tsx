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
    <div className="flex h-full w-full items-center justify-center bg-[#0b1220] text-slate-100">
      Loading island…
    </div>
  ),
});

const OFFSPRING_INITIAL_NEED = 40;
const OFFSPRING_OFFSET = 0.9;

function initialLabelCounters(): Map<string, number> {
  const counters = new Map<string, number>();
  for (const spawn of ANIMAL_SPAWNS) {
    counters.set(spawn.speciesId, (counters.get(spawn.speciesId) ?? 0) + 1);
  }
  return counters;
}

const TIME_OPTIONS: { scale: TimeScale; label: string }[] = [
  { scale: 0, label: "Pause" },
  { scale: 1, label: "1x" },
  { scale: 4, label: "4x" },
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
      <div className="flex justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className={critical ? "text-red-400" : "text-slate-200"}>
          {Math.round(value)}
        </span>
      </div>
      <div className="mt-1 h-1 w-full rounded-full bg-slate-800/80">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
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
    <div className="relative h-dvh w-full overflow-hidden bg-[#0b1220]">
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

      {/* Top-left control hub */}
      <div className="absolute left-4 top-4 w-64 rounded-2xl border border-white/[0.06] bg-slate-950/60 p-4 text-slate-100 backdrop-blur-md">
        <div className="flex items-baseline justify-between">
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight text-slate-100">
              Biodiversity Island
            </h1>
            <p className="text-[11px] text-slate-400">
              {SPECIES.length} species · {population.length} animals
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <ControlGroup label="Simulation speed">
            <SegmentedGroup
              options={TIME_OPTIONS}
              value={timeScale}
              onChange={(opt) => setTimeScale(opt.scale)}
              getKey={(o) => String(o.scale)}
            />
          </ControlGroup>

          <ControlGroup label="Graphics">
            <SegmentedGroup
              options={GRAPHIC_OPTIONS}
              value={graphicQuality}
              onChange={(opt) => setGraphicQuality(opt.quality)}
              getKey={(o) => o.quality}
            />
          </ControlGroup>

          <ControlGroup label="Weather">
            <div className="flex gap-1.5">
              {[
                { active: isRaining, toggle: () => setIsRaining(!isRaining), label: "Rain" },
                { active: isCloudy, toggle: () => setIsCloudy(!isCloudy), label: "Clouds" },
                { active: isFoggy, toggle: () => setIsFoggy(!isFoggy), label: "Fog" },
              ].map(({ active, toggle, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={toggle}
                  className={`h-7 rounded-lg px-2.5 text-[11px] font-medium transition-all duration-200 ${
                    active
                      ? "bg-amber-400 text-slate-900 shadow-sm shadow-amber-400/20"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </ControlGroup>
        </div>

        <div className="mt-4 space-y-1 text-[11px] text-slate-500">
          <p>Drag to rotate · Right-drag to pan</p>
          <p>Scroll to zoom · Click an animal</p>
        </div>
      </div>

      {/* Bottom-left species dossier */}
      {selectedSpawn && selectedSpecies && (
        <div className="absolute bottom-4 left-4 w-64 rounded-2xl border border-white/[0.06] bg-slate-950/70 p-4 text-slate-100 backdrop-blur-md">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-slate-100">
                {selectedSpecies.name}
              </h2>
              <p className="text-[11px] text-slate-400">{selectedSpawn.label}</p>
            </div>
            <span className="rounded-md bg-slate-800/60 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-300">
              {vitals.status}
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-slate-500">Biome</dt>
              <dd className="text-slate-200">{vitals.biome}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Habitat</dt>
              <dd className="text-slate-200">{selectedSpecies.habitat}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-slate-500">Diet</dt>
              <dd className="text-slate-200">{selectedSpecies.diet}</dd>
            </div>
            {selectedSpecies.predatorOf && (
              <div className="col-span-2">
                <dt className="text-slate-500">Prey</dt>
                <dd className="text-slate-200">
                  {selectedSpecies.predatorOf
                    .map((id) => SPECIES_BY_ID.get(id)?.name ?? id)
                    .join(", ")}
                </dd>
              </div>
            )}
            <div className="col-span-2">
              <dt className="text-slate-500">Position</dt>
              <dd className="text-slate-200">
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
              className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all duration-200 ${
                isPOV
                  ? "bg-amber-400 text-slate-900 shadow-sm shadow-amber-400/20"
                  : "bg-slate-800/70 text-slate-200 hover:bg-slate-800"
              }`}
            >
              {isPOV ? "Exit POV" : "Enter POV"}
            </button>
            <button
              type="button"
              aria-label="Deselect animal"
              onClick={() => { setSelectedId(null); setIsPOV(false); }}
              className="flex-1 rounded-lg bg-slate-800/70 px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition-all duration-200 hover:bg-slate-800 active:scale-[0.97]"
            >
              Deselect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      {children}
    </div>
  );
}

function SegmentedGroup<T extends { label: string }>({
  options,
  value,
  onChange,
  getKey,
}: {
  options: T[];
  value: string | number;
  onChange: (v: T) => void;
  getKey: (o: T) => string | number;
}) {
  return (
    <div className="flex rounded-lg bg-slate-900/50 p-0.5">
      {options.map((opt) => {
        const active = String(getKey(opt)) === String(value);
        return (
          <button
            key={getKey(opt)}
            type="button"
            onClick={() => onChange(opt as T)}
            className={`flex-1 rounded-md py-1 text-[11px] font-medium transition-all duration-200 ${
              active
                ? "bg-amber-400 text-slate-900 shadow-sm shadow-amber-400/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
