# Biodiversity Island — Biome Terrain Implementation Plan (first step of the Hari 6–9 phase)

## Context

`biome-terrain-prompt.md` specifies the Biome Terrain feature — the **first step of the roadmap's Hari 6–9 "Bioma & Spesies" phase**. It builds on the completed Hari 3–5 core simulation (`docs/feature/population-lifecycle/population-lifecycle.md`) and does two things: (1) restructures the island into **three visible biomes** (forest, grassland, shore) with per-biome vegetation and resources, and (2) validates the **GLB asset pipeline for the first time** using the small environment models (`tree.glb`, `rock.glb`, `log.glb`) instead of primitive cones/cylinders.

Animals get a **home biome** derived from their species' habitat: wandering steers back toward the home biome, and each biome has its own water and food so residents can live entirely inside it. The six GLB animal species, predator–prey, and crises are **later steps** of this phase.

## Facts established (Hari 3–5 baseline)

- Current code on this branch: `src/components/prototype/{simulation.ts,species.ts,Animal.tsx,IslandScene.tsx,BiodiversityPrototype.tsx}`. Lint & build pass; verified in browser.
- `simulation.ts`: `TimeScale`, `AnimalStatus` (7 values), `RESOURCES` (1 pond + 3 food patches), need thresholds, lifecycle constants (`DEATH_AFTER_CRITICAL = 20`, `WELL_FED_LEVEL = 65`, `REPRODUCE_AFTER = 45`, `MAX_POPULATION = 24`, `REPRODUCTION_NEED_PENALTY = 25`), `WALK_RADIUS = 5.2`, `AnimalVitals`.
- `species.ts`: 3 placeholder species with rates, `AnimalSpawn` (+ optional `initialHunger`/`initialThirst`), `ANIMAL_SPAWNS` (8).
- `Animal.tsx`: all mutation via `dt = delta * timeScale`; priority chain consume → seek water → seek food → wander; critical/well-fed timers; `onDeath`/`onReproduce` callbacks.
- `BiodiversityPrototype.tsx`: `population` React state, live census, death-deselect, offspring labels; 250 ms vitals polling; Pause/1×/4×.
- Assets verified in `public/assets/`: `environment/tree/tree.glb` (70 KB), `environment/rock/rock.glb` (30 KB), `environment/log/log.glb` (14 KB), `environment/terrain/terrain.glb` (2.3 MB, **not used this step** — the island stays procedural so walk/biome math stays trivial). Animal GLBs (6 species, only deer animated) are for the next step.
- Architecture rules that still apply: per-frame state in refs, React state only for UI and rare structural events, deterministic initial data, `Math.random()` only inside the frame loop, no new dependencies, TS strict, `dynamic ssr:false` for the scene, GLB via drei `useGLTF` (PRD allows GLTFLoader/useGLTF starting this phase).

## Files to create / modify

```
src/components/prototype/biomes.ts               (create — Biome type, BIOMES data, biomeAt(x,z), getBiome)
src/components/prototype/simulation.ts           (modify — RESOURCES become per-biome: 2 ponds + 3 food patches with biomeId)
src/components/prototype/species.ts              (modify — species gains biomeId; spawn layout moves into home biomes)
src/components/prototype/Animal.tsx              (modify — wander steers back to home biome; seeks own-biome resources first)
src/components/prototype/EnvironmentModels.tsx   (create — Tree/Rock/Log components wrapping useGLTF + preload)
src/components/prototype/IslandScene.tsx         (modify — three biome ground zones, GLB vegetation per biome, Suspense fallback)
src/components/prototype/BiodiversityPrototype.tsx (modify — panel shows biome name; subtitle "Biome Terrain")
```

No new dependencies (drei is already installed and exports `useGLTF`/`Clone`). No new pages, no Zustand.

## Design

### Three biomes as angular sectors of the island disc

The island stays a procedural cylinder. Biomes are three 120° sectors (deterministic, trivially computable): **Forest** (`hutan`, dense trees + logs), **Grassland** (`padang rumput`, sparse trees + rocks), **Shore** (`pesisir`, rocks + logs, big pond). `biomeAt(x, z)` returns the biome from `atan2(z, x)` — O(1), no geometry queries. Each biome gets a tinted ground wedge (`circleGeometry` with `thetaStart`/`thetaLength`) so the boundary is visible top-down.

### Per-biome resources

