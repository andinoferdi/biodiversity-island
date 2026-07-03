# Dynamic Terrain & Geographic Biomes — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [dynamic-terrain-prompt.md](./dynamic-terrain-prompt.md), rencana implementasi di [dynamic-terrain-plan.md](./dynamic-terrain-plan.md). Fitur ini adalah **evolusi desain** dari Biome Terrain ([../biome-terrain/biome-terrain.md](../biome-terrain/biome-terrain.md)) di fase Hari 6–9 (Bioma & Spesies): pulau silinder prosedural dengan tiga sektor 120° diganti mesh 3D nyata (`terrain.glb`) yang punya bukit, tebing, dan sungai.

## Ringkasan

Pulau kini dirender penuh dari `terrain.glb` (2.3 MB, `public/assets/environment/terrain/`) — bukan lagi silinder matematis. Karena permukaannya bertopografi, posisi `Y` dan bioma tidak bisa lagi dihitung dari rumus 2D; keduanya sekarang berasal dari **Dynamic Raycasting**: setiap hewan menembakkan satu ray vertikal ke bawah setiap frame untuk menemukan ketinggian pijakan, kemiringan permukaan, dan apakah ia berdiri di air atau darat. Mesh terrain dibungkus `<Bvh>` dari drei agar raycasting puluhan hewan per frame tetap murah.

Sistem bioma disederhanakan dari tiga sektor sudut (`forest`/`grassland`/`shore`) menjadi dua bioma geografis berbasis ketinggian: **River** (`Y ≤ WATER_LEVEL`) dan **Land** (`Y > WATER_LEVEL`, gabungan Forest + Grassland lama). Navigasi hewan sekarang bergantung pada `locomotion` spesies: ikan (`aquatic`) terkunci di River, bebek (`amphibian`) bebas di mana saja, dan sisanya (`terrestrial`) terkunci di Land — batasnya bukan dinding keras, melainkan validasi target *wander* dan pantulan arah saat raycast mendeteksi air atau tebing curam di depan.

## Struktur File

```
src/components/prototype/
  terrain.ts                → BARU: sampleGround(x,z) raycast + shared Raycaster/Vector3,
                              setTerrainRoot/subscribeTerrain untuk overlay loading,
                              nearestWaterEdge(x,z) — grid tepi sungai dibangun sekali (lazy)
  biomes.ts                 → DIROMBAK: BiomeId "river" | "land"; biomeForHeight(y) menggantikan
                              biomeAt(x,z) sektor sudut; makeBiome/thetaStart/CENTER_RADIUS dihapus
  simulation.ts              → WATER_LEVEL, MIN_GROUND_NORMAL_Y baru; ResourceSpot kehilangan kind
                              "water" (kolam dihapus, sungai dari GLB); AnimalVitals + field biome
  EnvironmentModels.tsx      → BARU: TerrainGLB (useGLTF + <Bvh> + setTerrainRoot on mount/unmount)
  species.ts                 → biomeId diganti locomotion: "aquatic" | "amphibian" | "terrestrial";
                              ANIMAL_SPAWNS dipindah ke koordinat tervalidasi di heightmap terrain baru
  Animal.tsx                 → ROMBAK TOTAL: sampleGround per frame untuk Y dinamis, canOccupy() per
                              locomotion, deteksi tebing via normal.y, deteksi tepi peta via raycast
                              miss, wander tervalidasi terrain, seek air lewat nearestWaterEdge
  IslandScene.tsx             → <Island> silinder dihapus → <TerrainGLB>; overlay HTML loading dengan
                              thumbnail.jpg; posisi vegetasi & resource pakai Y hasil sampling offline
  BiodiversityPrototype.tsx  → baris "Biome" di panel baca vitals.biome (live per frame), bukan
                              getBiome(species.biomeId) statis
```

## Data & Konstanta

