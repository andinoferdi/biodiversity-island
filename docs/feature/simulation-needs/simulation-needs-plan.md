# Biodiversity Island — Simulation Needs Implementation Plan (second step of the Hari 3–5 phase)

## Context

`simulation-needs-prompt.md` specifies the Simulation Needs feature — the **second step of the roadmap's Hari 3–5 "Simulasi Inti" phase**. It builds directly on the Species Roster step (`docs/feature/species-roster/species-roster.md`) and introduces the first real simulation: **simulation time** (pause/speed control), **per-animal needs** (hunger, thirst) with per-species rates, **resources on the island** (one water pond, several food patches), and **need-driven behavior** (animals seek and consume resources; panel status becomes a simulation output instead of the static "Roaming"). Death and simple reproduction are deliberately **not** in this step — they are the third and final step of the same Hari 3–5 phase, and they need this feature's needs system to exist first.

This delivers PRD FR-006 (time control / observable change) and FR-007 (at least one cause–effect relation: water/food availability drives animal state and movement).

## Facts established (Species Roster baseline)

- Current code on `develop` / this branch: `src/components/prototype/{species.ts,Animal.tsx,IslandScene.tsx,BiodiversityPrototype.tsx}` + `src/app/{page,layout}.tsx`. Lint & build pass; verified in browser.
- `species.ts`: `Species` (id, name, habitat, diet, bodyColor, accentColor, scale, moveSpeed, turnSpeed), `AnimalSpawn` (id, speciesId, label, x, z, heading), `SPECIES` (3), `ANIMAL_SPAWNS` (8), `getSpecies()`.
- `Animal.tsx`: per-frame motion in a ref (`x, z, heading, headingTarget, wanderTimer`), wander every 2–5 s, boundary steer at 85% of `WALK_RADIUS` (5.2), hard clamp, delta-based; writes to the shared `positionRef` only when selected.
- `IslandScene.tsx`: `GROUND_Y = 0.9`, `WALK_RADIUS = 5.2`; island grass top is a cylinder r≈6.4; 12 deterministic trees; Canvas `onPointerMissed` → deselect.
- `BiodiversityPrototype.tsx`: `selectedId: string | null`, 250 ms polling of `positionRef` while selected, header overlay + info panel.
- Architecture rules that still apply: per-frame state in refs (never React state), React state only for UI, `dynamic(..., {ssr:false})` stays in the `"use client"` wrapper, deterministic placement for static props, `Math.random()` only inside the frame loop, no new dependencies, TS strict, no `any`.

## Files to create / modify

```
src/components/prototype/simulation.ts           (new — sim types/constants: TimeScale, need thresholds, resource data)
src/components/prototype/species.ts              (modify — add per-species need rates: hungerRate, thirstRate, consumeRate)
src/components/prototype/Animal.tsx              (modify — needs accumulation, seek/consume behavior, status derivation, timeScale)
src/components/prototype/IslandScene.tsx         (modify — render pond + food patches, thread timeScale + info ref)
src/components/prototype/BiodiversityPrototype.tsx (modify — time controls UI, needs bars + dynamic status in panel)
```

No new pages, no new dependencies, no Zustand — time scale is plain React state (changes rarely), per-frame data stays in refs.

## Design

### simulation.ts (new)
- `type TimeScale = 0 | 1 | 4` (Pause / 1× / 4×).
- `interface ResourceSpot { id: string; kind: "water" | "food"; x: number; z: number; radius: number; }`
- `RESOURCES: ResourceSpot[]` — deterministic: **one water pond** (e.g. `{ x: -2.8, z: -2.6, radius: 1.1 }`) and **3 food patches** spread around the grass (radius ≈ 0.7), all within `WALK_RADIUS`, not overlapping tree positions.
- Need constants: `NEED_MAX = 100`, `SEEK_THRESHOLD = 55` (start seeking), `SATISFIED_LEVEL = 10` (stop consuming), `CRITICAL_LEVEL = 90` (only affects status label for now — death comes next step).
- `interface AnimalVitals { x: number; z: number; hunger: number; thirst: number; status: AnimalStatus; }` and `type AnimalStatus = "Roaming" | "Seeking water" | "Drinking" | "Seeking food" | "Eating"` — this replaces `AnimalPosition` as the shared selected-animal ref payload (keep the shape flat; the UI polls it at 250 ms as before).

### species.ts (modify)
- Extend `Species` with `hungerRate` and `thirstRate` (points/sim-second, e.g. ~1.2–2.5 so a need crosses the threshold in ~30–60 sim-seconds) and `consumeRate` (points/sim-second recovered while eating/drinking, e.g. ~20). Small/fast Dune Hopper = fastest rates; large/slow Highland Strider = slowest. Existing fields and spawns unchanged.

