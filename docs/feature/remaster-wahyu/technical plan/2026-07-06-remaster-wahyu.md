# Remaster Kontribusi Wahyu: Visual Environment, Kontrol Hewan, dan AI | Rencana Implementasi

## Status Pengerjaan (pembaruan terakhir: 2026-07-07, sesi eksekusi)

**Branch:** Gunakan `andino/feat/predator-prey`. Semua commit berada di atas base predator-prey `d963ab5`. Branch belum di-push dan commit belum di-squash. Lakukan squash menjadi satu commit final pada Task 8 setelah seluruh pekerjaan selesai dan user memberikan persetujuan.

**Keputusan proses yang mengikat:** Controller harus mengerjakan Task 4 sampai Task 8 secara linear, satu langkah pada satu waktu, tanpa subagent. Menjalankan subagent memboroskan token dan sering berhenti karena batas sesi. Gunakan rencana ini sebagai spesifikasi utama. Verifikasi setiap task dengan lint, build, dan pengujian browser melalui browser-harness pada Chrome asli.

| Task | Status | Commit | Catatan |
|---|---|---|---|
| 0. Verifikasi branch dan baseline | Selesai | Tidak ada | Baseline lint: 42 masalah, terdiri dari 39 error dan 3 warning. |
| 1. Analisis akar masalah dan perbaikan bug kolaps populasi | Selesai | `60fb1dc` | **Akar masalah:** Ring obstacle avoidance dengan 8 ray menganggap sel air sebagai penghalang. Hewan darat yang haus berhenti sekitar 0.8 sampai 1.0 unit dari tepi sungai, di luar `DRINK_RANGE` 0.6, lalu mati karena dehidrasi. Masalah kedua terdapat pada spesies aerial. Kondisi `atWater` mengharuskan hewan melayang di atas air, sedangkan target pencarian berada pada sel darat di tepi sungai. Akibatnya, hawk tidak pernah minum. **Perbaikan:** Abaikan air pada soft avoidance ring hanya saat status `Seeking water`. Jangan ubah gerbang keras `canOccupy`, sehingga hewan darat tetap tidak dapat masuk ke air. Gunakan `drinksAtBank = terrestrial \|\| aerial`. **Hasil verifikasi:** Populasi naik dari 13 menjadi batas maksimum 24 dan bertahan selama 5 menit pada kecepatan 4×. Sistem mencatat ribuan event konsumsi tanpa kepunahan. Instrumentasi `debugCensus.ts` sudah dihapus sepenuhnya. |
| 2. `effects/weather.ts` | Selesai | `832c040` | Menjadi sumber konfigurasi tunggal untuk `WIND`, `PALETTE`, `RAIN_TIERS`, `WEATHER_FADE_SECONDS`, `seededRandom`, dan `useEasedBlend`. Hasil lint: 0. |
| 3. `effects/Sky.tsx` dan integrasi ke IslandScene | Selesai | `4b92207` | Hapus `DynamicSun`, hemisphere light inline, dan fill light inline. Perubahan ini mengurangi 88 baris dari IslandScene dan menggantinya dengan `<Sky/>`. **Perubahan terhadap rencana awal:** Aturan `react-hooks/immutability` dari React Compiler melarang mutasi `scene.background` dan `scene.fog` melalui `useThree`. Gunakan elemen deklaratif `<color attach="background">` dan `<fog attach="fog">`, lalu animasikan keduanya melalui ref `bgRef` dan `fogRef`. Hasil lint `Sky.tsx`: 0. Verifikasi browser menunjukkan transisi gelap dan terang berlangsung bertahap sekitar 2.5 detik, sedangkan matahari tetap bergerak pada orbitnya. |
| 4. `effects/Clouds.tsx` dan integrasi | Selesai | (lihat git log) | `RealisticClouds` dihapus, diganti awan icosahedron faceted deterministik + bayangan decal. **Penyesuaian:** aturan `react-hooks/use-memo` menolak `useMemo(buildClouds, [])` — harus arrow inline `useMemo(() => buildClouds(), [])`. Verifikasi browser: drift searah WIND, Pause menghentikan drift, Rain On menggelapkan dan menurunkan awan bertahap. Lint turun 41 → 31. |
| 5. `effects/Rain.tsx` dan lint 0 pada IslandScene | Selesai | (lihat git log) | `RealisticRainSystem` dihapus. **Penyesuaian:** (1) lazy-init `Math.random()` di render melanggar `react-hooks/purity` — inisialisasi dipindah ke dalam `useFrame`; (2) `CustomMapControls` punya error lama `set-state-in-effect` — state+effect diganti pemeriksaan `camera.type` langsung saat render (MapControls dilepas saat kamera bukan ortho, perilaku setara). IslandScene + Rain kini 0 error 0 warning. Lint repo: 22 masalah tersisa (Animal.tsx, EnvironmentModels.tsx). Verifikasi browser: streak miring searah angin, fade in/out bertahap, Low tier tanpa splash. |
| 6. `EnvironmentModels.tsx`, tipe ketat, dan WIND | Selesai | (lihat git log) | Semua `any` dihapus, bedah terrain diekstrak ke fungsi bertipe (`enableShadows`, `collectSpruceCenters`, `removeSpruceTrees`, `scaleBridge`, `hookRiverWaves`, `hookSpruceSway`). **Penyesuaian:** uniform `uTime` dipindah ke objek module-level `TERRAIN_TIME` (bukan hasil `useMemo`) untuk lolos `react-hooks/immutability` sekaligus tetap dijalankan saat render sebelum BVH dibangun. Lint file: 0. Lint repo: 7 masalah tersisa (semua di Animal.tsx). |
| 7. `Animal.tsx`, kontrol, POV, dan avoidance | Selesai | `2a94880` | `useKeyboardControls`, `PovCamera` teredam berbasis `Species.povCamera` (hawk custom), `computeAvoidance` dengan bobot bernama, konstanta `JUMP_VELOCITY`/`GRAVITY`/`MANUAL_TURN_MULT`. **Lint repo: 0 error 0 warning (baseline 42 → 0 tercapai).** **Temuan penting:** akar masalah "0 animals setelah idle" (watch-item Task 8) teridentifikasi dan diperbaiki — tab hidden menghentikan frame loop; frame pertama setelah refocus membawa satu `delta` raksasa sehingga needs pinned di max DAN `criticalTimer` melewati 20 detik dalam satu frame → kepunahan massal saat refocus. Fix: clamp `MAX_FRAME_DELTA = 0.1` di useFrame Animal (pola sama dengan EnvironmentModels). Terverifikasi di browser: WASD maju, Space lompat terlihat, kamera POV damped, Exit POV kembali ke ortho dengan seleksi tetap. |
| 8. Validasi 10 menit, dokumentasi, dan squash | Menunggu persetujuan user | `b74cceb` (docs) | Sensus 10 menit @4× via Playwright headed (tab CDP asli selalu hidden karena user aktif di jendela lain): populasi 9 → 24 (cap) dan stabil sampai menit 10 — **tidak pernah 0, tanpa osilasi**. Namun komposisi akhir **monokultur hawk**: deer/rabbit/duck/fish punah dalam ±2 menit-simulasi (trajektori lengkap di dokumen handoff) — kriteria "deer & rabbit tidak punah permanen" GAGAL; ini isu balancing pre-existing, bukan regresi remaster. Handoff `docs/feature/remaster-wahyu/remaster-wahyu.md` ditulis, PRD diperbarui (kolaps fixed, remaster Implemented, predator–mangsa tetap In Progress). **Belum di-squash — menunggu pengujian manual dan persetujuan user.** |

**Lint saat ini:** 0 error dan 0 warning di seluruh repository (baseline 42 → 0).

**Watch-item "0 animals setelah idle": TERSELESAIKAN pada Task 7.** Akar masalahnya bukan predasi, melainkan delta raksasa pada frame pertama setelah tab kembali fokus (hidden-tab freeze). Sudah diperbaiki dengan clamp `MAX_FRAME_DELTA`. Validasi 10 menit pada Task 8 tetap menjaga tab aktif (Target.activateTarget) agar simulasi benar-benar berjalan selama pengukuran.

**Catatan progres lengkap:** `.superpowers/sdd/progress.md`.

---

**Tujuan:** Rombak seluruh kontribusi Wahyu pada visual environment, yaitu awan, hujan, matahari, langit, angin, ombak sungai, dan opsi kualitas. Rapikan juga kontrol hewan dan AI, yaitu keyboard, lompat, kamera POV, dan obstacle avoidance. Hasil akhir harus menggunakan kode bersih tanpa error lint, mempertahankan arah visual low-poly yang kohesif, serta mencakup analisis akar masalah dan perbaikan bug kolaps populasi total.

**Arsitektur:** Lakukan remaster langsung pada struktur yang ada. Pertahankan kontrak props dan komponen, lalu tulis ulang implementasinya. Pecah `IslandScene.tsx` yang berisi 608 baris dengan memindahkan seluruh efek atmosfer ke folder baru `src/components/prototype/effects/`. Gunakan `weather.ts` sebagai sumber konfigurasi tunggal untuk arah angin, palet warna, durasi transisi, dan tier kualitas agar awan, hujan, serta goyangan pohon bergerak dalam arah dan gaya visual yang konsisten. Terapkan easing selama 2.5 detik pada seluruh transisi cuaca dan hapus perubahan instan. Rapikan `Animal.tsx` dengan hook keyboard, konfigurasi POV per spesies, dan fungsi avoidance terpisah. Jangan ubah perilaku yang sudah dikalibrasi, kecuali perbaikan bug kolaps populasi yang harus dikerjakan paling awal berdasarkan instrumentasi nyata karena hasilnya menentukan validitas task berikutnya.