| Item | Nilai | Arti |
| --- | --- | --- |
| `WATER_LEVEL` (simulation.ts) | 0.36 | Permukaan sungai di terrain.glb ada di Y ≈ 0.345–0.358 (scale 3, lift 0.6); ambang batas River/Land |
| `MIN_GROUND_NORMAL_Y` | 0.6 | Segitiga dengan `normal.y` di bawah ini dianggap tebing/dinding tabrakan |
| `TERRAIN_SCALE` / `TERRAIN_Y` (terrain.ts) | 3 / 0.6 | Transform world yang dipakai `<TerrainGLB>`; semua koordinat vegetasi & spawn disampel offline dengan nilai ini |
| Locomotion | aquatic / amphibian / terrestrial | fish=aquatic (terkunci air), duck=amphibian (bebas), 4 spesies lain=terrestrial (terkunci darat) |
| Sumber daya | 5 petak makanan | 4 di Land (satu per kuadran) + 1 di River (untuk ikan); kolam air dihapus — minum langsung dari sungai GLB |
| `GRID_N` (terrain.ts) | 64×64 | Resolusi grid sekali-bangun untuk `nearestWaterEdge`; sel darat yang bertetangga sel air jadi titik tepi kandidat |
| `DRINK_RANGE` (Animal.tsx) | 0.6 | Jarak ke titik tepi sungai yang dianggap "sedang minum" untuk hewan darat |
| `WANDER_LOOKAHEAD` / `WANDER_TRIES` | 1.5 / 8 | Setiap target *wander* baru divalidasi dengan raycast look-ahead; dicoba ulang hingga 8 arah acak sebelum menyerah |
| `GROUND_SNAP_SPEED` | 12 | Kecepatan lerp Y visual menuju hasil raycast — meredam sambungan segitiga low-poly agar tidak "pop" |

Ambang lifecycle (`NEED_MAX`, `SEEK_THRESHOLD`, `DEATH_AFTER_CRITICAL`, dst.) dari Hari 3–5 **tidak berubah**.

## Keputusan Teknis

### Satu Raycaster/Vector3 dibagi lintas semua hewan, `firstHitOnly` diaktifkan
`terrain.ts` menyimpan instance `Raycaster` dan `Vector3` module-level yang dipakai ulang setiap panggilan `sampleGround`, bukan dialokasikan per hewan per frame — mencegah tekanan *garbage collector* saat belasan hewan raycast setiap frame. `raycaster.firstHitOnly = true` (properti khusus three-mesh-bvh, dipasang lewat cast karena bukan bagian tipe `Raycaster` bawaan) menghentikan pencarian begitu hit BVH pertama ditemukan, tidak menyisir seluruh mesh.

### `<Bvh firstHitOnly>` membungkus `<primitive>` terrain, bukan geometri mentah
`TerrainGLB` di `EnvironmentModels.tsx` memuat `terrain.glb` via `useGLTF`, lalu membungkus `<primitive>` dengan `<Bvh>` dari drei — ini menginstal accelerated raycast (three-mesh-bvh) pada seluruh mesh anak sekali saat mount. Tanpa ini, satu ray terhadap ~200rb vertex (`terrain.glb` punya 10 primitive besar) akan menyisir semua segitiga secara naif setiap frame per hewan.

### Registrasi terrain lewat modul singleton, bukan Context
`setTerrainRoot(scene)` dipanggil di `useEffect` `TerrainGLB` saat mount, `setTerrainRoot(null)` saat unmount. `Animal.tsx` tidak tahu soal React tree tempat `TerrainGLB` berada — ia hanya memanggil `sampleGround` langsung dari modul `terrain.ts`. Pendekatan ini dipilih karena raycasting terjadi di `useFrame` (di luar siklus render React) dan dijalankan oleh puluhan komponen `Animal` sekaligus; Context akan memaksa re-render tak perlu, sementara modul singleton adalah sumber kebenaran tunggal yang dibaca langsung.

### `nearestWaterEdge` dibangun sekali dari grid 64×64, bukan raycast baru tiap kali dicari
Sebelumnya (Biome Terrain) hewan darat haus mencari `ResourceSpot` kolam terdekat — deterministik dan statis. Sekarang sungai berasal dari mesh GLB tanpa titik data eksplisit, jadi `terrain.ts` menyampel grid 64×64 sekali (lazy, saat pertama dibutuhkan setelah terrain termuat) dan menandai sel darat yang bertetangga langsung dengan sel air sebagai kandidat tepi. Pencarian tepi terdekat lalu jadi pemindaian linear atas himpunan kandidat (~puluhan titik), bukan brute-force raycast baru. Grid di-invalidasi (`waterEdges = null`) setiap kali `setTerrainRoot` dipanggil ulang.

