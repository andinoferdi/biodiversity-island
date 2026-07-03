# Biodiversity Island — Population Lifecycle Implementation Plan (final step of the Hari 3–5 phase)

## Context

`population-lifecycle-prompt.md` specifies the Population Lifecycle feature — the **third and final step of the roadmap's Hari 3–5 "Simulasi Inti" phase**. It builds directly on Simulation Needs (`docs/feature/simulation-needs/simulation-needs.md`) and closes the phase by making the population **dynamic**: animals **die** when a need stays maxed out too long, and well-fed animals **reproduce**, spawning offspring. The header population summary ("3 species · N animals") becomes a live simulation output instead of a constant.

This completes the Hari 3–5 scope listed in the PRD/SRS (waktu, lapar, haus, makanan, air, mati, reproduksi sederhana). Biomes, GLB models, predator–prey, and crises remain Hari 6–9.

## Facts established (Simulation Needs baseline)

- Current code on `main` / this branch: `src/components/prototype/{simulation.ts,species.ts,Animal.tsx,IslandScene.tsx,BiodiversityPrototype.tsx}`. Lint & build pass; verified in browser.
- `simulation.ts`: `TimeScale (0|1|4)`, `AnimalStatus`, `ResourceSpot`/`RESOURCES` (1 pond + 3 food patches), `NEED_MAX = 100`, `SEEK_THRESHOLD = 55`, `SATISFIED_LEVEL = 10`, `CRITICAL_LEVEL = 90`, `AnimalVitals { x, z, hunger, thirst, status }`.
- `species.ts`: `Species` now has `hungerRate`, `thirstRate`, `consumeRate`; `ANIMAL_SPAWNS` (8) is a static array; `getSpecies()`.
- `Animal.tsx`: all mutation via `dt = delta * timeScale`; needs grow per frame; priority chain consume → seek water → seek food → wander; consumption locked to `Drinking`/`Eating` status until `SATISFIED_LEVEL`; deterministic initial needs via `initialNeed()`; selected animal writes vitals to the shared `vitalsRef`.
- `BiodiversityPrototype.tsx`: `selectedId`, `timeScale` React state; 250 ms vitals polling; Pause/1×/4× buttons; needs bars.
- Architecture rules that still apply: per-frame state in refs, React state only for UI **and rare structural events**, deterministic initial data, `Math.random()` only inside the frame loop, no new dependencies, TS strict, no `any`.

## Files to create / modify

```
src/components/prototype/simulation.ts           (modify — lifecycle constants, extend AnimalVitals with condition label)
src/components/prototype/species.ts              (modify — AnimalSpawn stays; add offspring label helper if needed)
src/components/prototype/Animal.tsx              (modify — critical/well-fed timers, onDeath/onReproduce callbacks)
src/components/prototype/IslandScene.tsx         (modify — render dynamic population list, thread callbacks)
src/components/prototype/BiodiversityPrototype.tsx (modify — population state, live census header, death deselect)
```

No new files required unless splitting helps clarity (allowed: a small `population.ts` for roster helpers). No new pages, no new dependencies, no Zustand.

## Design

### The population becomes React state (the one allowed exception)

`ANIMAL_SPAWNS` becomes the **initial** roster. `BiodiversityPrototype` holds `population: AnimalSpawn[]` in React state. Death and birth are **rare, discrete events** (a few per minute), not per-frame data — so `setPopulation` on those events is consistent with the architecture: per-frame motion stays in refs inside each `Animal`; React only re-renders when the component list itself changes.