**Stack Teknologi:** Next.js 16 dengan App Router dan React Compiler, React 19, TypeScript, Three.js 0.185, @react-three/fiber v9, @react-three/drei v10, @react-three/postprocessing v3, Tailwind CSS v4, dan npm.

## Dasar Keputusan dari Klarifikasi User

- **Cakupan:** Kerjakan hanya kontribusi Wahyu pada visual environment, kontrol, dan AI. Jangan ubah model hawk, rabbit, horse, apple, atau terrain GLB. Jangan menambah model atau aset baru.
- **Arah visual:** Agent menetapkan gaya **stylized low-poly yang kohesif**. Awan faceted dengan flat shading, streak hujan yang lembut, dan pencahayaan hangat harus menyatu dengan pulau low-poly. Istilah "realistis" berarti perilaku visualnya masuk akal dan konsisten, bukan photorealistic.
- **Bug kolaps populasi:** Bug ini masuk dalam cakupan berdasarkan persetujuan eksplisit dari user. Bug sudah ada sejak periode implementasi AI Wahyu dan terkonfirmasi melalui pengujian A/B pada worktree sejak commit `9988494`. Jangan mengulang hipotesis yang sudah gugur, yaitu artefak WebGL context loss, bug `threatCount` yang sudah diperbaiki pada commit predator-prey, dan bobot goal-versus-avoidance pada potential field. Pengujian bobot dari 0.4 hingga 1.6 tidak memberi dampak. Lihat bagian Known Limitations pada `docs/feature/predator-prey/predator-prey.md`.
- **Branch:** lanjut di `andino/feat/predator-prey` (keputusan user), di atas commit predator-prey `d963ab5`.
- **Commit:** Buat commit untuk setiap task agar perubahan dapat direview secara internal. Setelah user menyelesaikan pengujian manual dan memberikan persetujuan, squash seluruh commit menjadi satu commit final. Ikuti pola sesi sebelumnya. Jangan lakukan push sebelum user memintanya.

## Batasan Global

- Stack tetap. Jangan tambah dependency, physics engine, atau state library baru.
- React state hanya untuk data yang memengaruhi UI. Semua data setiap frame di ref (aturan repo).
- Penempatan objek harus deterministik. Jangan gunakan `Math.random()` di dalam `useMemo` atau render. Gunakan `seededRandom` dari `weather.ts`. `Math.random()` hanya boleh berjalan di dalam frame loop sesuai aturan repository sejak prototype. Implementasi awan dan hujan saat ini melanggar aturan tersebut dan harus diperbaiki.
- Target lint setelah seluruh task selesai adalah **0 error dan 0 warning di seluruh repository**. Semua 39 error dan 3 warning pada baseline berada di file yang termasuk dalam cakupan rencana ini. Sekitar 33 masalah berada di `IslandScene.tsx`, 6 error dan 1 warning berada di `Animal.tsx`, sedangkan sisanya berada di `EnvironmentModels.tsx`.
- Pertahankan perilaku gameplay berikut tanpa perubahan: flocking, locomotion untuk aquatic, amphibian, dan terrestrial, predator-prey termasuk sense pass dan `killRewards`, hawk dengan `neverStops`, pengali kecepatan Fleeing 2.5× dan Hunting 2.0×, rentang zoom MapControls 54 sampai 360, serta pembatalan selection melalui `onPointerMissed`.
- Proyek belum memiliki pengujian otomatis. Verifikasi setiap perubahan dengan `rtk npm run lint`, `rtk npm run build`, dan observasi pada Chrome asli melalui skill browser-harness. Jangan gunakan Chrome DevTools MCP headless untuk verifikasi visual karena lingkungan tersebut tidak menyediakan WebGL. Untuk screenshot dengan zoom, gunakan `Page.captureScreenshot` dan `clip {x,y,width,height,scale}`. MapControls tidak menerima scroll-wheel sintetis. Tombol Pause bukan toggle, sehingga simulasi harus dilanjutkan dengan mengklik `1×` atau `4×`. Untuk interaksi tombol, gunakan klik DOM melalui `js('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Pause").click()')` karena metode ini lebih stabil.
- Semua perintah shell diawali `rtk` (aturan global user).
- `GraphicQuality` tetap diekspor dari `IslandScene.tsx` (diimpor `BiodiversityPrototype.tsx`). Jangan pindah.

## Strategi Git

- Branch `andino/feat/predator-prey` (sudah aktif, HEAD = `d963ab5`).
- Gunakan Conventional Commits untuk setiap task agar perubahan mudah direview. Setelah user memberikan persetujuan pada akhir Task 8, squash seluruh commit remaster menjadi satu dengan `git reset --soft d963ab5`, lalu buat satu commit final.

---

## Struktur File

**Buat:**
- `src/components/prototype/effects/weather.ts`. Menjadi sumber konfigurasi tunggal untuk `WIND`, palet warna langit, awan, dan cahaya, `WEATHER_FADE_SECONDS`, tier kualitas hujan, `seededRandom`, serta hook `useEasedBlend`.
- `src/components/prototype/effects/Sky.tsx`. Matahari yang mengorbit, hemisphere light, fill light, serta warna background dan fog dinamis. Transisi hujan mulus. Menggantikan `DynamicSun` dan lampu-lampu inline di `IslandScene`.
- `src/components/prototype/effects/Clouds.tsx`. Awan low-poly faceted yang deterministik dengan bayangan decal pada tanah. Menggantikan `RealisticClouds`.
- `src/components/prototype/effects/Rain.tsx`. Streak hujan dan splash ring yang mengikuti arah angin dengan fade masuk dan keluar. Menggantikan `RealisticRainSystem`.
- `src/components/prototype/debugCensus.ts`. **Sementara** (Task 1 saja, dihapus sebelum Task 1 selesai): instrumentasi investigasi kolaps populasi.
- `docs/feature/remaster-wahyu/remaster-wahyu.md`. Dokumen handoff (Task 8).

**Ubah:**
- `src/components/prototype/Animal.tsx`. Task 1 menangani perbaikan bug kolaps. Task 7 menangani remaster kontrol, POV, avoidance, dan lint.
- `src/components/prototype/IslandScene.tsx`. Task 3-5 (pakai komponen effects baru, hapus 3 komponen lama, jadi ramping dan lint-clean).
- `src/components/prototype/EnvironmentModels.tsx`. Task 6 (tipe benar tanpa `any`, ekstrak fungsi bedah terrain, sway pakai `WIND`).
- `src/components/prototype/species.ts`. Task 7 (field `povCamera` per spesies).
- `docs/project/prd.md`. Task 8.

**Hapus:** Tidak ada file yang dihapus secara permanen. Hapus komponen lama dari dalam `IslandScene.tsx`. Buat `debugCensus.ts` hanya untuk Task 1, lalu hapus file tersebut sebelum Task 1 selesai.

---

## Task 0: Verifikasi branch dan baseline

**File:** tidak ada perubahan. Hanya verifikasi.

**Langkah 1: Pastikan branch dan working tree**

Jalankan `rtk git status` dan `rtk git log --oneline -1`
Hasil yang diharapkan: `On branch andino/feat/predator-prey`, HEAD `d963ab5`, working tree bersih (file untracked yang boleh ada hanya rencana ini di `docs/feature/predator-prey/technical plan/`).

**Langkah 2: Catat baseline lint**

Jalankan `rtk npm run lint 2>&1 | tail -3`
Hasil yang diharapkan: `42 problems (39 errors, 3 warnings)`. Angka ini menjadi baseline yang harus turun menjadi 0 di akhir rencana.

---

## Task 1: Analisis Akar Masalah dan Perbaikan Bug Kolaps Populasi Berbasis Instrumentasi

**File:**
- Buat sementara: `src/components/prototype/debugCensus.ts`
- Ubah: `src/components/prototype/Animal.tsx`. Integrasikan instrumentasi, terapkan perbaikan, lalu cabut seluruh instrumentasi sebelum task selesai.

**Kontrak Teknis:**
- Input: Ref `motion` dan `useFrame` yang sudah ada di `Animal.tsx`, dev server milik user pada port 3000, serta skill browser-harness.
- Output: Ekosistem tidak boleh punah total selama pengujian cepat 5 menit real-time pada kecepatan 4×. Task 8 akan menjalankan validasi penuh selama 10 menit. Dokumentasikan akar masalah secara tertulis untuk dokumen handoff.

**Konteks:** Seluruh hewan, termasuk horse yang tidak diburu, mati dalam sekitar 1 sampai 3 menit. Durasi tersebut sesuai dengan skenario ketika hewan tidak pernah berhasil makan atau minum. Pada deer, kebutuhan naik dari sekitar 55 menjadi 100 dalam kurang lebih 32 detik, lalu kematian terjadi setelah `DEATH_AFTER_CRITICAL` selama 20 detik. Gunakan data untuk menentukan salah satu mekanisme berikut. Hewan berhenti pada status `Seeking food/water` dan tidak pernah mencapai target. Hewan mencapai target tetapi kondisi konsumsi tidak pernah terpenuhi. Status konsumsi terus terpotong oleh cabang lain sehingga kebutuhan bersih tetap naik.

