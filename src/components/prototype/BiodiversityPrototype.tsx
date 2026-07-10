"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ANIMAL_SPAWNS, type AnimalSpawn } from "./species";
import {
  MAX_POPULATION,
  WALK_RADIUS,
  type AnimalVitals,
  type TimeScale,
} from "./simulation";
import type { GraphicQuality } from "./IslandScene";
import { HUD } from "./HUD";

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

const INITIAL_VITALS: AnimalVitals = {
  x: 0,
  z: 0,
  hunger: 0,
  thirst: 0,
  status: "Roaming",
  biome: "Land",
};

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

  useEffect(() => {
    if (!selectedId) return;
    setVitals({ ...vitalsRef.current });
    const interval = setInterval(() => {
      setVitals({ ...vitalsRef.current });
    }, 250);
    return () => clearInterval(interval);
  }, [selectedId]);

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

      <HUD
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        timeScale={timeScale}
        setTimeScale={setTimeScale}
        graphicQuality={graphicQuality}
        setGraphicQuality={setGraphicQuality}
        isRaining={isRaining}
        setIsRaining={setIsRaining}
        isCloudy={isCloudy}
        setIsCloudy={setIsCloudy}
        isFoggy={isFoggy}
        setIsFoggy={setIsFoggy}
        isPOV={isPOV}
        setIsPOV={setIsPOV}
        vitals={vitals}
        population={population}
      />
    </div>
  );
}
