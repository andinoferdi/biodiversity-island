# Biodiversity Island — Species Roster Implementation Plan (first step of the Hari 3–5 phase)

## Context

`species-roster-prompt.md` specifies the Species Roster feature — the **first step of the roadmap's Hari 3–5 "Simulasi Inti" phase** (simulation time, hunger, thirst, food, water, habitat bounds, death, simple reproduction). It generalizes the single hardcoded "Island Grazer" from the Hari 1–2 prototype into a **data-driven multi-species population**: several species defined in one typed data module, multiple individuals per species roaming the island simultaneously, id-based selection, and an info panel that shows the selected individual's species data. This is the exact next step recommended in `docs/feature/prototype/prototype.md` ("Batasan Day 1 & Arah Day 2") and the prerequisite for the rest of Hari 3–5 — this step deliberately does **not** yet include needs (hunger/thirst), simulation time, death/reproduction, predator–prey, or GLB assets; those are the subsequent steps of the same phase (GLB and predator–prey arrive in Hari 6–9).

## Facts established by exploration (Day 1 baseline)

- Day 1 prototype is `Implemented` on `andino/feat/prototype` (now also on `develop`): `src/components/prototype/{BiodiversityPrototype,IslandScene,PlaceholderAnimal}.tsx`.
- Stack: Next.js 16.2.10 (App Router, Turbopack, React Compiler on), React 19, TS strict, Tailwind v4, three 0.185 + R3F v9 + drei v10. No new dependencies are needed for this step.
- Next 16 constraint: `dynamic(..., { ssr: false })` must stay inside a `"use client"` file → keep the `BiodiversityPrototype.tsx` wrapper layer as-is.
- Key Day 1 constants in `IslandScene.tsx`: `GROUND_Y = 0.9`, `WALK_RADIUS = 5.2`.
- Day 1 movement/selection architecture to preserve: per-frame state in refs (never React state), frame-rate-independent movement via `useFrame` delta, shortest-arc heading interpolation, boundary steer toward island center at 85% of walk radius, `onClick` + `stopPropagation` for select, `onPointerMissed` on Canvas for deselect, `positionRef` written by the frame loop and polled at 250 ms by the overlay while something is selected.
- Deterministic placement rule: `Math.random()` allowed only inside the frame loop for wander targets; spawn positions and static props must be deterministic data.

## Files to create / modify

```
src/components/prototype/species.ts             (new — species + individual data, types)
src/components/prototype/Animal.tsx             (new — generalized animal, replaces PlaceholderAnimal.tsx)
src/components/prototype/PlaceholderAnimal.tsx  (delete — superseded by Animal.tsx)
src/components/prototype/IslandScene.tsx        (modify — render animals from data, selection by id)
src/components/prototype/BiodiversityPrototype.tsx (modify — selectedId state, panel from species data)
src/app/layout.tsx                              (modify — description mentions species roster if desired; optional)
```

No new pages, no new dependencies, no Zustand yet — `selectedId: string | null` in local React state is still sufficient.

## Design