**Langkah 1: Buat instrumentasi sementara**

Buat `src/components/prototype/debugCensus.ts`:

```ts
// TEMPORARY instrumentation for the population-collapse investigation.
// Deleted at the end of this task - do not ship.
export interface CensusRow {
  t: number; // real seconds since page load
  id: string;
  status: string;
  hunger: number;
  thirst: number;
  x: number;
  z: number;
  note?: string;
}

const rows: CensusRow[] = [];

export function censusRecord(row: Omit<CensusRow, "t">) {
  rows.push({ t: Math.round(performance.now() / 100) / 10, ...row });
  if (rows.length > 30000) rows.splice(0, 15000);
  (window as unknown as { __census: CensusRow[] }).__census = rows;
}
```

**Langkah 2: Integrasikan ke Animal.tsx**

Di `Animal.tsx`, import `censusRecord` dan tambahkan `lastCensus: 0` ke objek ref `motion`. Di dalam `useFrame`, tepat setelah baris pertama pada blok `if (dt > 0) {`, tambahkan kode berikut:

```ts
      // TEMP census (Task 1 investigation only)
      m.lastCensus += dt;
      if (m.lastCensus >= 2) {
        m.lastCensus = 0;
        censusRecord({
          id: spawn.id,
          status: m.status,
          hunger: Math.round(m.hunger),
          thirst: Math.round(m.thirst),
          x: Math.round(m.x * 10) / 10,
          z: Math.round(m.z * 10) / 10,
        });
      }
```

Tepat sebelum `onDeath(spawn.id)` pada cabang kematian akibat kebutuhan, bukan cabang kill oleh predator, tambahkan kode berikut:

```ts
        censusRecord({
          id: spawn.id, status: m.status,
          hunger: Math.round(m.hunger), thirst: Math.round(m.thirst),
          x: Math.round(m.x * 10) / 10, z: Math.round(m.z * 10) / 10,
          note: "DEAD-NEEDS",
        });
```

**Langkah 3: Kumpulkan data**

Buka halaman pada Chrome asli menggunakan dev server user di port 3000. Muat ulang halaman, atur kecepatan ke 4× melalui klik DOM, jalankan simulasi selama sekitar 3 menit hingga populasi turun tajam, lalu ambil data berikut:

```bash
browser-harness -c "
open(r'<SCRATCHPAD>\census.json','w').write(js('JSON.stringify(window.__census)'))
print(js('(window.__census||[]).length'))
"
```

**Langkah 4: Analisis pola kematian**

Untuk setiap event `DEAD-NEEDS`, telusuri seluruh baris milik ID tersebut dan analisis 60 detik terakhir. Catat urutan statusnya. Periksa apakah hunger atau thirst pernah turun sebagai bukti konsumsi berhasil. Hitung jarak Euclidean dari posisi terakhir ke food spot darat terdekat pada koordinat (3.0, 0), (4.6, 2.2), (-4.8, -2.4), (-1.6, 4.2), dan (1.8, -3.4), serta ke food spot sungai pada (-0.5, 0.5). Periksa perubahan posisi antarsampel untuk menentukan apakah hewan bergerak normal atau berhenti. Tulis hasilnya dalam tabel laporan task. Identifikasi mekanisme akar masalah secara spesifik dari pola tersebut. Uji kandidat berikut terhadap data, jangan menganggapnya benar tanpa bukti. Kondisi konsumsi `atFood && ... && m.status === "Eating"` mungkin bergantung pada status yang baru ditetapkan oleh cabang seeking pada frame sebelumnya, lalu tertimpa cabang dengan prioritas lebih tinggi seperti Fleeing, Hunting, atau `eatPreyTimer`. `m.avoidanceTimer` mungkin menahan pembaruan `headingTarget` menuju target. Steering boundary atau obstacle mungkin membelokkan hewan menjauh dari food spot. Food spot mungkin terlalu dekat dengan vegetasi sehingga potential field mendorong hewan keluar dari radius konsumsi `CONSUME_MARGIN`.

**Langkah 5: Terapkan perbaikan minimal berbasis bukti**

Perbaikan harus langsung menangani mekanisme yang terbukti pada Langkah 4 dan harus sekecil mungkin. Gunakan konstanta bernama untuk setiap angka baru. Jangan mengubah flocking, predator-prey, atau locomotion. Tulis 2 sampai 3 kalimat yang menjelaskan mekanisme masalah dan perbaikannya untuk dokumen handoff pada Task 8.

**Langkah 6: Verifikasi perbaikan dengan data yang sama**

Ulangi Langkah 3 selama 5 menit real-time pada kecepatan 4×. Kriteria lulus terdiri dari tiga syarat. Data census harus menunjukkan setidaknya satu penurunan hunger atau thirst sebagai bukti konsumsi berhasil. Populasi harus tetap di atas 0 pada akhir pengujian. Kematian individu boleh terjadi, tetapi kepunahan total tidak boleh terjadi.

**Langkah 7: Cabut instrumentasi**

Hapus `debugCensus.ts`, import terkait, field `lastCensus`, dan kedua blok `censusRecord` dari `Animal.tsx`. Jalankan `rtk npm run lint`. Task ini tidak boleh menambah error baru. Enam error `prefer-const` dan satu warning lama di `Animal.tsx` masih boleh tersisa karena Task 7 akan menanganinya.

**Langkah 8: Commit**

```bash
git add src/components/prototype/Animal.tsx
git commit -m "fix: <mekanisme root-cause singkat> so animals actually reach and consume food/water"
```

---

## Task 2: `effects/weather.ts` sebagai Sumber Konfigurasi Cuaca

**File:**
- Buat: `src/components/prototype/effects/weather.ts`

**Kontrak Teknis:**
- Input: tidak ada.
- Output untuk Task 3 sampai Task 6: `WIND: { x: number; z: number; speed: number }`, `WEATHER_FADE_SECONDS: number`, `PALETTE` (semua warna langit/fog/matahari/awan/hemisphere untuk clear dan rain), `RAIN_TIERS: { low/medium/high: { drops: number; splashes: number } }`, `seededRandom(seed: number): () => number`, `useEasedBlend(target: boolean, seconds?: number): { current: number }`.

**Langkah 1: Tulis isi file secara lengkap**

```ts
"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";

// Konfigurasi ini menyatukan drift awan, kemiringan hujan, dan
// bias sway pohon melalui nilai WIND yang sama. Semua efek harus
// bergerak searah agar perilakunya konsisten.
export const WIND = { x: -0.55, z: 0.18, speed: 0.45 };

// Semua transisi cuaca (warna langit, intensitas cahaya, kepadatan hujan,
// warna awan) menggunakan easing selama durasi ini tanpa perubahan instan.
export const WEATHER_FADE_SECONDS = 2.5;

export const PALETTE = {
  skyClear: "#7eb2e6",
  skyRain: "#55616e",
  fogClear: "#9cc3e8",
  fogRain: "#5f6b77",
  sunWarm: "#ffe3b3",    // saat matahari rendah di orbitnya
  sunNeutral: "#fff6e8", // saat matahari "tinggi"
  sunRain: "#9fb2c4",
  hemiSkyClear: "#bfd9ff",
  hemiSkyRain: "#7a8c9e",
  hemiGround: "#3f5a36",
  cloudClear: "#f5f8fb",
  cloudRain: "#8b98a6",
  fillLight: "#a8c4e0",
} as const;

// Kepadatan partikel hujan per tier kualitas (Low melewatkan splash).
export const RAIN_TIERS = {
  low: { drops: 150, splashes: 0 },
  medium: { drops: 300, splashes: 60 },
  high: { drops: 500, splashes: 100 },
} as const;

// Mulberry32: penempatan awan deterministik antar reload (aturan repo -
// tidak ada Math.random() di useMemo/render).
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Blend 0..1 yang mengejar target boolean dengan kecepatan konstan.
// Ref, bukan state: dibaca tiap frame oleh komponen efek tanpa re-render.
export function useEasedBlend(
  target: boolean,
  seconds: number = WEATHER_FADE_SECONDS,
) {
  const blend = useRef(target ? 1 : 0);
  useFrame((_, delta) => {
    const goal = target ? 1 : 0;
    const step = delta / seconds;
    if (blend.current < goal) blend.current = Math.min(goal, blend.current + step);
    else if (blend.current > goal) blend.current = Math.max(goal, blend.current - step);
  });
  return blend;
}
```

**Langkah 2: Verifikasi lint dan kompilasi**

Jalankan `rtk npm run lint`
Hasil yang diharapkan: File baru tidak menambah error. Masalah pada baseline lama boleh tetap ada.

**Langkah 3: Commit**

```bash
git add src/components/prototype/effects/weather.ts
git commit -m "feat(effects): add shared weather constants, seeded RNG, and eased blend hook"
```

---

## Task 3: `effects/Sky.tsx` untuk Matahari, Pencahayaan, Langit, dan Fog Dinamis

**File:**
- Buat: `src/components/prototype/effects/Sky.tsx`
- Ubah: `src/components/prototype/IslandScene.tsx` (ganti `DynamicSun`, hemisphere light inline, dan fill light inline dengan `<Sky>`. Hapus fungsi `DynamicSun`)

**Kontrak Teknis:**
- Input: `PALETTE`, `useEasedBlend` dari `./weather`. `TERRAIN_Y` dari `../terrain`. Tipe `GraphicQuality` dari `../IslandScene`. `TimeScale` dari `../simulation`.
- Output: ekspor default `Sky({ graphicQuality, timeScale, isRaining })`. Komponen tunggal berisi directional sun dengan orbit dan warna dinamis, hemisphere light, fill light, serta pembaruan `scene.background` dan `scene.fog` per frame.

