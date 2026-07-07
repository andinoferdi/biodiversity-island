# Remaster Kontribusi Wahyu — Visual Environment, Kontrol Hewan, dan AI

Dokumentasi untuk programmer berikutnya. Rencana implementasi ada di [../remaster/2026-07-06-remastered-wahyu.md](../remaster/2026-07-06-remastered-wahyu.md). Fitur ini merombak seluruh efek atmosfer (matahari, langit, fog, awan, hujan, angin), merapikan kontrol hewan (keyboard, lompat, kamera POV, obstacle avoidance), dan memperbaiki dua bug kolaps populasi.

## Ringkasan

Seluruh efek atmosfer dipindah dari `IslandScene.tsx` (608 baris, 33 masalah lint) ke folder baru `src/components/prototype/effects/` dengan `weather.ts` sebagai sumber konfigurasi tunggal. Awan, hujan, dan goyangan pohon kini membaca arah `WIND` yang sama sehingga bergerak searah. Semua transisi cuaca menggunakan easing 2.5 detik (`useEasedBlend`) — tidak ada lagi perubahan instan. Arah visualnya stylized low-poly yang kohesif: awan icosahedron faceted flat-shading, streak hujan lembut, pencahayaan hangat. Lint seluruh repository turun dari 42 masalah menjadi **0 error 0 warning**.

## Struktur Folder `effects/`

```
src/components/prototype/effects/
  weather.ts   → WIND, PALETTE, RAIN_TIERS, WEATHER_FADE_SECONDS,
                 seededRandom (mulberry32), useEasedBlend
  Sky.tsx      → matahari orbit + warna dinamis, hemisphere/fill light,
                 background & fog scene (menggantikan DynamicSun + lampu inline)
  FogLayer.tsx → fog banks world-space untuk POV/overview, default On,
                 tetap aktif di Low graphics
  Clouds.tsx   → 8 awan low-poly deterministik (4–6 lobus icosahedron), drift
                 searah WIND dengan wrap 34×34, bayangan decal radial-gradient
                 (menggantikan RealisticClouds)
  Rain.tsx     → streak hujan instanced 0.02×0.55 miring searah WIND, splash
                 ring, jumlah tetes aktif = floor(maxDrops × blend)
                 (menggantikan RealisticRainSystem)
```

`IslandScene.tsx` kini hanya komposisi: `CustomMapControls`, `Vegetation`, `Resource`, `Sea`, `TerrainLoadingOverlay`, tipe `GraphicQuality`, dan `IslandScene`.

## Konstanta `weather.ts`

| Item | Nilai | Arti |
| --- | --- | --- |
| `WIND` | `{ x: -0.55, z: 0.18, speed: 0.45 }` | Arah + kecepatan angin bersama untuk drift awan, kemiringan/dorongan hujan, dan bias sway pohon |
| `WEATHER_FADE_SECONDS` | 2.5 | Durasi easing semua transisi cuaca (langit, fog, cahaya, awan, kepadatan hujan) |
| `PALETTE` | 13 warna | Langit/fog/matahari/hemisphere/awan/fill untuk kondisi clear dan rain |
| `RAIN_TIERS` | low 150/0, medium 300/60, high 500/100 | Jumlah drops/splashes per tier `GraphicQuality`; Low tanpa splash |
| `seededRandom(seed)` | mulberry32 | Penempatan awan & layout deterministik antar reload (aturan repo: tanpa `Math.random()` di useMemo/render) |
| `useEasedBlend(target)` | ref 0..1 | Blend yang mengejar target boolean dengan kecepatan konstan; dibaca per frame tanpa re-render |

## Keputusan Teknis

### Satu sumber `WIND` untuk awan, hujan, dan pohon
Awan drift `WIND.x/z × speed`, streak hujan miring `-WIND.x × 0.35` dan terdorong `WIND × 1.6`/detik, kanopi pohon (tree.glb dan spruce GLB via shader) diberi bias `WIND × 0.015`. Semua efek bergerak dalam satu arah sehingga cuaca terasa koheren.

### Eased blend, bukan perubahan instan
`useEasedBlend` menyimpan blend 0..1 di ref dan mengejarnya di `useFrame`. `Sky` me-lerp warna langit/fog/matahari, `Clouds` me-lerp `material.color` dan menurunkan altitude (`RAIN_SINK`), `Rain` menskalakan jumlah tetes aktif — hujan datang dan pergi bertahap ~2.5 detik. Komponen `Rain` tetap terpasang saat cerah dan hanya melewati kerja frame ketika `blend ≤ 0.01` (menggantikan `if (!isRaining) return null` yang instan).

### Cloud Toggle Fade Follow-Up
Clouds On/Off kini mengikuti pola arsitektur yang sama dengan Rain On/Off: komponen tetap mounted dan menerima target boolean. `Clouds.tsx` memakai `cloudBlend = useEasedBlend(isCloudy)` khusus untuk presence awan, terpisah dari `rainBlend` untuk warna storm dan altitude hujan. Saat Clouds Off, opacity awan dan bayangan memudar sambil lobus awan sedikit mengecil dan terangkat; saat Clouds On, gerakan itu dibalik tanpa reset posisi wind-drift.