- `onDeath(id)`: remove from `population`; if `id === selectedId`, deselect (or show a brief "died" note — implementer's choice, deselect is the simple path).
- `onReproduce(parentSpawn)`: append a new `AnimalSpawn` with a fresh unique id (module-level counter or `crypto.randomUUID()` — counter preferred for determinism of labels), same `speciesId`, label like "Grazer #4", spawn position = parent position + small offset (clamped to `WALK_RADIUS`), heading from parent.
- **Population cap**: `MAX_POPULATION = 24` (global) — reproduction is silently skipped at the cap so the sim can't explode. Optional per-species cap if trivial.
- Callbacks must be wrapped so a frame-loop call schedules the state update safely (plain `setState` inside `useFrame` is legal in React — it just queues a render; keep the calls guarded so they fire once per event, not per frame).

### Death (simulation.ts + Animal.tsx)

- New constants: `DEATH_AFTER_CRITICAL = 20` (sim-seconds a need must sit at `NEED_MAX` before death), `WELL_FED_LEVEL = 35`, `REPRODUCE_AFTER = 45` (sim-seconds continuously well-fed), `MAX_POPULATION = 24`, `REPRODUCTION_NEED_PENALTY = 25` (added to parent's hunger+thirst after birth).
- Motion ref grows: `criticalTimer`, `wellFedTimer`, `hasDied` (guard so `onDeath` fires exactly once).
- Per frame (inside `dt > 0` block): if `hunger >= NEED_MAX || thirst >= NEED_MAX` → `criticalTimer += dt`, else reset to 0. When `criticalTimer >= DEATH_AFTER_CRITICAL` → set `hasDied`, call `onDeath(spawn.id)`, stop mutating.
- Status: while `criticalTimer > 0` (a need is pinned at max) show new status `"Starving"` / `"Dehydrated"` (pick by which need is maxed; thirst wins ties) so the panel telegraphs impending death. Extend `AnimalStatus` union accordingly.
- Death visual: keep it simple — animal is removed from the scene on death (no corpse mesh, no animation). Acceptable for this step.

### Reproduction (Animal.tsx)

- Per frame: if `hunger < WELL_FED_LEVEL && thirst < WELL_FED_LEVEL` → `wellFedTimer += dt`, else reset to 0.
- When `wellFedTimer >= REPRODUCE_AFTER`: reset timer, add `REPRODUCTION_NEED_PENALTY` to both needs (parent "spends" resources), call `onReproduce(...)` with current position. The cap check lives in the parent component (single source of truth for population size).
- Offspring start with moderate needs (e.g. hunger/thirst ≈ 40) so they immediately participate in the sim without instantly reproducing or dying.

### Header census + panel (BiodiversityPrototype.tsx)

- Header count derives from `population` state — updates automatically on death/birth. Optionally show per-species counts (e.g. "Grazer 3 · Hopper 4 · Strider 2") if it stays one line.
- Panel: no new bars needed; status line now can show "Starving"/"Dehydrated". `SPAWN_BY_ID` map must be derived from `population` state (useMemo), not the static array.

### Scope guards

No predator–prey, no GLB models, no biomes, no crises (Hari 6–9). No stats charts, tutorial, save, audio (Hari 10–12). No genetics/aging/sex — reproduction is asexual and timer-based. No corpse rendering. No new dependencies, no Zustand, no pages.

## Steps

1. Extend `simulation.ts`: lifecycle constants, `"Starving"`/`"Dehydrated"` statuses.
2. Extend `Animal.tsx`: criticalTimer/wellFedTimer, death guard + `onDeath`, reproduction trigger + `onReproduce`, new statuses.
3. Rework `BiodiversityPrototype.tsx`: `population` React state seeded from `ANIMAL_SPAWNS`, offspring id/label generation, cap enforcement, death-deselect, live census header, `SPAWN_BY_ID` from state.
4. Update `IslandScene.tsx`: map over `population` prop instead of the static `ANIMAL_SPAWNS`, thread callbacks.
5. `npm run lint` → fix everything.
6. `npm run build` → fix all TS/build errors.
7. Verify in browser (dev server at 4×, then stop): let an animal starve (watch "Starving"/"Dehydrated" → disappears, census drops, selection cleared if it was selected); watch a well-fed animal reproduce (census rises, offspring wanders and is selectable); confirm cap holds; Pause freezes timers too; 0 app console errors.
8. `git diff` review — no unrelated changes.

## Verification / Done criteria

- Lint and production build pass.
- Death observable end-to-end: need pinned at max → "Starving"/"Dehydrated" status → animal removed after `DEATH_AFTER_CRITICAL` sim-seconds → census decreases → selected-animal death deselects cleanly.
- Reproduction observable: continuously well-fed animal spawns an offspring near itself → census increases → offspring behaves like any animal (needs, selection, death).
- Population cap prevents runaway growth; Pause freezes death/reproduction timers; 4× accelerates them uniformly.
- Selection, deselect paths, needs cycle, and time controls from previous steps all still work.
- No external assets/requests, no new dependencies.
- Report: files changed, working features, lint/build output, limitations, and the next phase (Hari 6–9: biomes, GLB species — Wahyu's assets in `public/assets/` — predator–prey, crises).

## After implementation (separate follow-ups, not this plan)

- Write the handoff doc `docs/feature/population-lifecycle/population-lifecycle.md` (mirror `simulation-needs.md` structure).
- Update status labels in `docs/project/prd.md` / `brd.md` / `srs.md` (Hari 3–5 phase → fully `Implemented`; Hari 6–9 remains `Planned`).