**Langkah 1: Tulis Sky.tsx lengkap**

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { TERRAIN_Y } from "../terrain";
import type { TimeScale } from "../simulation";
import type { GraphicQuality } from "../IslandScene";
import { PALETTE, useEasedBlend } from "./weather";

const SUN_ORBIT_RADIUS = 15;
const SUN_ELEVATION_DEG = 30;
const SUN_ORBIT_SPEED = 0.04; // rad per detik-simulasi
const FOG_NEAR = 26;
const FOG_FAR = 72;

interface SkyProps {
  graphicQuality: GraphicQuality;
  timeScale: TimeScale;
  isRaining: boolean;
}

// Komponen ini mengelola seluruh pencahayaan dan warna atmosfer. Nilai yang
// bergantung cuaca di-lerp lewat rainBlend sehingga hujan datang dan pergi
// secara bertahap, tidak pernah berganti instan.
export default function Sky({ graphicQuality, timeScale, isRaining }: SkyProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const fillRef = useRef<THREE.DirectionalLight>(null);
  const angle = useRef(0);
  const rainBlend = useEasedBlend(isRaining);
  const scene = useThree((s) => s.scene);

  const colors = useMemo(
    () => ({
      skyClear: new THREE.Color(PALETTE.skyClear),
      skyRain: new THREE.Color(PALETTE.skyRain),
      fogClear: new THREE.Color(PALETTE.fogClear),
      fogRain: new THREE.Color(PALETTE.fogRain),
      sunWarm: new THREE.Color(PALETTE.sunWarm),
      sunNeutral: new THREE.Color(PALETTE.sunNeutral),
      sunRain: new THREE.Color(PALETTE.sunRain),
      hemiClear: new THREE.Color(PALETTE.hemiSkyClear),
      hemiRain: new THREE.Color(PALETTE.hemiSkyRain),
      scratch: new THREE.Color(),
    }),
    [],
  );

  useEffect(() => {
    scene.background = new THREE.Color(PALETTE.skyClear);
    scene.fog = new THREE.Fog(PALETTE.fogClear, FOG_NEAR, FOG_FAR);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene]);

  useFrame((_, delta) => {
    const sun = sunRef.current;
    if (!sun) return;
    if (timeScale > 0) angle.current += delta * timeScale * SUN_ORBIT_SPEED;
    const blend = rainBlend.current;

    // Orbit matahari (ketinggian konstan, azimuth berputar).
    const elev = SUN_ORBIT_RADIUS * Math.tan((SUN_ELEVATION_DEG * Math.PI) / 180);
    sun.position.set(
      Math.sin(angle.current) * SUN_ORBIT_RADIUS,
      TERRAIN_Y + elev,
      Math.cos(angle.current) * SUN_ORBIT_RADIUS,
    );
    sun.target.position.set(0, TERRAIN_Y, 0);
    sun.target.updateMatrixWorld();

    // Kehangatan cahaya mengikuti azimuth (siklus pagi->sore yang halus),
    // lalu ditarik ke kelabu sesuai kadar hujan.
    const warmth = (Math.sin(angle.current) + 1) / 2;
    colors.scratch.lerpColors(colors.sunNeutral, colors.sunWarm, warmth);
    sun.color.lerpColors(colors.scratch, colors.sunRain, blend);
    sun.intensity = THREE.MathUtils.lerp(1.5, 0.45, blend);

    if (hemiRef.current) {
      hemiRef.current.color.lerpColors(colors.hemiClear, colors.hemiRain, blend);
      hemiRef.current.intensity = THREE.MathUtils.lerp(
        graphicQuality === "low" ? 0.7 : 0.5,
        graphicQuality === "low" ? 0.4 : 0.25,
        blend,
      );
    }
    if (fillRef.current) {
      fillRef.current.intensity = THREE.MathUtils.lerp(
        graphicQuality === "high" ? 0.6 : 0.4,
        0.15,
        blend,
      );
    }

    // Langit & fog senada dengan cuaca.
    if (scene.background instanceof THREE.Color) {
      scene.background.lerpColors(colors.skyClear, colors.skyRain, blend);
    }
    if (scene.fog) {
      scene.fog.color.lerpColors(colors.fogClear, colors.fogRain, blend);
    }
  });

  const mapSize = graphicQuality === "high" ? 2048 : 1024;

  return (
    <group>
      <hemisphereLight
        ref={hemiRef}
        args={[PALETTE.hemiSkyClear, PALETTE.hemiGround, 0.5]}
      />
      {graphicQuality !== "low" && (
        <directionalLight
          ref={fillRef}
          position={[-8, 6, -10]}
          color={PALETTE.fillLight}
        />
      )}
      <directionalLight
        ref={sunRef}
        castShadow={graphicQuality !== "low"}
        position={[10, 16, 8]}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-20}
        shadow-camera-right={20}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-bias={-0.001}
      />
    </group>
  );
}
```

**Langkah 2: Integrasikan ke IslandScene**

Di `IslandScene.tsx`, import `Sky from "./effects/Sky"`. Hapus seluruh fungsi `DynamicSun`, elemen `<hemisphereLight ...>` inline, dan fill `<directionalLight ...>` inline pada blok `graphicQuality !== "low" && ...`. Ganti ketiga bagian tersebut dengan satu pemanggilan pada posisi yang sama:

```tsx
        <Sky graphicQuality={graphicQuality} timeScale={timeScale} isRaining={isRaining} />