### Fog Toggle dan FogLayer POV Follow-Up
Fog kini punya toggle sendiri, default On, dan tidak ikut dimatikan oleh tier Low. `Sky.tsx` tetap memasang scene-level `<fog attach="fog">`, tetapi range fog dikontrol oleh `fogBlend = useEasedBlend(isFoggy)` sehingga Fog Off hanya mendorong `near/far` jauh keluar area pandang, bukan unmount mendadak. Scene fog sengaja dibuat sebagai distant atmosphere yang halus agar tidak memutihkan seluruh overview; kabut utama yang harus terasa di overview dan POV dipindahkan ke `FogLayer.tsx`. Bug kabut hilang saat Enter POV terjadi karena Three.js scene fog berbasis jarak kamera: kamera POV dekat permukaan membuat objek sekitar berada sebelum `FOG_NEAR`. Untuk itu `FogLayer.tsx` menambahkan fog banks tipis dan billboard haze rendah di world-space yang tetap terlihat dari kamera orthographic maupun PerspectiveCamera, tetap deterministik, dan tetap aktif di Low graphics.

### Seeded RNG di render, `Math.random()` hanya di frame loop
Layout awan dibangun dengan `seededRandom(20260706)` di `useMemo`. Respawn tetes hujan memakai `Math.random()` tetapi hanya di dalam `useFrame` — React Compiler (`react-hooks/purity`) menolak `Math.random()` saat render, sehingga inisialisasi malas array tetes juga dipindah ke dalam frame loop.

### Pola yang dituntut React Compiler (penting untuk kontributor berikutnya)
- Mutasi hasil `useMemo` dilarang (`react-hooks/immutability`) → data per-frame di `useRef` atau objek module-level (`TERRAIN_TIME` di EnvironmentModels).
- `useMemo(fn, [])` dengan referensi fungsi ditolak (`react-hooks/use-memo`) → wajib arrow inline `useMemo(() => fn(), [])`.
- `setState` sinkron dalam `useEffect` ditolak → `CustomMapControls` kini memeriksa `camera.type` langsung saat render.
- `scene.background`/`scene.fog` tidak boleh dimutasi via `useThree` saat render → `Sky` memakai elemen deklaratif `<color attach>`/`<fog attach>` dan menganimasikan lewat ref.

### Bug kolaps populasi #1: avoidance menolak air (Task 1)
Ring avoidance 8 arah menganggap sel air sebagai penghalang, sehingga hewan darat yang haus tertahan ~0.8–1.0 unit dari tepi sungai — di luar `DRINK_RANGE` 0.6 — lalu mati dehidrasi. Hawk (aerial) tidak pernah lolos cek `atWater` karena targetnya sel darat di tepi sungai. Perbaikan: air diabaikan pada soft avoidance hanya saat status `Seeking water` (gerbang keras `canOccupy` tetap), dan `drinksAtBank = terrestrial || aerial`. Terverifikasi: populasi 13 → cap 24 dan bertahan 5 menit pada 4×.

### Bug kolaps populasi #2: delta raksasa setelah hidden-tab (Task 7)
Saat tab kehilangan fokus, frame loop berhenti total. Frame pertama setelah refocus melaporkan seluruh jeda sebagai satu `delta` — tanpa clamp, satu frame itu memaku semua kebutuhan di max **dan** mendorong `criticalTimer` melewati `DEATH_AFTER_CRITICAL` (20 detik) sekaligus → kepunahan massal saat tab kembali fokus. Inilah fenomena "0 animals setelah idle" yang sebelumnya dicurigai regresi. Perbaikan: `MAX_FRAME_DELTA = 0.1` di `useFrame` Animal (pola yang sama sudah dipakai `EnvironmentModels`).

### Kontrol, POV, dan avoidance (Task 7)
- `useKeyboardControls(active)`: hook internal `Animal.tsx`; ref keys di-reset saat deselect via snapshot lokal di cleanup (menghapus warning `exhaustive-deps` lama).
- `Species.povCamera?: { height, back, pitch }`: hawk mengisi `{1.2, 1.5, 0.6}`; spesies lain memakai `POV_DEFAULT {0.3, 0.6, 0.15}`.
- `PovCamera` mengejar offset target dengan `position.lerp` (damping 6) sehingga kamera POV halus. Keluar POV langsung kembali ke kamera ortografis — transisi antarproyeksi (ortho ↔ perspektif) tidak diinterpolasi karena matriks proyeksinya tidak bisa di-lerp secara visual masuk akal.
- `computeAvoidance(m, species, stranded)`: fungsi module-level dengan bobot bernama (`AVOID_GOAL_WEIGHT` 0.4, `AVOID_CLIFF_PUSH` 0.8, `AVOID_LOOKAHEAD` 1.0, slowdown 0.6 di atas ambang 1.0, turn boost 3.0). Logika dan angka identik dengan versi inline.

