# Biodiversity Island — Day 1 Prototype Implementation Plan

## Context

`prototype-prompt.md` specifies a Day 1 prototype: a full-screen interactive 3D island (top-down sim-game view) built with Three.js/react-three-fiber inside the existing Next.js 16 app. It must show a placeholder island, ~10–15 deterministic trees, one auto-roaming clickable animal ("Island Grazer") with a selection ring and info panel, orthographic camera with MapControls, and pass `npm run lint` + `npm run build`. No external assets, no extra dependencies beyond the 3D stack.

## Facts established by exploration

- **Dependencies already installed** — `three@^0.185.1`, `@react-three/fiber@^9.6.1`, `@react-three/drei@^10.7.7`, plus `@types/three`? → **@types/three is NOT in package.json**; three ships its own types since ~0.150 via `@types/three`? No — three has no bundled types; **run `npm install -D @types/three`** (the only install needed; check first with `npm ls @types/three`).
- Next **16.2.10**, React **19.2.4**, React Compiler enabled (`reactCompiler: true` top-level in next.config.ts, babel-plugin-react-compiler 1.0.0 installed).
- **Next 16 breaking change**: `dynamic(..., { ssr: false })` errors in Server Components. The dynamic import must be inside a `"use client"` file.
- Tailwind **v4** (CSS-based config via `@import "tailwindcss"` + `@theme` in globals.css; no tailwind.config).
- ESLint 9 flat config; `lint` script is bare `eslint` (may need a path arg — verify; if `npm run lint` lints nothing, run `npx eslint src` as well but don't change scripts unless broken).
- Path alias `@/*` → `src/*`. `src/components/` does not exist yet.
- `src/app/page.tsx` is the default create-next-app template (Server Component); layout.tsx exports metadata + Geist fonts — keep layout as-is (maybe update metadata title to "Biodiversity Island").

## Files to create / modify

```
src/app/page.tsx                                    (rewrite — minimal, renders wrapper)
src/app/layout.tsx                                  (metadata title/description only)
src/components/prototype/BiodiversityPrototype.tsx  (new — "use client"; dynamic ssr:false import of scene + HTML overlay UI + selection state)
src/components/prototype/IslandScene.tsx            (new — "use client"; Canvas, camera, controls, lights, sea, island, trees)
src/components/prototype/PlaceholderAnimal.tsx      (new — "use client"; animal meshes, useFrame movement, pointer events)
```

Optionally a small `src/components/prototype/types.ts` if shared types warrant it; otherwise keep types in the components.

## Design

### page.tsx (Server Component)
Renders `<BiodiversityPrototype />` only. No `"use client"` here.

### BiodiversityPrototype.tsx (`"use client"`)
- `const IslandScene = dynamic(() => import("./IslandScene"), { ssr: false, loading: () => <fallback/> })` — legal here because the file is a Client Component (Next 16 requirement).
- Holds React state: `selected: AnimalInfo | null` where AnimalInfo = `{ name, status, habitat, position: {x, z} }`. Position in state is updated **only on selection** and via a coarse interval or on-select snapshot — NOT per frame. Simplest compliant approach: store a `selected: boolean` + read coordinates from a ref exposed by the animal, refreshed with a ~4×/sec `setInterval` while selected (cheap, avoids per-frame renders). Alternative: update coords only at selection time. Choose the interval approach so panel coords feel live but renders stay ~4/sec.
- Layout: `<div className="relative h-dvh w-full overflow-hidden">`, Canvas fills it, overlay UI absolutely positioned:
  - Top-left: title "Biodiversity Island", "Day 1 Prototype", short instructions (drag = rotate/pan, scroll = zoom, click animal = select).
  - Bottom-left (or top-right) panel when selected: Name "Island Grazer", Status "Roaming", Habitat "Grassland", rounded X/Z coords, "Deselect" button (`aria-label`, real `<button>`).
- WebGL fallback: wrap Canvas render with a simple check — use Canvas `fallback` prop (R3F v9 supports `fallback` rendered when WebGL context creation fails) plus the dynamic `loading` fallback for load time. No new deps.

### IslandScene.tsx (`"use client"`)
- `<Canvas orthographic shadows camera={{ position: [12, 14, 12], zoom: 40, near: 0.1, far: 100 }}>` (tune zoom so island fills view).
- `<MapControls enableDamping dampingFactor≈0.08 minZoom≈20 maxZoom≈120 maxPolarAngle≈Math.PI/2.4 target={[0,0,0]} />` from drei — pan, zoom, limited rotation, can't go under ground.
- Lights: `hemisphereLight` (sky/ground colors) + `directionalLight` casting shadows, `shadow-mapSize` 1024, tight shadow camera bounds (±12).
- **Sea**: large `circleGeometry` (radius ~40) rotated flat at y≈0, dark blue `meshStandardMaterial`. Receives pointer click → deselect (`onPointerMissed` on Canvas is even simpler for empty-area deselect — use `onPointerMissed`).
- **Island** (group): stacked cylinders with many radial segments —
  - rock base: cylinder r≈7.5/8.2, gray, y below waterline up to ~0.3
  - sand rim: cylinder r≈7.2, sand color, thin, above rock
  - grass top: cylinder r≈6.4, green, top surface at y≈0.9 (constant `GROUND_Y` exported for animal/trees to sit on). `receiveShadow`.
- **Trees**: hardcoded deterministic array of 12 entries `{ x, z, scale, rotY }` (all within radius ≲5.5). Each tree = brown cylinder trunk + green cone canopy, `castShadow`. Rendered via `.map()`. No randomness at render time.
- Renders `<PlaceholderAnimal ... />` passing selection props and the ground constants (`GROUND_Y`, `ISLAND_RADIUS` walkable ≈5.2).

### PlaceholderAnimal.tsx (`"use client"`)
- Meshes in a `<group ref>`: box body, sphere/box head, 4 small box legs, small box tail; distinct warm color (e.g. orange-brown). `castShadow`.
- Movement (all in refs, `useFrame((_, delta) => ...)`):
  - refs: `position` (Vector3-ish or plain {x,z}), `heading` (radians), `turnRate`/`headingTarget`.
  - Move forward `speed * delta` along heading. Wander: slowly drift heading toward a target heading that changes every few seconds (deterministic-ish timer accumulated from delta; using `Math.random()` inside the frame loop for new wander targets is fine — spec only forbids random *positions per render*).
  - Boundary: if next position's distance from center > walkable radius, steer heading toward island center (smoothly) instead of hard bounce.
  - Smooth rotation: lerp group rotation.y toward heading each frame (shortest-arc).
  - Apply to `groupRef.current.position/rotation` directly — no setState in the loop.
- Selection:
  - `onClick={(e) => { e.stopPropagation(); onSelect(); }}`, `onPointerOver/Out` → `document.body.style.cursor = "pointer"/""` (or a hovered ref + gl.domElement style).
  - When selected: `<mesh>` ring (`ringGeometry` or `torusGeometry`) lying flat under the animal inside the same group (follows automatically), plus slightly brighter/emissive body material color.
- Exposes current position for the UI: accept a `positionRef` (MutableRefObject) prop from BiodiversityPrototype that the frame loop writes into; the interval in the wrapper reads it. Simple, typed, no per-frame renders.
- React Compiler note: mutation-heavy ref code is standard R3F and generally fine under the compiler; if anything misbehaves at runtime, add `"use no memo"` to this component (documented escape hatch).

### layout.tsx
Update `metadata` to `title: "Biodiversity Island", description: "Day 1 prototype — interactive 3D biodiversity island"`. Keep fonts/body classes.

### Scope guards (from spec)
No GLB/images/APIs/DB/auth/Zustand/Yuka/physics/post-processing/weather/extra pages. TypeScript strict, no `any`, no ESLint disables, comments only where movement logic needs explanation.

## Steps

1. `@types/three` exists in node_modules only as a transitive dependency (not in package.json) — run `npm install -D @types/three` to pin it explicitly per the spec (only install; do NOT run `npm audit fix --force`).
2. Create the three components under `src/components/prototype/`.
3. Rewrite `src/app/page.tsx`; tweak `layout.tsx` metadata.
4. `npm run lint` (and `npx eslint src` if the bare script lints nothing) — fix everything.
5. `npm run build` — fix all TS/build errors.
6. Briefly start `npm run dev` in background, verify the page loads (use Chrome DevTools/Playwright MCP if available to check console for app errors and confirm the scene renders, animal moves, click selects), then stop the server.
7. `git diff` review — no unrelated changes.

## Verification / Done criteria

- Lint passes, build passes (paste outputs in report).
- Dev server starts; page shows sea + island + trees + moving animal from orthographic top-down camera; pan/zoom/limited-rotate work; clicking the animal shows ring + panel; empty-area click / Deselect button clears it; no app-originated console errors; no network requests for models/images.
- Final report per spec: deps added, files changed, working features, lint/build results, Day 1 limitations, suggested Day 2 step (likely: multiple animals + shared animal data model, or Zustand introduction).