```

**Langkah 3: Verifikasi hasil visual**

Jalankan `rtk npm run lint` dan pastikan jumlah error pada IslandScene berkurang. Melalui browser-harness, pastikan matahari bergerak pada orbitnya dan bayangan ikut berpindah. Klik Rain On. Langit, fog, dan cahaya harus menggelap secara bertahap selama sekitar 2.5 detik, bukan berubah instan. Klik Rain Off. Semua warna harus kembali terang dengan transisi yang sama. Pada kualitas Low, bayangan dan fill light harus nonaktif.

**Langkah 4: Commit**

```bash
git add src/components/prototype/effects/Sky.tsx src/components/prototype/IslandScene.tsx
git commit -m "feat(effects): unified Sky with animated sun color, sky/fog tint, and smooth rain transition"
```

---

## Task 4: `effects/Clouds.tsx` untuk Awan Low-Poly yang Kohesif

**File:**
- Buat: `src/components/prototype/effects/Clouds.tsx`
- Ubah: `src/components/prototype/IslandScene.tsx` (ganti `RealisticClouds` menjadi `Clouds`. Hapus fungsi `RealisticClouds`)

**Kontrak Teknis:**
- Input: `WIND`, `PALETTE`, `seededRandom`, `useEasedBlend` dari `./weather`. `TERRAIN_Y` dari `../terrain`. `TimeScale` dari `../simulation`.
- Output: ekspor default `Clouds({ isRaining, timeScale })`.

**Desain:** Buat 8 awan. Setiap awan terdiri dari 4 sampai 6 lobus icosahedron dengan flat shading. Implementasi ini menggantikan 15 sphere acak dan satu billboard canvas pada setiap awan, sehingga kedua layer lama harus dihapus. Bangun layout secara deterministik dengan `seededRandom`. Gerakkan awan secara linear mengikuti `WIND`, lalu wrap posisinya di area 34×34. Jangan gunakan orbit. Lakukan lerp warna dari putih hangat ke kelabu berdasarkan `rainBlend`. Bake variasi tone setiap lobus satu kali melalui `setColorAt`, lalu animasikan perubahan cuaca melalui `material.color` agar hanya satu uniform yang berubah setiap frame. Pertahankan bayangan decal radial-gradient karena pendekatan tersebut sesuai dengan kebutuhan visual, dan pastikan bayangan mengikuti posisi awan. Simpan seluruh posisi yang berubah setiap frame di ref. Jangan mutasi hasil `useMemo` karena pola tersebut melanggar `react-hooks/immutability`.

**Langkah 1: Tulis Clouds.tsx lengkap**

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { TERRAIN_Y } from "../terrain";
import type { TimeScale } from "../simulation";
import { PALETTE, seededRandom, useEasedBlend, WIND } from "./weather";

const CLOUD_COUNT = 8;
const LOBES_MIN = 4;
const LOBES_MAX = 6;
const AREA_HALF = 17; // awan drift dalam kotak 34x34 lalu wrap
const ALTITUDE_MIN = 5.2;
const ALTITUDE_MAX = 6.6;
const RAIN_SINK = 0.8; // saat hujan, posisi awan turun sedikit
const SHADOW_SCALE = 5.5;
const LAYOUT_SEED = 20260706;

interface Lobe {
  ox: number;
  oy: number;
  oz: number;
  scale: number;
  tone: number; // 0.94..1 variasi keabuan halus, di-bake ke instanceColor
}
interface CloudSpec {
  lobes: Lobe[];
  y: number;
  driftScale: number; // awan tinggi bergerak sedikit lebih cepat
  startX: number;
  startZ: number;
}

function buildClouds(): { clouds: CloudSpec[]; totalLobes: number } {
  const rand = seededRandom(LAYOUT_SEED);
  const clouds: CloudSpec[] = [];
  let totalLobes = 0;
  for (let c = 0; c < CLOUD_COUNT; c++) {
    const lobeCount =
      LOBES_MIN + Math.floor(rand() * (LOBES_MAX - LOBES_MIN + 1));
    const lobes: Lobe[] = [];
    for (let l = 0; l < lobeCount; l++) {
      // Lobus tersusun memanjang tegak-lurus arah pandang umum, menonjol
      // di tengah sehingga siluetnya seperti kumulus low-poly.
      const t = lobeCount === 1 ? 0.5 : l / (lobeCount - 1);
      const along = (t - 0.5) * (1.7 + rand() * 0.8);
      const bulge = 1 - Math.abs(t - 0.5) * 1.4;
      lobes.push({
        ox: along + (rand() - 0.5) * 0.4,
        oy: bulge * (0.25 + rand() * 0.3),
        oz: (rand() - 0.5) * 0.9,
        scale: 0.55 + bulge * 0.75 + rand() * 0.3,
        tone: 0.94 + rand() * 0.06,
      });
    }
    clouds.push({
      lobes,
      y: ALTITUDE_MIN + rand() * (ALTITUDE_MAX - ALTITUDE_MIN),
      driftScale: 0.8 + rand() * 0.5,
      startX: (rand() - 0.5) * 2 * AREA_HALF,
      startZ: (rand() - 0.5) * 2 * AREA_HALF,
    });
    totalLobes += lobeCount;
  }
  return { clouds, totalLobes };
}

function makeShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,0.4)");
  g.addColorStop(0.5, "rgba(0,0,0,0.22)");
  g.addColorStop(0.8, "rgba(0,0,0,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

interface CloudsProps {
  isRaining: boolean;
  timeScale: TimeScale;
}

export default function Clouds({ isRaining, timeScale }: CloudsProps) {
  const lobeMeshRef = useRef<THREE.InstancedMesh>(null);
  const shadowMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainBlend = useEasedBlend(isRaining);

  const { clouds, totalLobes } = useMemo(buildClouds, []);
  const shadowTexture = useMemo(makeShadowTexture, []);
  // Simpan pusat setiap awan di ref. Jangan mutasi hasil useMemo karena
  // pola tersebut melanggar react-hooks/immutability.
  const centers = useRef(
    clouds.map((c) => ({ x: c.startX, z: c.startZ })),
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colors = useMemo(
    () => ({
      clear: new THREE.Color(PALETTE.cloudClear),
      rain: new THREE.Color(PALETTE.cloudRain),
      tone: new THREE.Color(),
    }),
    [],
  );

  // Bake variasi tone setiap lobus satu kali. Animasi warna cuaca cukup
  // mengubah material.color tanpa menulis instanceColor setiap frame.
  useEffect(() => {
    const mesh = lobeMeshRef.current;
    if (!mesh) return;
    let i = 0;
    for (const spec of clouds) {
      for (const lobe of spec.lobes) {
        colors.tone.setScalar(lobe.tone);
        mesh.setColorAt(i, colors.tone);
        i++;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [clouds, colors]);

  useFrame((_, delta) => {
    const lobeMesh = lobeMeshRef.current;
    const shadowMesh = shadowMeshRef.current;
    if (!lobeMesh) return;
    const move = delta * timeScale;
    const blend = rainBlend.current;

    const mat = lobeMesh.material as THREE.MeshLambertMaterial;
    mat.color.lerpColors(colors.clear, colors.rain, blend);

    let i = 0;
    for (let c = 0; c < clouds.length; c++) {
      const spec = clouds[c];
      const center = centers.current[c];
      center.x += WIND.x * WIND.speed * spec.driftScale * move;
      center.z += WIND.z * WIND.speed * spec.driftScale * move;
      // Wrap-around agar langit tidak pernah kosong.
      if (center.x < -AREA_HALF) center.x += AREA_HALF * 2;
      if (center.x > AREA_HALF) center.x -= AREA_HALF * 2;
      if (center.z < -AREA_HALF) center.z += AREA_HALF * 2;
      if (center.z > AREA_HALF) center.z -= AREA_HALF * 2;

      const y = spec.y - blend * RAIN_SINK;

      for (const lobe of spec.lobes) {
        dummy.position.set(center.x + lobe.ox, y + lobe.oy, center.z + lobe.oz);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(lobe.scale, lobe.scale * 0.72, lobe.scale);
        dummy.updateMatrix();
        lobeMesh.setMatrixAt(i, dummy.matrix);
        i++;
      }

      if (shadowMesh) {
        dummy.position.set(center.x, TERRAIN_Y + 0.05, center.z);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.scale.setScalar(SHADOW_SCALE);
        dummy.updateMatrix();
        shadowMesh.setMatrixAt(c, dummy.matrix);
      }
    }
    lobeMesh.instanceMatrix.needsUpdate = true;
    if (shadowMesh) shadowMesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* Lobus awan low-poly dengan flat shading yang menyatu dengan gaya pulau */}
      <instancedMesh ref={lobeMeshRef} args={[undefined, undefined, totalLobes]}>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshLambertMaterial flatShading transparent opacity={0.92} />
      </instancedMesh>
      {/* Bayangan decal lembut untuk setiap awan */}
      <instancedMesh ref={shadowMeshRef} args={[undefined, undefined, CLOUD_COUNT]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTexture} transparent depthWrite={false} />
      </instancedMesh>
    </group>
  );
}
```

**Langkah 2: Integrasikan ke IslandScene**

Import `Clouds from "./effects/Clouds"`. Hapus seluruh fungsi `RealisticClouds` (termasuk kedua canvas texture generator dan array `puffs`). Ganti `{isCloudy && <RealisticClouds .../>}` menjadi:

```tsx
        {isCloudy && <Clouds isRaining={isRaining} timeScale={timeScale} />}
```

**Langkah 3: Verifikasi hasil visual**

Verifikasi melalui browser. Awan harus terlihat faceted dan menyatu dengan gaya low-poly pulau, bukan seperti gumpalan sphere atau billboard blur. Drift harus bergerak perlahan dalam satu arah yang konsisten. Wrap tidak boleh menimbulkan perpindahan mencolok di area pandang. Bayangan decal harus mengikuti awan. Saat Rain On aktif, awan harus menggelap dan turun secara bertahap. Tombol Pause harus menghentikan drift. Jalankan lint dan pastikan jumlah error pada IslandScene turun secara signifikan setelah mutasi `puffs` dihapus.

**Langkah 4: Commit**

```bash
git add src/components/prototype/effects/Clouds.tsx src/components/prototype/IslandScene.tsx
git commit -m "feat(effects): deterministic low-poly faceted clouds with wind drift and soft ground shadows"
```

---

## Task 5: `effects/Rain.tsx` dan Finalisasi `IslandScene.tsx`

**File:**
- Buat: `src/components/prototype/effects/Rain.tsx`
- Ubah: `src/components/prototype/IslandScene.tsx` (ganti `RealisticRainSystem` menjadi `Rain`, bersihkan sisa import. File harus 0 error lint setelah task ini)

**Kontrak Teknis:**
- Input: `WIND`, `RAIN_TIERS`, `useEasedBlend` dari `./weather`. `sampleGround` dari `../terrain`. `GraphicQuality` dari `../IslandScene`. `TimeScale` dari `../simulation`.
- Output: ekspor default `Rain({ isRaining, timeScale, graphicQuality })`.

**Desain:** Representasikan setiap tetes sebagai instanced plane tipis berukuran 0.02×0.55 dengan tekstur gradient vertikal yang memudar pada kedua ujungnya. Hasilnya harus terlihat sebagai streak hujan, bukan sphere yang diregangkan. Hitung kemiringan plane dan dorongan horizontal dari `WIND` yang sama dengan awan dan pohon. Atur jumlah tetes aktif dengan `floor(maxDrops × blend)` agar intensitas hujan naik dan turun secara bertahap. Komponen harus tetap terpasang dan melewati pekerjaan frame saat `blend` mendekati 0. Pola ini menggantikan `if (!isRaining) return null` yang menghilangkan hujan secara instan. Pertahankan splash ring dengan ukuran dan opacity yang lebih rendah. Tier Low tidak menggunakan splash. Simpan data tetes di `useRef`, bukan pada objek hasil `useMemo`. Penggunaan `Math.random()` diperbolehkan untuk respawn di dalam frame loop dan inisialisasi ref satu kali karena posisi hujan boleh berbeda antarsesi.

**Langkah 1: Tulis Rain.tsx lengkap**