### `key={graphicQuality}` pada `<Rain>`
Panjang array tetes ditentukan `tier.drops` saat inisialisasi. Ganti kualitas mengubah tier, jadi `key` memaksa remount agar array dan `instancedMesh` dibuat ulang dengan ukuran benar. Reset hujan sesaat saat ganti kualitas dapat diterima.

### EnvironmentModels bertipe ketat (Task 6)
Semua `any` dihapus. Bedah terrain dipecah ke fungsi module-level bertipe: `enableShadows`, `collectSpruceCenters` (cluster mat9, radius 0.3, filter maxY > 0.1), `removeSpruceTrees` (canopy 0.38 / trunk 0.20 → y=-5), `scaleBridge` (pusat −0.155/−0.10/0.158, radius 0.28, 1.5×), `hookRiverWaves` (mat3/mat4), `hookSpruceSway` (mat9 + bias WIND). Semuanya dipanggil dari `useMemo` yang sama agar berjalan **sebelum** `<Bvh>` membangun bounds tree dari geometri termodifikasi; tiap langkah self-guard via `userData`. Tipe shader param: `THREE.WebGLProgramParametersWithUniforms`.

## Hasil Validasi

- **Lint:** 42 masalah (39 error, 3 warning) → **0**.
- **Build:** `next build` lulus di setiap task.
- **Visual (browser asli via CDP, tab aktif):** awan faceted drift searah angin dan berhenti saat Pause; Rain On/Off menggelapkan/mencerahkan langit, fog, cahaya, dan awan secara bertahap ±2.5 detik; streak hujan miring searah drift awan; tier Low tanpa splash dan tanpa bayangan; POV deer/WASD/lompat/Exit POV terverifikasi (screenshot diambil selama verifikasi Task 4–7).

### Sensus 10 menit @4× (browser Playwright headed, tab selalu visible)

| Menit | Populasi |
| --- | --- |
| 0 | 9 (turun dari 13 saat startup 1×) |
| 1–10 | 24 (cap) stabil, tidak pernah 0, tanpa osilasi |

**Kriteria "populasi tidak pernah 0" dan "tanpa osilasi ekstrem" LULUS. Kriteria "deer dan rabbit tidak punah permanen" GAGAL** — pada akhir sensus seluruh 24 individu adalah **hawk** (monokultur). Trajektori per spesies dari muatan segar (interval 30 detik real-time @4×):

| Waktu | Komposisi |
| --- | --- |
| 0s | deer 2, hawk 2, horse 2, duck 2, rabbit 2, fish 2, wolf 1 |
| 30s | hawk 8, horse 4, wolf 4 — deer/duck/rabbit/fish sudah punah |
| 60s | hawk 15, horse 8, wolf 1 |
| 90s | hawk 18, horse 6 — wolf punah (kehabisan mangsa) |
| 120–240s | hawk 20→23, horse 4→1 |
| 270s+ | hawk 24 (monokultur, stabil) |

Mekanismenya murni **balancing predator–mangsa** (bukan regresi remaster — logika gameplay tidak diubah kecuali dua perbaikan kolaps): 1 wolf + 2 hawk dengan speed multiplier Hunting 2.0× melahap semua mangsa dalam ±2 menit-simulasi, kill reward memicu reproduksi cepat predator, lalu wolf ikut punah saat mangsa habis; hawk (tanpa predator, `neverStops`, sightDistance 20) mengisi cap. Data ini menjadi masukan utama untuk rencana balancing/tiga krisis ekosistem berikutnya.

## Known Limitations & Langkah Berikutnya

- **Monokultur hawk:** kolaps populasi total sudah diperbaiki, tetapi keseimbangan predator–mangsa belum — semua mangsa punah dalam ±2 menit-simulasi dan hawk mengisi cap 24 (lihat tabel trajektori di atas). Kandidat perbaikan untuk rencana balancing: cooldown berburu, `HUNT_HUNGER_THRESHOLD` lebih tinggi, reproduksi predator tidak dipicu kill reward, atau hawk diberi tekanan kebutuhan lebih keras.
- Kamera ortho ↔ POV berpindah instan (bukan transisi animasi) — batasan proyeksi.
- Splash hujan hanya muncul di sel yang punya ground sample; tetes di luar pulau di-respawn ke area valid.
- Hawk memiliki `neverStops`, jadi status Eating/Drinking-nya tidak menghentikan gerak — sudah perilaku terkalibrasi, bukan bug.
- **Tiga krisis ekosistem** (milestone Hari 6–9 terakhir) belum ada — prasyaratnya (transisi cuaca halus + populasi stabil) kini terpenuhi; buat rencana terpisah.
- Day/night penuh (langit malam, bintang) dan instancing vegetasi ditunda ke fase polish/optimasi sesuai PRD.
