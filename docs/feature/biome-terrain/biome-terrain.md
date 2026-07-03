# Biome Terrain — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [biome-terrain-prompt.md](./biome-terrain-prompt.md), rencana implementasi di [biome-terrain-plan.md](./biome-terrain-plan.md). Fitur ini adalah **langkah pertama fase Hari 6–9 (Bioma & Spesies)** pada roadmap, dibangun langsung di atas Population Lifecycle ([../population-lifecycle/population-lifecycle.md](../population-lifecycle/population-lifecycle.md)) yang menutup fase Hari 3–5.

## Ringkasan

Pulau kini terbagi menjadi **tiga bioma** — Forest (hutan), Grassland (padang rumput), dan Shore (pesisir) — sebagai tiga sektor 120° dari cakram pulau, masing-masing dengan wedge tanah berwarna berbeda yang jelas terlihat dari kamera top-down. Setiap spesies punya **bioma rumah** (grazer → grassland, hopper → shore, strider → forest): spawn dimulai di sana, seek memprioritaskan sumber daya bioma sendiri, dan hewan yang berkeliaran keluar diarahkan kembali ke pusat bioma (batas habitat lunak, tanpa dinding).

Ini juga **validasi pertama pipeline GLB** yang disyaratkan BRD: vegetasi primitif (cone/cylinder) diganti model `tree.glb`, `rock.glb`, `log.glb` dari `public/assets/environment/` via drei `useGLTF` + `<Clone>` + preload, dibungkus `<Suspense>` sehingga halaman tidak pernah kosong. Tidak ada dependency baru; model hewan GLB adalah langkah berikutnya.

## Struktur File

```
src/components/prototype/
  biomes.ts                 → BARU: Biome { id, name, groundColor, thetaStart, thetaLength,
                              centerX, centerZ }, BIOMES (3 sektor 120°), biomeAt(x,z), getBiome(id)
  EnvironmentModels.tsx     → BARU: Tree/Rock/Log membungkus useGLTF + <Clone>, useGLTF.preload ×3,
                              koreksi scale/offset per model, castShadow via traverse sekali
  simulation.ts             → ResourceSpot + biomeId; layout baru 2 kolam + 3 petak makanan per-bioma
  species.ts                → Species + biomeId; ANIMAL_SPAWNS pindah ke bioma rumah masing-masing
  Animal.tsx                → nearestForBiome (seek bioma sendiri, fallback global);
                              steer Roaming ke pusat bioma rumah saat di luar
  IslandScene.tsx           → tiga wedge tanah (circleGeometry thetaStart/thetaLength), tabel
                              vegetasi deterministik per bioma, <Suspense> untuk vegetasi GLB
  BiodiversityPrototype.tsx → baris "Biome" di panel; subtitle "Biome Terrain"
```

## Data & Konstanta

| Item | Nilai | Arti |
| --- | --- | --- |
| Sektor bioma | 120° × 3 | Forest θ 0–120°, Grassland 120–240°, Shore 240–360° |
| `CENTER_RADIUS` (biomes.ts) | 3.2 | Jarak titik pusat bioma dari pusat pulau (target steer pulang) |
| `BIOME_RADIUS` (IslandScene) | 6.4 | Radius wedge tanah, sama dengan silinder rumput |
| Sumber daya | 2 kolam + 3 petak | `pond-shore` (shore, besar), `pond-meadow` (grassland, di batas hutan), `food-forest`, `food-grass`, `food-shore` |
| `TREE_SCALE` / `TREE_LIFT` | 1.5 / 1.875 | Origin tree.glb ada ~1.25 di atas alasnya, jadi diangkat 1.25 × scale |
| `ROCK_SCALE` / `LOG_SCALE` | 1.1 / 0.45 | rock.glb ~0.6 unit (node scale ×100), log.glb ~3.5 unit (×199) |
| Vegetasi | 24 objek | Forest: 9 tree + 2 log; Grassland: 3 tree + 3 rock; Shore: 4 rock + 3 log |

Semua ambang dan konstanta lifecycle Hari 3–5 **tidak berubah**.

## Keputusan Teknis

### Konvensi sudut: `atan2(-z, x)` — cocok dengan `circleGeometry`
Wedge tanah memakai `circleGeometry` dengan `thetaStart`/`thetaLength` dan dirotasi `[-PI/2, 0, 0]`, yang memetakan sudut geometri `a` ke arah dunia `(cos a, 0, -sin a)`. `biomeAt(x, z)` memakai konvensi yang sama (`atan2(-z, x)` dinormalisasi ke [0, 2π), lalu indeks sektor `floor(angle / 120°)`) sehingga logika simulasi dan visual dijamin sinkron — O(1), tanpa query geometri.