```tsx
"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { sampleGround } from "../terrain";
import type { TimeScale } from "../simulation";
import type { GraphicQuality } from "../IslandScene";
import { RAIN_TIERS, useEasedBlend, WIND } from "./weather";

const SPAWN_AREA = 20;
const FALL_SPEED_MIN = 9;
const FALL_SPEED_VAR = 4;
const SPAWN_Y_MIN = 6;
const SPAWN_Y_VAR = 3;
const WIND_PUSH = 1.6; // seberapa jauh angin menggeser tetes per detik
const STREAK_TILT = 0.35; // kemiringan streak mengikuti WIND
const SPLASH_LIFE_MIN = 0.15;
const SPLASH_LIFE_VAR = 0.1;
const HIDDEN_Y = -10;

interface Drop { x: number; y: number; z: number; speed: number }
interface Splash { x: number; y: number; z: number; age: number; life: number }

function makeStreakTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, 64);
  g.addColorStop(0, "rgba(214,230,245,0)");
  g.addColorStop(0.35, "rgba(214,230,245,0.85)");
  g.addColorStop(0.75, "rgba(214,230,245,0.85)");
  g.addColorStop(1, "rgba(214,230,245,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 8, 64);
  return new THREE.CanvasTexture(canvas);
}

interface RainProps {
  isRaining: boolean;
  timeScale: TimeScale;
  graphicQuality: GraphicQuality;
}

export default function Rain({ isRaining, timeScale, graphicQuality }: RainProps) {
  const tier = RAIN_TIERS[graphicQuality];
  const dropsMeshRef = useRef<THREE.InstancedMesh>(null);
  const splashMeshRef = useRef<THREE.InstancedMesh>(null);
  const rainBlend = useEasedBlend(isRaining);
  const streakTexture = useMemo(makeStreakTexture, []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Kemiringan streak mengikuti arah WIND yang sama dengan efek lain.
  const tiltZ = -WIND.x * STREAK_TILT;
  const tiltX = WIND.z * STREAK_TILT;

  const drops = useRef<Drop[] | null>(null);
  const splashes = useRef<Splash[] | null>(null);
  const splashCursor = useRef(0);
  if (drops.current === null) {
    drops.current = Array.from({ length: tier.drops }, () => ({
      x: (Math.random() - 0.5) * SPAWN_AREA,
      y: Math.random() * (SPAWN_Y_MIN + SPAWN_Y_VAR),
      z: (Math.random() - 0.5) * SPAWN_AREA,
      speed: FALL_SPEED_MIN + Math.random() * FALL_SPEED_VAR,
    }));
    splashes.current = Array.from({ length: Math.max(1, tier.splashes) }, () => ({
      x: 0, y: HIDDEN_Y, z: 0, age: 1, life: SPLASH_LIFE_MIN,
    }));
  }

  useFrame((_, delta) => {
    const dropsMesh = dropsMeshRef.current;
    if (!dropsMesh || !drops.current || !splashes.current) return;
    const blend = rainBlend.current;
    dropsMesh.visible = blend > 0.01;
    if (splashMeshRef.current) {
      splashMeshRef.current.visible = blend > 0.01 && tier.splashes > 0;
    }
    if (blend <= 0.01 || timeScale === 0) return;

    const move = delta * timeScale;
    const active = Math.floor(tier.drops * blend);

    for (let i = 0; i < tier.drops; i++) {
      const p = drops.current[i];
      if (i >= active) {
        dummy.position.set(0, HIDDEN_Y, 0);
        dummy.scale.setScalar(0);
        dummy.updateMatrix();
        dropsMesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      p.y -= p.speed * move;
      p.x += WIND.x * WIND_PUSH * move;
      p.z += WIND.z * WIND_PUSH * move;

      const ground = sampleGround(p.x, p.z);
      const groundY = ground ? ground.y : -2;
      if (p.y < groundY + 0.1) {
        if (ground && tier.splashes > 0) {
          const s = splashes.current[splashCursor.current];
          s.x = p.x;
          s.y = groundY + 0.04;
          s.z = p.z;
          s.age = 0;
          s.life = SPLASH_LIFE_MIN + Math.random() * SPLASH_LIFE_VAR;
          splashCursor.current = (splashCursor.current + 1) % tier.splashes;
        }
        p.y = SPAWN_Y_MIN + Math.random() * SPAWN_Y_VAR;
        for (let attempt = 0; attempt < 5; attempt++) {
          const tx = (Math.random() - 0.5) * SPAWN_AREA;
          const tz = (Math.random() - 0.5) * SPAWN_AREA;
          if (sampleGround(tx, tz)) {
            p.x = tx;
            p.z = tz;
            break;
          }
        }
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(tiltX, 0, tiltZ);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      dropsMesh.setMatrixAt(i, dummy.matrix);
    }
    dropsMesh.instanceMatrix.needsUpdate = true;

    const splashMesh = splashMeshRef.current;
    if (splashMesh && tier.splashes > 0) {
      for (let i = 0; i < tier.splashes; i++) {
        const s = splashes.current[i];
        s.age += move;
        if (s.age < s.life) {
          const t = s.age / s.life;
          dummy.position.set(s.x, s.y, s.z);
          dummy.rotation.set(-Math.PI / 2, 0, 0);
          dummy.scale.setScalar(0.4 + t * 0.9);
        } else {
          dummy.position.set(0, HIDDEN_Y, 0);
          dummy.scale.setScalar(0);
        }
        dummy.updateMatrix();
        splashMesh.setMatrixAt(i, dummy.matrix);
      }
      splashMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={dropsMeshRef} args={[undefined, undefined, tier.drops]}>
        <planeGeometry args={[0.02, 0.55]} />
        <meshBasicMaterial
          map={streakTexture}
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={splashMeshRef}
        args={[undefined, undefined, Math.max(1, tier.splashes)]}
      >
        <ringGeometry args={[0.03, 0.055, 10]} />
        <meshBasicMaterial
          color="#dbe9f4"
          transparent
          opacity={0.3}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
```

Catatan: Saat user mengganti kualitas, nilai `tier` berubah dan panjang `drops.current` dapat berbeda dari `tier.drops` yang baru. Pasang `key={graphicQuality}` pada `<Rain>` di IslandScene agar komponen melakukan remount ketika tier berubah. Reset state hujan pada kondisi ini dapat diterima.

**Langkah 2: Integrasikan ke IslandScene dan rapikan sisa kode**

Ganti `<RealisticRainSystem .../>` dengan:

```tsx
        <Rain
          key={graphicQuality}
          isRaining={isRaining}
          timeScale={timeScale}
          graphicQuality={graphicQuality}
        />
```

Hapus seluruh fungsi `RealisticRainSystem`. Periksa lalu hapus import yang tidak lagi digunakan di `IslandScene.tsx`, yaitu `useMemo`, `useEffect`, `useRef`, `useFrame`, `THREE`, dan `sampleGround`. Jangan menghapus import yang masih dipakai. Susunan akhir `IslandScene.tsx` hanya berisi `CustomMapControls`, `Vegetation`, `Resource`, `Sea`, `TerrainLoadingOverlay`, tipe `GraphicQuality`, dan `IslandScene`. File tersebut hanya bertugas menyusun komponen.

**Langkah 3: Verifikasi**

Jalankan `rtk npm run lint` dan pastikan `IslandScene.tsx` menghasilkan 0 error dan 0 warning. Melalui browser, pastikan hujan terlihat sebagai streak halus yang miring searah drift awan. Hujan harus muncul dan berhenti secara bertahap selama sekitar 2.5 detik. Tier Medium dan High harus menampilkan splash kecil di tanah. Tier Low tidak boleh menampilkan splash dan harus menjaga beban render tetap rendah. Tetes hujan tidak boleh terus jatuh di luar area pulau.

**Langkah 4: Commit**

```bash
git add src/components/prototype/effects/Rain.tsx src/components/prototype/IslandScene.tsx
git commit -m "feat(effects): wind-aligned streak rain with smooth fade; IslandScene now composition-only and lint-clean"
```

---

## Task 6: Pengetikan Ketat dan Integrasi Angin pada `EnvironmentModels.tsx`

**File:**
- Ubah: `src/components/prototype/EnvironmentModels.tsx`

**Kontrak Teknis:**
- Input: `WIND` dari `./effects/weather`.
- Output: perilaku identik (bedah spruce, scale jembatan, ombak sungai, sway kanopi) dengan kode bertipe benar. Nama ekspor komponen tidak berubah.

**Langkah 1: Hilangkan semua `any` dan ekstrak bedah terrain**

Pecah isi `useMemo` raksasa di `TerrainGLB` menjadi fungsi module-level bertipe, dipanggil berurutan dari `useMemo` yang sama (perilaku dan angka identik):

```ts
type GLTFMaterials = Record<string, THREE.Material & { userData: Record<string, unknown> }>;

interface TreeCenter { x: number; y: number; z: number; count: number; maxY: number }

function isMesh(object: THREE.Object3D): object is THREE.Mesh {
  return (object as THREE.Mesh).isMesh === true;
}

// Pass 1: temukan pusat cluster spruce dari vertex mat9 (kanopi).
function collectSpruceCenters(scene: THREE.Object3D, materials: GLTFMaterials): TreeCenter[] {
  /* isi = pindahan logika first-pass yang ada (clustering radius 0.3,
     filter maxY > 0.1), dengan TreeCenter[] menggantikan any[] */
}

// Pass 2: tenggelamkan vertex kanopi (mat9, radius 0.38) dan batang
// (mat20, radius 0.20) milik spruce ke y=-5 agar digantikan tree.glb.
function removeSpruceTrees(scene: THREE.Object3D, materials: GLTFMaterials, centers: TreeCenter[]): void {
  /* isi = pindahan logika spruceRemoved yang ada */
}

// Perbesar jembatan 1.5x di CPU geometry supaya BVH raycast fisik hewan
// cocok dengan ukuran visual baru.
function scaleBridge(scene: THREE.Object3D, materials: GLTFMaterials): void {
  /* isi = pindahan logika bridgeScaled yang ada (pusat -0.155/-0.10/0.158, radius 0.28) */
}

// Riak sungai prosedural pada material air (mat3/mat4).
function hookRiverWaves(materials: GLTFMaterials, uTime: { value: number }): void {
  /* isi = pindahan onBeforeCompile mat3/mat4 yang ada */
}

// Sway angin pada kanopi spruce sisa (mat9).
function hookSpruceSway(materials: GLTFMaterials, uTime: { value: number }): void {
  /* isi = pindahan onBeforeCompile mat9 yang ada + bias WIND (Step 2) */
}
```