`ResourceSpot` gains `biomeId`. New deterministic layout: each biome contains at least one water spot and one food patch (2 ponds + 3 food patches total keeps today's density). Seek picks the nearest matching spot **in the home biome**; if none exists (never true with this layout, but guard anyway) fall back to global nearest. This creates the PRD's "batas habitat" behavior without hard walls — animals can physically cross biomes but their needs and wander keep them home.

### Home-biome wander steering (Animal.tsx)

Species gains `biomeId`. During `Roaming`, if the animal is outside its home biome, `headingTarget` points to the home biome's center (same mechanism as the existing shoreline steer). Seek/consume behavior is untouched — resource choice already keeps them local. No hard per-biome clamp: the global `WALK_RADIUS` clamp stays the only hard boundary.

### First GLB pipeline validation (EnvironmentModels.tsx)

One small file wraps the three environment models: `useGLTF("/assets/environment/tree/tree.glb")` etc., rendered per instance via drei `<Clone>`, `useGLTF.preload(...)` for all three, and a documented per-model `scale`/`y`-offset correction determined at implementation time by inspecting the loaded scene in the browser. `IslandScene` renders vegetation per biome from deterministic position tables (like today's `TREES`). The scene content gets a `<Suspense>` fallback so loading never blanks the page. This is the pipeline test the BRD requires before the animal GLBs: source → scale/origin check → runtime load → console clean → build clean.

Shadows: enable by traversing the cloned scene once (`traverse` + `castShadow = true`) — decided inside `EnvironmentModels.tsx`, not per call site.

### Scope guards

No animal GLBs, no animations, no predator–prey, no crises (later steps of Hari 6–9). No `terrain.glb` (island stays procedural). No stats/tutorial/save/audio (Hari 10–12). No InstancedMesh yet (optimization is Hari 13+; vegetation stays ≤ ~40 objects). Species stay the 3 placeholders with primitive animal meshes.

## Steps

1. Create `biomes.ts`: `Biome { id, name, groundColor, thetaStart, thetaLength, centerX, centerZ }`, `BIOMES` (3), `biomeAt(x, z)`, `getBiome(id)`.
2. `simulation.ts`: add `biomeId` to `ResourceSpot`; new deterministic 2-pond + 3-patch layout, every biome self-sufficient; all thresholds unchanged.
3. `species.ts`: add `biomeId` per species (grazer → grassland, hopper → shore, strider → forest); move `ANIMAL_SPAWNS` positions into each species' home biome.
4. `Animal.tsx`: seek nearest own-biome resource (fallback global); roaming steer toward home biome center when outside it.
5. Create `EnvironmentModels.tsx` (useGLTF + Clone + preload + shadow traversal); in `IslandScene.tsx` replace primitive trees with per-biome GLB vegetation, add biome ground wedges and `<Suspense>` fallback.
6. `BiodiversityPrototype.tsx`: selected-animal panel gains a "Biome" row (from species); subtitle → "Biome Terrain".
7. `npm run lint` → fix everything.
8. `npm run build` → fix all TS/build errors.
9. Verify in browser (dev server, then stop — reuse the running one on port 3005 if present): three biome zones visible; GLB tree/rock/log render at correct scale with no missing-asset requests; animals stay near their home biome and the full needs cycle still works; birth/death/census/deselect still work; Pause/4× still work; 0 app console errors.
10. `git diff` review — no unrelated changes.

## Verification / Done criteria

- Lint and production build pass.
- Three biomes visually distinct top-down; every biome has water + food; each species lives in its habitat biome and survives there.
- GLB pipeline proven: 3 environment models load from `public/assets/environment/`, no 404s, no console errors, correct scale/orientation, shadows work.
- All Hari 3–5 features still work: needs cycle, death (Starving/Dehydrated), reproduction, cap, census, selection/deselect, time controls.
- No new dependencies; `Math.random()` still only inside the frame loop; deterministic layouts.
- Report: files changed, working features, lint/build output, limitations, next step (GLB animal species swap — 6 species from `public/assets/animal/`, only deer animated).

## After implementation (separate follow-ups, not this plan)

- Write the handoff doc `docs/feature/biome-terrain/biome-terrain.md` (mirror `population-lifecycle.md` structure).
- Update `docs/project/prd.md` / `brd.md` / `srs.md` (Hari 6–9 → `In Progress`, langkah biome-terrain `Implemented`).
