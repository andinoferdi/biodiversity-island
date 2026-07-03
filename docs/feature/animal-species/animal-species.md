# Animal Species (GLB) — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Fitur ini adalah **langkah kedua fase Hari 6–9 (Bioma & Spesies)** pada roadmap, dibangun langsung di atas Biome Terrain ([../biome-terrain/biome-terrain.md](../biome-terrain/biome-terrain.md)) yang memvalidasi pipeline GLB dengan model environment.

## Ringkasan

Tiga spesies placeholder (mesh primitif box/sphere/cone) diganti **enam spesies dengan model GLB** dari `public/assets/animal/`: **Deer** dan **Dove** (forest), **Elephant** (grassland), **Duck**, **Turtle**, dan **Fish** (shore). Deer adalah satu-satunya model skinned + beranimasi — klipnya mengikuti status simulasi (Walk saat bergerak, Eating saat makan/minum) dan kecepatan playback mengikuti `timeScale` (Pause membekukan pose, 4× mempercepat). Lima model lain statis.

Roster awal 12 individu (2 per spesies), masing-masing spawn di bioma rumah spesiesnya. Seluruh mekanika Hari 3–5 dan biome terrain (kebutuhan, mati, reproduksi, cap 24, sensus, seleksi, steer bioma rumah) tidak berubah — hanya representasi visual hewan yang diganti.

## Struktur File

```
src/components/prototype/
  AnimalModel.tsx           → BARU: router animated/static; AnimatedModel (SkeletonUtils.clone +
                              useAnimations, klip per status via statusRef, speed via
                              setEffectiveTimeScale) dan StaticModel (drei <Clone>);
                              useGLTF.preload untuk keenam model
  species.ts                → 6 spesies GLB menggantikan 3 placeholder; field baru modelUrl,
                              modelScale, modelYOffset, modelRotY, animated, selectionRadius;
                              field lama bodyColor/accentColor/scale dihapus; ANIMAL_SPAWNS = 12
  Animal.tsx                → mesh primitif diganti <AnimalModel> dalam <Suspense> per hewan;
                              statusRef ditulis tiap frame; ring seleksi memakai selectionRadius
  BiodiversityPrototype.tsx → subtitle "Animal Species"
```

## Data & Konstanta

Koreksi per model ditentukan dari bounding box GLB (dibaca dari chunk JSON) lalu diverifikasi di browser:

| Spesies | Bioma | File | `modelScale` | `modelYOffset` | Catatan sumber |
| --- | --- | --- | --- | --- | --- |
| Deer | forest | `deer.glb` (1.0 MB) | 0.33 | 0 | Skinned, armature ×100 rot −90°X; 13 klip animasi |
| Dove | forest | `dove.glb` (1.0 MB) | 0.3 | 0 | Unscaled, tinggi ~1.5, duduk di origin |
| Elephant | grassland | `elephant.glb` (64 KB) | 0.0135 | 1.26 | Origin di tengah badan (min y −93), tinggi ~187 |
| Duck | shore | `duck.glb` (26 KB) | 0.22 | 0.17 | Origin sedikit di atas alas (min y −0.77) |
| Turtle | shore | `turtle.glb` (100 KB) | 0.0015 | 0.11 | Sumber raksasa: bentang ~676 unit |
| Fish | shore | `fish.glb` (35 KB) | 0.012 | 0.15 | Origin di tengah (min y −12.3) |

`selectionRadius` per spesies (0.6–1.8) menskalakan ring seleksi kuning ke tapak model. Rate kebutuhan/kecepatan mengikuti pola lama (besar = lambat & hemat, kecil = cepat & boros).

## Keputusan Teknis

### Deer: `SkeletonUtils.clone` + `useAnimations`, bukan drei `<Clone>`
drei `<Clone>` tidak menduplikasi skinned mesh dengan benar (skeleton ter-share). Setiap instance deer meng-clone scene via `SkeletonUtils.clone` (di-import dari `three/examples/jsm/utils/SkeletonUtils.js` — `three` adalah dependency langsung; `three-stdlib` sengaja dihindari karena hanya dependency transitif drei) dan menjalankan mixer-nya sendiri lewat `useAnimations`.

### Klip animasi mengikuti status simulasi via ref, tanpa React state
`Animal.tsx` menulis `statusRef.current = m.status` tiap frame; `AnimatedModel` membacanya di `useFrame`-nya sendiri dan cross-fade 0.2 s antara "Walk" (bergerak) dan "Eating" (status Eating/Drinking). Kecepatan playback di-set per frame lewat `action.setEffectiveTimeScale(timeScale)` — method call, bukan assignment properti, karena React Compiler menolak mutasi properti pada nilai hasil hook (`mixer.timeScale = …` gagal lint `react-hooks/immutability`).

### Suspense per hewan
`<AnimalModel>` dibungkus `<Suspense fallback={null}>` di dalam group tiap `Animal`, sehingga hewan yang GLB-nya masih streaming tidak menahan frame loop hewan lain maupun simulasinya sendiri (group + handler klik tetap ter-mount). Keenam model juga di-`useGLTF.preload`.

### Highlight seleksi: ring saja, emissive dihapus
Material hasil `<Clone>` ter-share antar instance — mengubah emissive satu hewan akan menyorot semua hewan sespesiesnya. Feedback seleksi kini hanya ring kuning (di-scale `selectionRadius`); cursor pointer saat hover tetap ada.

### Distribusi bioma 2-2-… bukan 2-2-2
Forest: deer + dove; grassland: elephant (satu spesies — grazer besar); shore: duck + turtle + fish. Fish di-assign shore karena kolam besar ada di sana; ia berkeliaran seperti hewan darat lain (lihat batasan).

## Validasi

- `npm run lint` → lulus tanpa error/warning (setelah refactor `setEffectiveTimeScale` untuk React Compiler).
- `npm run build` → lulus (compile + TypeScript bersih).
- Diverifikasi di browser (Playwright, dev server port 3000):
  - Keenam GLB dimuat `200 OK`, tanpa 404; proporsi antar spesies masuk akal (gajah ≫ rusa ≫ bebek); semua duduk di tanah; bayangan bekerja; hewan menghadap arah geraknya.
  - Header "6 species · 12 animals"; sensus naik saat kelahiran (teramati sampai 23) — reproduksi bekerja lintas spesies baru (anak "Elephant #4" terseleksi dengan vitals live).
  - Deer beranimasi; pose berubah antara berjalan dan makan/minum di kolam hutan.
  - Spesies mengelompok di bioma rumahnya; panel menampilkan Biome/Habitat/Diet spesies baru; ring seleksi pas untuk gajah maupun spesies kecil; Pause/1×/4× dan deselect bekerja.
  - 0 error console dari kode aplikasi.
- Warning `THREE.Clock deprecated` tetap dari internal react-three-fiber — abaikan.

## Batasan Langkah Ini & Langkah Berikutnya

Batasan: hanya deer yang beranimasi — lima spesies lain meluncur tanpa animasi kaki/sayap (keterbatasan aset, dicatat sejak BRD); fish berkeliaran di darat pesisir seperti hewan lain (belum ada perilaku akuatik/terikat kolam); dove berjalan di tanah (tidak terbang); klip deer lain (Gallop, Death, Attack) belum dipakai; material ter-share sehingga tidak ada tinting per individu; belum ada predator–mangsa atau krisis.

Langkah berikutnya (lanjutan Hari 6–9): **hubungan predator–mangsa** dan **tiga krisis ekosistem**.