Ikuti aturan pemindahan berikut. Ganti semua `(object: any)` dengan `THREE.Object3D` dan gunakan guard `isMesh`. Ganti `useGLTF(...) as any` dengan `useGLTF(TERRAIN_URL) as unknown as { scene: THREE.Group; materials: GLTFMaterials }`. Ganti `shader: any` dengan tipe parameter bawaan Three.js untuk `onBeforeCompile`, yaitu `THREE.WebGLProgramParametersWithUniforms`. Ubah `let` menjadi `const` ketika nilainya tidak pernah diubah kembali. Pertahankan seluruh angka dan urutan operasi.

**Langkah 2: Satukan parameter angin**

Import `WIND` dari `./effects/weather`.

Di `Tree` (kanopi tree.glb): ganti fase `Math.random()` dan tambahkan bias arah angin:

```ts
  // Hitung fase deterministik dari posisi tanpa Math.random di useMemo.
  const phase = useMemo(() => ((x * 7.31 + z * 3.17) % (Math.PI * 2)), [x, z]);
```

Dan dua baris sway menjadi:

```ts
    const swayX = (Math.sin(t * 1.5) + Math.sin(t * 2.7) * 0.5) * 0.04 + WIND.x * 0.015;
    const swayZ = (Math.cos(t * 1.2) + Math.cos(t * 3.1) * 0.5) * 0.04 + WIND.z * 0.015;
```

Di `hookSpruceSway`, tambahkan bias yang sama ke GLSL (interpolasi nilai saat build string shader):

```ts
  const biasX = (WIND.x * 0.015).toFixed(4);
  const biasZ = (WIND.z * 0.015).toFixed(4);
  // ... di dalam string pengganti begin_vertex:
  // transformed.x += swayX + float(${biasX});
  // transformed.z += swayZ + float(${biasZ});
```

**Langkah 3: Verifikasi**

Jalankan `rtk npm run lint` dan pastikan `EnvironmentModels.tsx` menghasilkan 0 error. Jalankan `rtk npm run build` dan pastikan build lulus. Melalui browser, pastikan pohon memiliki bias sway yang searah dengan drift awan dan kemiringan hujan, sungai tetap berombak, ukuran jembatan tidak berubah, dan spruce GLB tetap digantikan oleh `tree.glb`. Bandingkan screenshot sebelum dan sesudah task. Hasilnya harus identik, kecuali perubahan kecil pada arah sway.

**Langkah 4: Commit**

```bash
git add src/components/prototype/EnvironmentModels.tsx
git commit -m "refactor(environment): typed terrain surgery helpers, shared wind direction, deterministic sway phase"
```

---

## Task 7: Remaster Kontrol Keyboard, POV, dan Avoidance pada `Animal.tsx`

**File:**
- Ubah: `src/components/prototype/Animal.tsx`
- Ubah: `src/components/prototype/species.ts`

**Kontrak Teknis:**
- Input: Perilaku yang sudah ada, termasuk konstanta pada `simulation.ts` dan sense pass predator-prey. Jangan mengubah bagian tersebut pada task ini. Perbaikan dari Task 1 sudah diterapkan lebih dahulu.
- Output: Tambahkan `Species.povCamera?: { height: number; back: number; pitch: number }` pada `species.ts`. Hawk mengisi konfigurasi khusus, sedangkan spesies lain memakai nilai default. Tambahkan hook internal `useKeyboardControls(active: boolean)` dan fungsi `computeAvoidance(m, species, stranded)` pada `Animal.tsx`. Setelah task ini, `Animal.tsx` harus menghasilkan 0 error dan 0 warning, sehingga lint seluruh repository juga mencapai 0.

**Langkah 1: Ekstrak hook keyboard**

Pindahkan ref `keys` dan kedua `useEffect` untuk keyboard menjadi hook di file yang sama, di atas komponen:

```ts
const CONTROL_KEYS = ["w", "a", "s", "d", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight", " "] as const;
type ControlKey = (typeof CONTROL_KEYS)[number];

// Keyboard state untuk hewan yang sedang dikontrol manual. Ref, bukan
// state: dibaca setiap frame oleh useFrame tanpa memicu render.
function useKeyboardControls(active: boolean) {
  const keys = useRef<Record<ControlKey, boolean>>(
    Object.fromEntries(CONTROL_KEYS.map((k) => [k, false])) as Record<ControlKey, boolean>,
  );
  useEffect(() => {
    if (!active) return;
    const isControlKey = (key: string): key is ControlKey =>
      (CONTROL_KEYS as readonly string[]).includes(key);
    const down = (e: KeyboardEvent) => { if (isControlKey(e.key)) keys.current[e.key] = true; };
    const up = (e: KeyboardEvent) => { if (isControlKey(e.key)) keys.current[e.key] = false; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    const snapshot = keys.current;
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      // Reset saat deselect agar hewan tidak "jalan sendiri" saat dipilih lagi.
      for (const k of CONTROL_KEYS) snapshot[k] = false;
    };
  }, [active]);
  return keys;
}
```

Gunakan `const keys = useKeyboardControls(selected);` di dalam komponen. Bagian lain tetap membaca `keys.current` seperti sebelumnya. Sesuaikan akses untuk tombol spasi melalui `k[" "]`. Snapshot lokal pada fungsi cleanup harus menghapus warning lama dari `react-hooks/exhaustive-deps`.

**Langkah 2: Konstanta bernama untuk gerak manual**

Di atas komponen:

```ts
const JUMP_VELOCITY = 4;
const GRAVITY = 15;
const MANUAL_TURN_MULT = 2.0;
```

Ganti angka hard-coded `4`, `15`, `2.0` di cabang `selected` dengan konstanta ini.

**Langkah 3: Pindahkan konfigurasi POV ke data spesies dan gunakan follow teredam**

Di `species.ts`, tambah ke interface `Species`:

```ts
  // Offset kamera orang-pertama saat hewan dikontrol manual (mode POV).
  povCamera?: { height: number; back: number; pitch: number };
```

Entri hawk mengisi: `povCamera: { height: 1.2, back: 1.5, pitch: 0.6 },`. Spesies lain tidak mengisi.

Di `Animal.tsx`, ganti blok `{isPOV && <PerspectiveCamera ...>}` (yang berisi ternary `species.id === "hawk"`) dengan komponen kecil di file yang sama:

```tsx
const POV_DEFAULT = { height: 0.3, back: 0.6, pitch: 0.15 };
const POV_DAMPING = 6;

// Kamera POV mengejar offset targetnya dengan damping ringan sehingga
// posisi kamera bergerak halus dan tidak menempel kaku. Saat masuk POV,
// kamera mulai sedikit lebih tinggi dan lebih jauh. Saat keluar POV, kamera
// langsung kembali ke ortografis. Transisi antarproyeksi tidak digunakan.
function PovCamera({ species }: { species: Species }) {
  const camRef = useRef<THREE.PerspectiveCamera>(null);
  const pov = species.povCamera ?? POV_DEFAULT;
  const target = useMemo(
    () =>
      new THREE.Vector3(
        0,
        (species.modelYOffset || 0) + species.selectionRadius * 1.2 + pov.height,
        -species.selectionRadius * 2.5 - pov.back,
      ),
    [species, pov],
  );
  useFrame((_, delta) => {
    const cam = camRef.current;
    if (!cam) return;
    cam.position.lerp(target, Math.min(1, delta * POV_DAMPING));
  });
  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      position={[target.x, target.y + 0.4, target.z - 0.3]}
      rotation={[pov.pitch, Math.PI, 0]}
      fov={75}
    />
  );
}
```

Gunakan `{isPOV && <PovCamera species={species} />}`. Periksa import yang sudah ada sebelum menambah import baru. Bila file belum memakai namespace `THREE`, Anda dapat menambahkan `import * as THREE from "three"`. Alternatifnya, pertahankan import bernama `Group` dan `MathUtils`, lalu tambahkan tipe `PerspectiveCamera as ThreePerspectiveCamera` untuk ref serta `Vector3`.

**Langkah 4: Ekstrak obstacle avoidance dan bersihkan prefer-const**

Pindahkan blok potential field yang berisi loop `VEGETATION` dan sampling lingkaran 8 arah dengan `Math.PI/4` dari dalam `useFrame` menjadi fungsi module-level dengan bobot bernama. Logika dan angka tidak berubah:

```ts
const AVOID_GOAL_WEIGHT = 0.4;      // bobot arah tujuan saat blending
const AVOID_CLIFF_PUSH = 0.8;       // dorongan menjauh dari tebing/air terlarang
const AVOID_LOOKAHEAD = 1.0;        // radius sampling lingkaran
const AVOID_SLOWDOWN_THRESHOLD = 1.0;
const AVOID_SLOWDOWN_FACTOR = 0.6;
const AVOID_TURN_BOOST = 3.0;

interface AvoidanceResult { x: number; z: number; strength: number }

function computeAvoidance(
  m: { x: number; z: number },
  species: Species,
  stranded: boolean,
): AvoidanceResult {
  /* isi = pindahan kode avoidance yang ada persis (loop VEGETATION dengan
     safeRadius = species.selectionRadius*0.5 + v.scale*0.6 + 0.4 dan push
     kuadratik; lalu 8 arah sampleGround dengan AVOID_LOOKAHEAD dan push
     AVOID_CLIFF_PUSH), hanya angka-angka diganti konstanta di atas */
}
```