### species.ts
- `interface Species { id: string; name: string; habitat: string; diet: string; bodyColor: string; accentColor: string; scale: number; moveSpeed: number; turnSpeed: number; }`
- `interface AnimalSpawn { id: string; speciesId: string; x: number; z: number; heading: number; }`
- Export `SPECIES: Species[]` (3 species, all herbivore-styled placeholders so no behavior coupling is implied yet — e.g. "Island Grazer" (existing look, medium), "Dune Hopper" (small, fast), "Highland Strider" (large, slow)) and `ANIMAL_SPAWNS: AnimalSpawn[]` (6–8 individuals total, deterministic positions within `WALK_RADIUS`, spread out so they don't overlap at load).
- Colors must contrast with terrain and with each other; scale/speed differences must be visible at the default zoom.

### Animal.tsx (generalization of PlaceholderAnimal.tsx)
- Same mesh construction as Day 1 (box body, head, 4 legs, tail, selection ring) but parameterized by `species.scale`, `species.bodyColor`, `species.accentColor` — apply scale on the group, not per-mesh.
- Props: `{ spawn: AnimalSpawn; species: Species; groundY: number; walkRadius: number; selected: boolean; onSelect: (id: string) => void; positionRef: MutableRefObject<AnimalPosition> }`.
- Movement logic identical to Day 1 (wander every 2–5 s, boundary steer, delta-based) but reads `species.moveSpeed` / `species.turnSpeed`; initial position/heading from `spawn`.
- The frame loop writes into `positionRef` **only when `selected`** (avoids 8 ref writes/frame that nobody reads; cheap micro-decision, keep it simple if it complicates code).
- Keep cursor pointer on hover, emissive tint + ring when selected.

### IslandScene.tsx
- Replace the single `<PlaceholderAnimal>` with `ANIMAL_SPAWNS.map(...)` joining spawn → species (build a `Map<string, Species>` once at module scope; a missing speciesId should be a TypeScript-visible impossibility, not a runtime branch).
- Props change: `selected: boolean` → `selectedId: string | null`; `onSelect(id: string)`; single shared `positionRef` is still fine because only one animal is selected at a time and only the selected one writes to it.
- Sea, island, trees, lights, camera, MapControls: unchanged.

### BiodiversityPrototype.tsx
- State: `selectedId: string | null` (+ existing `coords` polling state, unchanged 250 ms interval gated on `selectedId !== null`).
- Panel resolves the selected animal's species from the data module and shows: species name, individual id (e.g. "Grazer #2" — derive a human label from spawn data), Status "Roaming", Habitat, Diet, live X/Z, Deselect button.
- Header overlay: label becomes "Species Roster" (no day number); instructions unchanged.
- Also show a tiny population summary line in the header (e.g. "3 species · 7 animals") derived from the data module — zero simulation, just counts.

### Scope guards (from spec)
No GLB/images/APIs/DB/auth/Zustand/physics/post-processing, no extra pages. Needs (hunger/thirst), simulation time, death, and reproduction are **not in this step** — they are the next steps of the same Hari 3–5 phase and must not be started here; predator–prey and GLB belong to Hari 6–9. TS strict, no `any`, no ESLint disables. Movement stays visually equivalent to Day 1.

## Steps

1. Create `species.ts` with types, 3 species, 6–8 deterministic spawns.
2. Create `Animal.tsx` from `PlaceholderAnimal.tsx`, parameterized; delete `PlaceholderAnimal.tsx` in the same commit.
3. Update `IslandScene.tsx` to map over spawns and thread `selectedId`/`onSelect`.
4. Update `BiodiversityPrototype.tsx` (selectedId state, panel content, header label, population summary).
5. `npm run lint` → fix everything.
6. `npm run build` → fix all TS/build errors.
7. Verify in browser (dev server, then stop it): all animals roam and stay on the island, each is individually selectable, panel shows correct per-species data, deselect works (button + empty click), no app console errors, frame rate stable with ~8 animals.
8. `git diff` review — no unrelated changes.

## Verification / Done criteria

- Lint and production build pass.
- ≥3 species and ≥6 individuals visible, visually distinguishable (color + size), moving at visibly different speeds.
- Clicking any animal selects exactly that individual (ring follows it, panel shows its species data); switching selection between animals works without deselecting first.
- Movement is frame-rate independent and all animals respect the walk radius.
- No external assets or network requests; no new dependencies.
- Report: files changed, working features, lint/build output, limitations of this step, and the next step within the Hari 3–5 phase (likely: simulation time plus species needs — hunger/thirst — and a water/food resource on the island, per the roadmap in the PRD).

## After implementation (separate follow-ups, not this plan)

- Write the handoff doc `docs/feature/species-roster/species-roster.md` (mirror `prototype.md` structure).
- Update status labels in `docs/project/prd.md` / `brd.md` and note in `docs/project/git-workflow.md` that `develop` now exists and feature PRs target it.