### Dua kolam tidak bisa melayani tiga bioma — fallback global adalah desainnya
Spesifikasi meminta total 2 kolam + 3 petak makanan, tetapi 3 bioma × (1 air + 1 makanan) butuh 6 titik. Resolusi: `pond-meadow` diletakkan tepat di batas hutan–padang rumput dengan `biomeId: "grassland"`; strider hutan mencapainya lewat **fallback global** di `nearestForBiome` (seek memilih titik terdekat di bioma sendiri; jika bioma tidak punya jenis itu, jatuh ke terdekat global). Setiap bioma tetap punya petak makanannya sendiri. Perilaku teramati benar: strider minum di kolam batas lalu kembali ke hutan.

### Batas habitat lunak lewat steer, bukan clamp
Saat `Roaming` dan `biomeAt(x,z) ≠ bioma rumah`, `headingTarget` diarahkan ke `centerX/centerZ` bioma rumah — mekanisme yang sama dengan steer pantai yang sudah ada (yang tetap berjalan setelahnya dan menang di tepi pulau). Seek/konsumsi tidak disentuh; satu-satunya batas keras tetap `WALK_RADIUS`. Hewan boleh melintas bioma lain (mis. menuju kolam fallback) tanpa terjebak.

### Pipeline GLB: `useGLTF` + `<Clone>` + preload, koreksi ditentukan dari data
Ketiga model dimuat sekali per URL (cache useGLTF) dan dirender per instance dengan drei `<Clone>` (berbagi geometry/material). Koreksi per model ditentukan dengan membaca bounding box POSITION dari chunk JSON GLB lalu diverifikasi di browser: origin tree ~1.25 di atas alas (perlu lift), rock dan log sudah duduk di origin tetapi membawa node scale ×100/×199 sehingga butuh scale kompensasi. `castShadow` diaktifkan sekali via `scene.traverse` di `EnvironmentModels.tsx` (ter-copy oleh Clone), bukan per call site.

### `<Suspense>` hanya membungkus vegetasi
Pulau, laut, sumber daya, dan hewan dirender langsung; hanya `<Vegetation />` yang suspend saat GLB streaming. Digabung `useGLTF.preload` dan halaman loading dari `dynamic ssr:false` yang sudah ada, halaman tidak pernah kosong tanpa feedback (NFR-003).

### `ResourceSpot.biomeId` eksplisit, bukan diturunkan dari posisi
`biomeAt` pada titik yang tepat di batas sektor rawan float; `biomeId` eksplisit pada data membuat kepemilikan deterministik dan seek tidak ambigu.

## Validasi

- `npm run lint` → lulus tanpa error/warning.
- `npm run build` → lulus (compile + TypeScript bersih).
- Diverifikasi di browser (Playwright, dev server yang sudah berjalan di port 3000):
  - Tiga bioma jelas berbeda dari top-down (hijau gelap / hijau terang / pasir); komposisi vegetasi berbeda per bioma.
  - Ketiga GLB dimuat `200 OK` dari `public/assets/environment/` (tanpa 404), skala dan orientasi benar, duduk di tanah, bayangan bekerja.
  - Panel menampilkan baris "Biome" (mis. Grassland untuk grazer); subtitle header "Biome Terrain".
  - Siklus kebutuhan penuh teramati di 4× (thirst 45 → 23 setelah minum); kelahiran berjalan (sensus 8 → 16 → 24, berhenti tepat di cap); spesies mengelompok di bioma rumahnya; Pause membekukan simulasi; seleksi/deselect bekerja.
  - 0 error console dari kode aplikasi; 0 request eksternal.
- Warning `THREE.Clock: This module has been deprecated` tetap dari internal react-three-fiber — abaikan (lihat prototype.md).

## Batasan Langkah Ini & Langkah Berikutnya

Batasan: hewan masih mesh primitif (3 spesies placeholder); pulau tetap prosedural (`terrain.glb` tidak dipakai agar matematika jalan/bioma tetap trivial); batas bioma adalah garis lurus sektor (tanpa transisi/blending); bioma hutan tidak punya kolam sendiri (memakai kolam batas via fallback — by design); vegetasi 24 objek tanpa InstancedMesh (optimasi Hari 13+); belum ada predator–mangsa atau krisis.

Langkah berikutnya (lanjutan Hari 6–9): mengganti 3 spesies placeholder dengan **6 spesies GLB** dari `public/assets/animal/` (deer, dove, duck, elephant, fish, turtle — hanya deer yang punya animasi), lalu **predator–mangsa** dan **tiga krisis ekosistem**.