Di dalam `useFrame`, panggil `const avoid = computeAvoidance(m, species, stranded);`. Gunakan `AVOID_GOAL_WEIGHT`, `AVOID_SLOWDOWN_THRESHOLD`, `AVOID_SLOWDOWN_FACTOR`, dan `AVOID_TURN_BOOST` pada blok blending. Ubah seluruh deklarasi `let totalSin` dan `let totalCos` menjadi `const` ketika nilainya tidak pernah diubah kembali. Perubahan ini harus menghapus 6 error `prefer-const` yang lama.

**Langkah 5: Verifikasi**

Jalankan `rtk npm run lint` dan pastikan seluruh repository menghasilkan 0 error dan 0 warning. Jalankan `rtk npm run build` dan pastikan build lulus. Melalui browser, pilih deer, masuk ke mode POV, lalu uji WASD, tombol spasi, lompatan, dan gravitasi. Kamera harus mengikuti dengan damping yang halus saat mode POV aktif. POV hawk harus tetap lebih tinggi dan lebih jauh daripada spesies lain. Keluar dari POV harus mengembalikan kamera normal. Hewan otonom harus tetap menghindari pohon dan tebing seperti sebelum task.

**Langkah 6: Commit**

```bash
git add src/components/prototype/Animal.tsx src/components/prototype/species.ts
git commit -m "refactor(controls): keyboard hook, data-driven damped POV camera, named avoidance weights - zero lint"
```

---

## Task 8: Validasi Penuh, Dokumentasi, dan Commit Final setelah Persetujuan User

**File:**
- Buat: `docs/feature/remaster-wahyu/remaster-wahyu.md`
- Ubah: `docs/project/prd.md`

**Syarat wajib:** Lakukan squash dan commit final hanya setelah user menyelesaikan pengujian manual dan memberikan persetujuan eksplisit. Jangan lakukan push sebelum user memintanya.

**Langkah 1: Lint dan build penuh**

Jalankan `rtk npm run lint` dan pastikan hasilnya 0 masalah dari baseline 42. Jalankan `rtk npm run build` dan pastikan build lulus.

**Langkah 2: Validasi stabilitas populasi (kriteria PRD yang sebelumnya gagal)**

Gunakan browser-harness: muat ulang halaman, atur kecepatan ke 4×, biarkan 10 menit real-time. Setiap 60 detik baca sensus:

```bash
browser-harness -c "print(js('document.body.innerText.match(/(\\\\d+) animals/)[1]'))"
```

Kriteria lulus terdiri dari tiga syarat. Populasi tidak pernah mencapai 0. Populasi tidak berosilasi ekstrem antara 0 dan 24 secara berulang. Deer dan rabbit tidak mengalami kepunahan permanen. Populasinya boleh turun selama dapat pulih melalui reproduksi.

**Langkah 3: Validasi visual menyeluruh**

Ambil rangkaian screenshot melalui browser-harness. Pertama, ambil kondisi cerah yang menampilkan awan low-poly faceted, bayangan decal, dan pergerakan matahari. Kedua, klik Rain On dan ambil 3 screenshot dengan jarak sekitar 1 detik untuk merekam transisi ketika langit, cahaya, serta awan menggelap dan intensitas hujan meningkat. Ketiga, ambil kondisi hujan penuh yang menunjukkan streak miring searah drift awan dan bias sway pohon. Keempat, klik Rain Off dan rekam transisi kembali ke kondisi cerah. Kelima, ambil satu screenshot untuk masing-masing kualitas Low, Medium, dan High. Pada kualitas Low, bayangan, splash, dan post-processing harus nonaktif tanpa merusak tampilan utama.

**Langkah 4: Pengujian manual oleh user**

Serahkan ke user untuk verifikasi sendiri di browser. Tunggu persetujuan eksplisit sebelum Langkah 5-7.

**Langkah 5: Tulis dokumen handoff**

Gunakan pola `docs/feature/dynamic-terrain/dynamic-terrain.md` untuk menulis `docs/feature/remaster-wahyu/remaster-wahyu.md`. Dokumen harus memuat ringkasan, struktur folder `effects/`, tabel konstanta dari `weather.ts` yang mencakup WIND, palet, dan tier, serta keputusan teknis utama. Jelaskan penggunaan satu sumber WIND untuk awan, hujan, dan pohon, alasan memakai eased blend alih-alih perubahan instan, penggunaan seeded RNG alih-alih `Math.random()` di `useMemo`, akar masalah bug kolaps dan mekanisme perbaikan dari Task 1, batasan perpindahan kamera ortografis ke perspektif, serta alasan `key={graphicQuality}` melakukan remount pada Rain. Sertakan hasil validasi berupa lint dari 42 masalah menjadi 0, hasil build, sensus 10 menit, dan daftar screenshot. Akhiri dengan Known Limitations dan langkah berikutnya untuk tiga krisis ekosistem.

**Langkah 6: Perbarui PRD**

Perbarui `docs/project/prd.md`. Catat remaster beserta evidence path `src/components/prototype/effects/`, `Animal.tsx`, `EnvironmentModels.tsx`, dan `IslandScene.tsx`. Ubah status bug kolaps populasi menjadi fixed dan rujuk dokumen handoff. Bila sensus pada Langkah 2 lulus, hapus catatan "balancing diblokir bug" pada baris predator-mangsa. Dengan bukti sensus tersebut, bagian predator-mangsa dapat diberi status `Implemented`.

**Langkah 7: Squash dan commit final**

```bash
git reset --soft d963ab5
git add -A
git commit -m "feat: remaster environment visuals and animal controls with cohesive low-poly art direction

- Unified weather source (WIND, palette, eased transitions) across clouds, rain, trees
- Deterministic low-poly faceted clouds with wind drift and soft ground shadows
- Wind-aligned streak rain with gradual fade and quality tiers
- Dynamic sky/fog/sun color with smooth rain transitions
- Typed terrain-surgery helpers in EnvironmentModels, zero any-casts
- Keyboard hook, data-driven damped POV camera, named avoidance weights
- Root-cause fix for pre-existing total population collapse: <ringkasan 1 baris dari Task 1>
- Repo-wide lint: 42 problems -> 0"
```

Jalankan `rtk git log --oneline -3`
Hasil yang diharapkan: commit teratas pesan di atas, tepat di atas `d963ab5`.

---

## Pemeriksaan Akhir setelah Seluruh Task Selesai

1. **Cakupan permintaan user:** Seluruh visual environment Wahyu tercakup. Task 4 menangani awan, Task 5 menangani hujan, Task 3 menangani matahari, pencahayaan, dan kualitas, sedangkan Task 6 menangani angin, ombak, modifikasi spruce, dan jembatan. Post-processing tetap dipertahankan. Kontrol dan AI juga tercakup melalui keyboard dan lompatan pada Task 7 Langkah 1 sampai 2, POV pada Langkah 3, serta avoidance pada Langkah 4. Task 1 menangani bug kolaps populasi sebelum task lain. Rencana tidak menambah model baru. Target clean code tercapai ketika lint seluruh repository menjadi 0 setelah Task 5 membersihkan IslandScene, Task 6 membersihkan EnvironmentModels, dan Task 7 membersihkan Animal.
2. **Konsistensi nama:** Gunakan nama `WIND`, `PALETTE`, `RAIN_TIERS`, `WEATHER_FADE_SECONDS`, `seededRandom`, dan `useEasedBlend` secara identik antara definisi pada Task 2 dan pemakaian pada Task 3 sampai Task 6. `Sky`, `Clouds`, dan `Rain` harus tetap menjadi ekspor default dengan props yang sama seperti pemanggilannya di IslandScene. Nama `povCamera` harus identik antara `species.ts` dan `PovCamera`. Tipe `GraphicQuality` tetap berasal dari IslandScene.
3. **Regresi:** Jangan ubah props `IslandScene`, sehingga `BiodiversityPrototype` tidak perlu disentuh. Pertahankan seluruh perilaku gameplay yang tercantum pada Batasan Global. Task 6 dan Task 7 harus mempertahankan logika serta angka yang ada, kecuali perbaikan pada Task 1 dan bias sway ±0.015 yang memang disengaja.
4. **Aturan repository:** Simpan seluruh data yang berubah setiap frame di ref. Gunakan seeded RNG untuk awan dan fase sway pohon, bukan `Math.random()` di dalam `useMemo`. Gunakan konstanta bernama untuk angka penting. Jalankan lint dan build pada setiap task. Lakukan verifikasi visual melalui Chrome asli dengan browser-harness, bukan MCP headless.

## Pekerjaan Lanjutan di Luar Eksekusi Saat Ini

- **Tiga krisis ekosistem:** Buat rencana terpisah untuk bagian terakhir milestone Hari 6 sampai Hari 9 setelah remaster ini stabil. Rencana saat ini sudah menyiapkan prasyarat berupa transisi cuaca dan populasi yang stabil.
- **Day/night cycle penuh:** `Sky.tsx` sudah menyediakan orbit matahari dan warna dinamis. Kerjakan langit malam serta bintang pada fase polish Hari 10 sampai Hari 12, bukan pada rencana ini.
- **Instancing vegetasi:** Gunakan `InstancedMesh` untuk `tree.glb` pada fase optimasi mulai Hari 13 sesuai PRD.