### Animal.tsx (modify — the core of this feature)
- Motion ref grows: `{ x, z, heading, headingTarget, wanderTimer, hunger, thirst }` (hunger/thirst start at deterministic varied values, e.g. derived from spawn index, so animals don't all seek at once).
- `useFrame`: `const dt = delta * timeScale;` — **everything** (movement, wander timer, need growth, consumption) uses `dt`, so Pause freezes the whole simulation and 4× accelerates it uniformly. When `timeScale === 0`, still write vitals for the selected animal (panel stays readable) but skip all mutation.
- Behavior priority each frame (simple if/else chain, no state machine class):
  1. If currently at a matching resource (distance < spot.radius + small margin) and the driving need > `SATISFIED_LEVEL`: **consume** — need decreases by `consumeRate * dt`, animal stands still (skip movement), status "Drinking"/"Eating".
  2. Else if `thirst > SEEK_THRESHOLD`: steer `headingTarget` toward the water pond (thirst wins ties — it grows faster), status "Seeking water".
  3. Else if `hunger > SEEK_THRESHOLD`: steer toward the **nearest** food patch, status "Seeking food".
  4. Else: existing wander logic, status "Roaming".
  - Boundary steer and hard clamp remain as the outermost safety net (resources are all inside the walk radius so no conflict).
- Needs grow every frame: `hunger += hungerRate * dt` (clamped to `NEED_MAX`), same for thirst.
- Selected animal writes `{ x, z, hunger, thirst, status }` into the shared `vitalsRef` (renamed from `positionRef`).
- New props: `timeScale: TimeScale`, `vitalsRef`. Everything else unchanged (selection, hover cursor, ring, meshes).

### IslandScene.tsx (modify)
- Render the pond: flat blue cylinder/circle slightly above the grass (y ≈ GROUND_Y + 0.01) at the water spot, visually distinct from the sea.
- Render food patches: small green-yellow flattened spheres/cylinders ("berry patches") at each food spot. Both from `RESOURCES` — no pointer handlers (they must not block `onPointerMissed` deselect… note: meshes without handlers don't block it).
- Thread `timeScale` and `vitalsRef` down to every `Animal`. Sea, island, trees, camera, controls, lights unchanged.

### BiodiversityPrototype.tsx (modify)
- New React state `timeScale: TimeScale` (default 1). Header gains three small buttons: **Pause / 1× / 4×** (active one highlighted; `aria-pressed`). Also show a tiny sim-clock readout (elapsed sim time, mm:ss) — derive it from a ref + the same 250 ms… simpler: accumulate in a ref inside IslandScene? Keep it minimal: elapsed sim-seconds accumulated in a module-less ref updated by a tiny `useFrame` helper inside the scene and displayed via the existing polling only when cheap — **if this adds complexity, drop the clock readout; Pause/1×/4× buttons alone satisfy the scope.** (Decision left to implementer; buttons are required, clock is optional.)
- Panel: status line now shows the live status from `vitalsRef` polling; add two thin need bars (Hunger, Thirst) rendered from polled values (0–100, simple Tailwind `div` widths, color shifts at `CRITICAL_LEVEL`). Coordinates stay.
- Polling interval unchanged (250 ms while selected), now reading `vitalsRef`.

### Scope guards
No death, no reproduction (next step of Hari 3–5). No GLB/biomes/predator–prey/crises (Hari 6–9). No save/tutorial/stats/audio (Hari 10–12). No new dependencies, no Zustand, no pages. Movement/selection architecture unchanged.

## Steps

1. Create `simulation.ts` (types, thresholds, `RESOURCES`).
2. Extend `species.ts` with need/consume rates.
3. Rework `Animal.tsx`: timeScale-scaled dt, needs accumulation, seek/consume priority chain, vitals writing.
4. Update `IslandScene.tsx`: pond + food patch meshes, thread new props.
5. Update `BiodiversityPrototype.tsx`: time control buttons, needs bars + dynamic status in panel.
6. `npm run lint` → fix everything.
7. `npm run build` → fix all TS/build errors.
8. Verify in browser (dev server, then stop): needs rise over time; a thirsty animal walks to the pond, status "Seeking water" → "Drinking", thirst bar falls; same for food; Pause freezes all movement and bars; 4× visibly accelerates; deselect still works (pond/patches must not swallow `onPointerMissed`); 0 app console errors.
9. `git diff` review — no unrelated changes.

## Verification / Done criteria

- Lint and production build pass.
- Observable cause–effect loop: need grows → animal seeks the correct resource → consumes → need falls → returns to roaming. Status label and bars reflect it live in the panel.
- Pause (0×) freezes movement, needs, and consumption; 4× accelerates everything uniformly; movement stays frame-rate independent at every speed.
- All 8 animals still stay within the walk radius; per-id selection, switching, and both deselect paths still work.
- No external assets/requests, no new dependencies.
- Report: files changed, working features, lint/build output, limitations, and the next step within Hari 3–5 (death when a need stays at `NEED_MAX` too long + simple reproduction).

## After implementation (separate follow-ups, not this plan)

- Write the handoff doc `docs/feature/simulation-needs/simulation-needs.md` (mirror `species-roster.md` structure).
- Update status labels in `docs/project/prd.md` / `brd.md` / `srs.md` (simulation-needs → `Implemented` with evidence paths; death/reproduction remains `Planned`).