### Konvensi tabrakan: `stranded` tidak diblok, hanya sel berikutnya
`canOccupy(species, sample)` menentukan apakah suatu ketinggian/permukaan sah untuk locomotion spesies (tebing selalu terlarang; air terlarang untuk terrestrial; darat terlarang untuk aquatic; amphibian selalu boleh). Sel *saat ini* tidak pernah diblok — jika seekor hewan entah bagaimana berdiri di sel ilegal (mis. anak hasil reproduksi lahir dekat tepi sungai), ia diberi `headingTarget` menuju tepi air terdekat sebagai jalan keluar, dan pergerakan tetap diizinkan pada frame itu. Yang diblok adalah **sel berikutnya**: sebelum menerapkan `nextX/nextZ`, `sampleGround` dijalankan di titik tujuan; jika raycast meleset (tepi mesh), kemiringan terlalu curam, atau bioma terlarang untuk locomotion, gerakan dibatalkan dan `headingTarget` diputar balik alih-alih posisi diperbarui.

### Y visual di-lerp, bukan di-snap setiap frame
Ketinggian mentah dari raycast (`here.y`) langsung dipakai untuk validasi logika (bioma, tabrakan), tetapi posisi visual grup Three.js (`group.position.y`) di-*lerp* menuju nilai itu dengan `GROUND_SNAP_SPEED = 12`. Mesh low-poly terrain punya sambungan antar-segitiga yang tidak selalu mulus; lerp meredam lompatan Y yang terlihat "pop" saat hewan melintasi tepi segitiga, sambil tetap cukup responsif untuk mengikuti kontur naik-turun.

### Overlay loading pakai `useSyncExternalStore`, bukan state Suspense biasa
`TerrainLoadingOverlay` di `IslandScene.tsx` men-subscribe ke `subscribeTerrain`/`isTerrainReady` dari `terrain.ts` lewat `useSyncExternalStore` — ini di luar boundary `<Suspense>` yang membungkus `<TerrainGLB>`, sehingga overlay HTML (`thumbnail.jpg` sebagai background, progress dari `useProgress` drei) bisa tetap tampil di atas Canvas sampai `setTerrainRoot` benar-benar dipanggil, bukan hanya sampai komponen GLB selesai *mount*.

## Validasi

- `npm run lint` → lulus tanpa error/warning.
- `npm run build` → lulus (Turbopack compile + TypeScript bersih, static prerender `/`).
- Diverifikasi di browser (Playwright, dev server port 3000):
  - Terrain GLB termuat penuh dari top-down: bukit, tebing granit, sungai biru mengalir melintasi peta, tanpa 404.
  - 12 hewan (6 spesies) bergerak mengikuti kontur; tidak ada yang mengambang atau *clipping* menembus tebing/gunung selama pengamatan berkelanjutan.
  - Bebek dan ikan tetap dekat/di sungai; elephant, deer, dove, turtle tetap di daratan dan tidak menyeberang sungai kecuali saat mendekat untuk minum.
  - 0 error console dari kode aplikasi selama observasi (hanya warning `THREE.Clock` bawaan react-three-fiber, sudah dicatat sejak prototype.md).
  - Panel "Biome" menampilkan River/Land secara live sesuai posisi hewan terpilih saat ini.

## Batasan Langkah Ini & Langkah Berikutnya

Batasan: validasi koordinat spawn/vegetasi/resource terhadap heightmap dilakukan offline (skrip sampling triangle GLB), bukan dijamin lewat automated test; `nearestWaterEdge` memakai grid tetap 64×64 sehingga ada resolusi minimum pada titik tepi yang ditemukan; belum ada test otomatis untuk logika raycast/tabrakan; belum ada predator–mangsa atau krisis ekosistem.

Langkah berikutnya (lanjutan Hari 6–9): **hubungan predator–mangsa** dan **tiga krisis ekosistem** di atas fondasi terrain dinamis ini.
