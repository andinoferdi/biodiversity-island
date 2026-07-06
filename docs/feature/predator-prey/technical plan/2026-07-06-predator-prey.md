# Predator–Prey - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Pakai superpowers:subagent-driven-development (disarankan) atau superpowers:executing-plans untuk mengeksekusi plan ini task demi task. Setiap step pakai checkbox (`- [ ]`) untuk tracking.

**Goal:** Menjadikan hubungan predator–mangsa sebagai mekanik ekosistem nyata: predator mendapat makan dari membunuh, mangsa bisa diserang kapan pun (termasuk saat makan/minum), dan wolf hadir sebagai predator darat baru dengan animasi Gallop saat berburu.

**Architecture:** Melengkapi fondasi yang sudah ada di commit "enhance animal AI" (`predatorOf`, `canSee`, status `Hunting`/`Fleeing`, registry `liveAnimals`), bukan membangun ulang. Komunikasi antar hewan memakai mailbox `killRewards` di `simulation.ts` karena tiap komponen `Animal` hanya boleh memutasi ref-nya sendiri (pola per-frame ref proyek ini). Wolf memakai pipeline GLB beranimasi yang sama dengan deer (`SkeletonUtils.clone` + `useAnimations` di `AnimalModel.tsx`).

**Tech Stack:** Next.js 16 (App Router, React Compiler), React 19, TypeScript, Three.js 0.185 + @react-three/fiber v9 + @react-three/drei v10, Tailwind CSS v4, npm.

## Konteks Keputusan (dari klarifikasi)

- **Asset wolf sudah tersedia** — Wahyu sudah menyiapkan `public/assets/animal/wolf/wolf.glb` + `thumbnail.jpg` (sudah masuk repo di commit `4bb151d`). Tidak perlu mencari model lain; model predator lain (crocodile dsb.) DI LUAR SCOPE.
- **Hasil inspeksi `wolf.glb`** (gltf-transform, FBX2glTF v0.9.7, 3.994 vertex, tanpa texture — material warna solid seperti hewan lain): klip animasi tersedia **Attack, Death, Eating, Gallop, Gallop_Jump, Idle, Idle_2, Idle_2_HeadLow, Idle_HitReact_Left, Idle_HitReact_Right, Jump_ToIdle, Walk** (ada duplikat berprefix `AnimalArmature|`, pakai nama tanpa prefix). Bounding box mentah: tinggi ~2.67, panjang ~5.55 unit → perlu `modelScale` kecil (~0.13) seperti deer/horse.
- **Kill tetap instan** dalam `KILL_RANGE`, mengikuti perilaku hawk sekarang. Tidak ada HP, animasi kematian, partikel, pack hunting.
- **Klip `run` jadi kemampuan baru `AnimalModel`**: status `Hunting`/`Fleeing` memakai klip Gallop jika spesies punya, fallback ke Walk. Deer/rabbit/hawk tidak berubah perilaku (tidak punya klip run).
- **Fleeing mengalahkan lapar/haus**: mangsa yang melihat predator berhenti makan/minum dan kabur. Makan bisa ditunda, dimakan tidak.
- **Tiga krisis ekosistem DI LUAR SCOPE** — bagian terakhir milestone Hari 6–9, plan terpisah.

## Global Constraints

- Stack tetap. Jangan tambah dependency, physics engine, atau state library baru.
- React state hanya untuk data yang memengaruhi UI; semua data per-frame di ref (aturan repo, lihat `docs/feature/prototype/prototype.md`).
- Satu pass atas `liveAnimals` per hewan per frame. `MAX_POPULATION = 24`, jadi maksimum 24×24 perbandingan jarak — murah, tapi jangan menambah loop kedua.
- Semua angka tuning jadi konstanta bernama di `simulation.ts`, bukan hardcode di `Animal.tsx`.
- Proyek ini belum punya automated test. Verifikasi = `rtk npm run lint` + `rtk npm run build` + pengamatan browser (pola semua milestone sebelumnya).
- Kalibrasi model (`modelScale`, `modelRotY`, `modelYOffset`, `selectionRadius`) WAJIB diverifikasi visual di browser, bukan ditebak dari angka bounding box saja.
- Pertahankan perilaku hewan yang sekarang: flocking, obstacle avoidance, POV keyboard control, hawk terbang (`neverStops`), aturan locomotion aquatic/amphibian/terrestrial.

## Strategi Git

- Kerjakan di branch `andino/feat/predator-prey` (sudah dibuat dari `origin/main`, sudah aktif).
- Commit mengikuti pola repo: Conventional Commits (`feat: ...`).
- **Tidak ada commit per task.** Semua perubahan dikerjakan dulu, user test manual di browser, dan commit hanya dilakukan sekali di akhir (Task 6) setelah user menyetujui. Jangan commit tanpa persetujuan user.

---

## File Structure

**Modify:**
- `src/components/prototype/simulation.ts` - tambah konstanta tuning predator–prey dan mailbox `killRewards`. Tanggung jawab tetap: konstanta & tipe simulasi bersama.
- `src/components/prototype/Animal.tsx` - restrukturisasi sense pass (kill check setiap frame, flee override seeking, klaim kill reward, timer makan mangsa). Tanggung jawab tetap: perilaku per-hewan.
- `src/components/prototype/species.ts` - tambah `run?` di tipe animations, entry spesies wolf, spawn wolf. Tanggung jawab tetap: data spesies.
- `src/components/prototype/AnimalModel.tsx` - `clipFor` mendukung klip `run` untuk status Hunting/Fleeing. Tanggung jawab tetap: pemilihan model & klip animasi.
- `src/components/prototype/BiodiversityPrototype.tsx` - baris "Prey" di panel untuk spesies predator. Tanggung jawab tetap: overlay UI.
- `docs/project/prd.md` - update status milestone (di Task 6, setelah verifikasi).

**Create:**
- `docs/feature/predator-prey/predator-prey.md` - handoff doc (di Task 6, setelah verifikasi).

**Tidak ada file komponen baru.** Wolf memakai `Animal` + `AnimalModel` yang sudah ada, murni lewat data spesies.

---

## Task 0: Verifikasi branch dan asset

**Files:** tidak ada perubahan file. Hanya verifikasi.

**Interfaces:**
- Produces: branch `andino/feat/predator-prey` aktif, working tree bersih (di luar `docs/feature/predator-prey/`), asset wolf terkonfirmasi ada.

- [ ] **Step 1: Pastikan branch aktif**

Run: `rtk git status`
Expected: `On branch andino/feat/predator-prey`. Perubahan yang boleh ada hanya folder `docs/feature/predator-prey/` (dokumen plan ini).

- [ ] **Step 2: Pastikan asset wolf ada**

Run: `rtk proxy powershell -NoProfile -Command "Get-ChildItem 'public/assets/animal/wolf'"`
Expected: `wolf.glb` dan `thumbnail.jpg` terdaftar.

---

## Task 1: Konstanta predator–prey dan mailbox killRewards di simulation.ts

**Files:**
- Modify: `src/components/prototype/simulation.ts`

**Interfaces:**
- Consumes: tidak ada (murni penambahan konstanta/ekspor baru).
- Produces: `KILL_RANGE: number` (0.8), `HUNT_HUNGER_THRESHOLD: number` (30), `KILL_HUNGER_RESTORE: number` (65), `EAT_PREY_DURATION: number` (4), `HEARING_RANGE: number` (3), `killRewards: Map<string, number>` (key = id predator, value = jumlah kill yang belum diklaim). Task 2 bergantung pada nama-nama ini.

- [ ] **Step 1: Tambah konstanta dan mailbox**

Di `src/components/prototype/simulation.ts`, tambahkan setelah deklarasi `liveAnimals`:

```ts
// ---- Predator–prey tuning -------------------------------------------------
// Jarak predator–mangsa yang mengakibatkan kill instan.
export const KILL_RANGE = 0.8;
// Predator hanya berburu ketika hunger di atas ambang ini.
export const HUNT_HUNGER_THRESHOLD = 30;
// Hunger predator berkurang sebesar ini untuk tiap mangsa yang dibunuh.
export const KILL_HUNGER_RESTORE = 65;
// Lama (detik-simulasi) predator berstatus Eating setelah membunuh.
export const EAT_PREY_DURATION = 4;
// Dalam jarak ini hewan "mendengar" hewan lain meski di luar FOV penglihatan.
export const HEARING_RANGE = 3;

// Mailbox antar-hewan: komponen Animal hanya boleh memutasi ref miliknya
// sendiri, jadi mangsa yang mati menulis id pembunuhnya ke sini dan predator
// mengklaimnya di awal frame berikutnya (hunger turun + status Eating).
export const killRewards = new Map<string, number>();
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `rtk npm run lint`
Expected: lulus. (Konstanta belum dipakai — `killRewards` dan kawan-kawan di-export sehingga tidak kena no-unused-vars.)

---

## Task 2: Restrukturisasi sense pass di Animal.tsx

**Files:**
- Modify: `src/components/prototype/Animal.tsx`

**Interfaces:**
- Consumes: `killRewards`, `KILL_RANGE`, `HUNT_HUNGER_THRESHOLD`, `KILL_HUNGER_RESTORE`, `EAT_PREY_DURATION`, `HEARING_RANGE` dari Task 1; `liveAnimals`, `canSee`, `getSpecies` yang sudah ada.
- Produces: perilaku runtime — (a) predator yang membunuh mendapat hunger turun dan berstatus `Eating` selama `EAT_PREY_DURATION`; (b) mangsa bisa dibunuh dan kabur di semua status non-selected (termasuk `Eating`/`Drinking`/`Seeking`); (c) angka hardcode `0.8` dan `30` hilang, diganti konstanta.

Konteks kode saat ini: seluruh loop `liveAnimals` (kill check, flee, hunt, flocking) berada di cabang `else` paling dalam — hanya berjalan ketika hewan TIDAK sedang seeking/eating/drinking. Itu sebabnya mangsa yang makan kebal. Restrukturisasi: satu fungsi sense dipanggil sekali per frame sebelum logika kebutuhan, hasilnya dipakai lintas cabang.

- [ ] **Step 1: Perbarui import dari simulation**

Tambahkan ke daftar import `./simulation` di `Animal.tsx`:

```ts
  killRewards,
  KILL_RANGE,
  HUNT_HUNGER_THRESHOLD,
  KILL_HUNGER_RESTORE,
  EAT_PREY_DURATION,
  HEARING_RANGE,
```

- [ ] **Step 2: Tambah field timer di motion ref**

Di objek `useRef({ ... })` `motion`, tambahkan setelah `wellFedTimer: 0,`:

```ts
    // Sisa waktu predator "memakan" mangsanya setelah kill (status Eating).
    eatPreyTimer: 0,
```

- [ ] **Step 3: Ekstrak sense pass menjadi fungsi module-level**

Tambahkan fungsi berikut di `Animal.tsx` (setelah `canSee`, sebelum komponen `Animal`):

```ts
interface SenseResult {
  // Id predator yang berada dalam KILL_RANGE (mangsa mati frame ini).
  killerId: string | null;
  // Akumulasi arah menjauh dari ancaman/kerumunan (untuk Fleeing/separation).
  fleeX: number;
  fleeZ: number;
  threatCount: number;
  // Posisi mangsa terdekat yang terlihat (untuk Hunting), null jika tak ada.
  preyX: number | null;
  preyZ: number | null;
  // Akumulasi flocking sesama spesies (cohesion + alignment).
  friendsX: number;
  friendsZ: number;
  friendsHeading: number;
  friendsCount: number;
}

// Satu pass atas liveAnimals per hewan per frame: kill check, deteksi
// ancaman, pemilihan mangsa, dan data flocking sekaligus.
function sense(
  selfId: string,
  m: { x: number; z: number; heading: number; hunger: number },
  species: Species
): SenseResult {
  const r: SenseResult = {
    killerId: null,
    fleeX: 0,
    fleeZ: 0,
    threatCount: 0,
    preyX: null,
    preyZ: null,
    friendsX: 0,
    friendsZ: 0,
    friendsHeading: 0,
    friendsCount: 0,
  };
  let nearestPreyDist = Infinity;

  for (const [id, state] of liveAnimals.entries()) {
    if (id === selfId) continue;

    const dist = Math.hypot(state.x - m.x, state.z - m.z);
    const otherSpecies = getSpecies(state.speciesId);

    // Kill check: berlaku selalu, apa pun status mangsa.
    if (otherSpecies.predatorOf?.includes(species.id) && dist < KILL_RANGE) {
      r.killerId = id;
      return r;
    }

    // Sisanya butuh persepsi: terlihat (FOV + jarak) atau terdengar.
    if (dist > HEARING_RANGE && !canSee(m.x, m.z, m.heading, state.x, state.z, species)) {
      continue;
    }

    if (state.speciesId === species.id) {
      if (dist < 5) {
        r.friendsX += state.x;
        r.friendsZ += state.z;
        r.friendsHeading += state.heading;
        r.friendsCount++;
      }
      if (dist < KILL_RANGE) {
        r.fleeX += m.x - state.x;
        r.fleeZ += m.z - state.z;
      }
    } else if (species.predatorOf?.includes(state.speciesId)) {
      // Predator lapar memilih mangsa terlihat yang paling dekat.
      if (m.hunger > HUNT_HUNGER_THRESHOLD && dist < nearestPreyDist) {
        nearestPreyDist = dist;
        r.preyX = state.x;
        r.preyZ = state.z;
      }
    } else if (otherSpecies.predatorOf?.includes(species.id) || dist < HEARING_RANGE) {
      r.threatCount++;
      r.fleeX += m.x - state.x;
      r.fleeZ += m.z - state.z;
    }
  }

  return r;
}
```

Catatan: ini menggantikan loop inline yang ada sekarang (deklarasi `strangersCount`, `fleeX`, `friendsX`, `preyTargetX`, `isDead`, dan `for (const [id, state] of liveAnimals.entries())` beserta isinya). Perbedaan perilaku yang disengaja: mangsa terdekat dipilih (sebelumnya: mangsa terakhir dalam iterasi Map), dan konstanta menggantikan angka 0.8 / 3 / 30.

- [ ] **Step 4: Panggil sense + eksekusi kematian & klaim reward di awal blok dt**

Di dalam `useFrame`, di dalam `if (dt > 0) {`, SEBELUM `if (selected)`, tambahkan:

```ts
      // Sense pass: berjalan setiap frame agar mangsa yang sedang makan/minum
      // tetap bisa diserang dan tetap kabur.
      const senseResult = selected ? null : sense(spawn.id, m, species);

      if (senseResult?.killerId) {
        killRewards.set(
          senseResult.killerId,
          (killRewards.get(senseResult.killerId) ?? 0) + 1
        );
        m.hasDied = true;
        liveAnimals.delete(spawn.id);
        onDeath(spawn.id);
        return;
      }

      // Klaim hasil buruan yang ditulis mangsa pada frame kematiannya.
      const claimed = killRewards.get(spawn.id);
      if (claimed) {
        killRewards.delete(spawn.id);
        m.hunger = Math.max(0, m.hunger - KILL_HUNGER_RESTORE * claimed);
        m.eatPreyTimer = EAT_PREY_DURATION;
      }
      if (m.eatPreyTimer > 0) m.eatPreyTimer = Math.max(0, m.eatPreyTimer - dt);
```

Hewan yang sedang dikontrol manual (`selected`, POV mode) sengaja dikecualikan dari sense — perilaku sekarang dipertahankan.

- [ ] **Step 5: Terapkan prioritas Fleeing dan Eating-prey di cabang otonom**

Di cabang `else` (non-selected), susun ulang logika menjadi urutan prioritas berikut. Kerangka (kode kebutuhan/seeking yang ada dipindah ke cabang terakhir, tidak ditulis ulang):

```ts
      } else if (m.eatPreyTimer > 0) {
        // Baru membunuh: berhenti dan makan mangsanya.
        m.status = "Eating";
        // moving=false untuk semua kecuali spesies neverStops (hawk).
      } else if (senseResult!.threatCount > 0 && species.locomotion !== "aquatic") {
        // Ancaman terlihat/terdengar: kabur, override lapar/haus.
        m.status = "Fleeing";
        m.headingTarget = Math.atan2(senseResult!.fleeX, senseResult!.fleeZ);
      } else if (senseResult!.preyX !== null && senseResult!.preyZ !== null) {
        // Predator lapar: kejar mangsa terdekat.
        m.status = "Hunting";
        m.headingTarget = Math.atan2(
          senseResult!.preyX - m.x,
          senseResult!.preyZ - m.z
        );
      } else {
        // ... logika yang SUDAH ADA: drinking/eating/seeking/wander/flocking,
        // dengan data flocking sekarang dibaca dari senseResult (friendsX,
        // friendsZ, friendsHeading, friendsCount) alih-alih variabel loop lama.
      }
```

Detail integrasi yang wajib dijaga:
- `moving` untuk cabang `eatPreyTimer` mengikuti pola konsumsi yang ada: `if (!species.neverStops) moving = false;` sehingga hawk tetap terbang.
- Speed multiplier yang sudah ada (`Fleeing` 2.5×, `Hunting` 2.0×) tidak berubah.
- Blok wander/idle dan flocking yang ada dipertahankan apa adanya, hanya sumber datanya berpindah ke `senseResult`.
- Cabang seeking food/water yang lama tetap utuh di dalam cabang terakhir.

- [ ] **Step 6: Verifikasi kompilasi**

Run: `rtk npm run lint`
Expected: lulus tanpa error/warning. Tidak ada lagi angka `0.8` atau `30` hardcode pada logika predator di `Animal.tsx` (cek dengan `rtk grep -n "0.8" src/components/prototype/Animal.tsx`).

- [ ] **Step 7: Smoke test perilaku dengan hawk (predator existing)**

Jalankan `rtk npm run dev`, buka halaman, amati (pakai 4× agar cepat):
1. Hawk lapar memburu rabbit → rabbit hilang (mati) → klik hawk: bar Hunger turun drastis dan status `Eating` sesaat.
2. Rabbit yang sedang `Eating` di petak makanan tetap kabur saat hawk mendekat, dan bisa mati bila tertangkap.
3. Sensus populasi di header berkurang saat ada kill; jika hewan yang terpilih mati, panel deselect otomatis (perilaku existing tetap jalan).

---

## Task 3: Spesies wolf + dukungan klip run

**Files:**
- Modify: `src/components/prototype/species.ts`
- Modify: `src/components/prototype/AnimalModel.tsx`

**Interfaces:**
- Consumes: pipeline `AnimatedModel` (SkeletonUtils clone + useAnimations) yang sudah ada; klip GLB wolf: `Walk`, `Gallop`, `Eating`, `Idle` (hasil inspeksi, lihat Konteks Keputusan).
- Produces: `Species.animations.run?: string` (dipakai `clipFor` untuk status `Hunting`/`Fleeing`); entry `SPECIES` id `"wolf"` dengan `predatorOf: ["deer", "rabbit"]`; spawn `wolf-1` di `ANIMAL_SPAWNS`. Preload GLB otomatis (loop `useGLTF.preload` di `AnimalModel.tsx` membaca `SPECIES`).

- [ ] **Step 1: Tambah `run` di tipe animations**

Di interface `Species` di `species.ts`, blok `animations`, tambahkan:

```ts
  animations?: {
    walk: string;
    eat?: string;
    idle?: string;
    // Klip cepat untuk status Hunting/Fleeing (mis. Gallop); fallback ke walk.
    run?: string;
  };
```

- [ ] **Step 2: Pakai klip run di clipFor**

Di `AnimalModel.tsx`, fungsi `clipFor`, tambahkan SEBELUM baris return default (`// By default, the animal is moving ...`):

```ts
  if (status === "Hunting" || status === "Fleeing") {
    return anims.run || anims.walk || anims.idle || Object.keys(actions)[0] || null;
  }
```

Catatan: deer/rabbit/hawk tidak punya `run`, jadi jalur fallback membuat perilaku mereka identik dengan sekarang.

- [ ] **Step 3: Tambah entry spesies wolf**

Di array `SPECIES` di `species.ts`, tambahkan setelah entry deer:

```ts
  {
    id: "wolf",
    name: "Wolf",
    habitat: "Wooded hills",
    locomotion: "terrestrial",
    diet: "Deer & rabbits",
    modelUrl: "/assets/animal/wolf/wolf.glb",
    // Bbox mentah GLB ~5.55 panjang / ~2.67 tinggi; 0.13 menghasilkan ukuran
    // sedikit di atas deer. KALIBRASI VISUAL di Step 5 sebelum dianggap final.
    modelScale: 0.13,
    modelYOffset: 0,
    modelRotY: 0,
    animated: true,
    animations: { walk: "Walk", run: "Gallop", eat: "Eating", idle: "Idle" },
    selectionRadius: 0.38,
    // Lebih lambat dari deer saat santai; menang saat mengejar berkat
    // speed multiplier Hunting 2.0x.
    moveSpeed: 0.9,
    turnSpeed: 2.0,
    hungerRate: 1.2,
    thirstRate: 1.4,
    consumeRate: 18,
    predatorOf: ["deer", "rabbit"],
    sightDistance: 12,
  },
```

- [ ] **Step 4: Tambah spawn wolf**

Di `ANIMAL_SPAWNS` di `species.ts`, tambahkan:

```ts
  { id: "wolf-1", speciesId: "wolf", label: "Wolf #1", x: -4.8, z: 2.4, heading: 2.6 },
```

Satu wolf dulu. Roster jadi 13 individu — masih jauh di bawah `MAX_POPULATION` 24. Wolf kedua hanya ditambah jika balancing Task 5 menunjukkan tekanan predasi terlalu rendah.

- [ ] **Step 5: Kalibrasi visual di browser**

Jalankan `rtk npm run dev`, klik wolf, lalu verifikasi dan sesuaikan di `species.ts` bila meleset:
1. **Ukuran** (`modelScale`): wolf sedikit lebih besar dari deer, jelas lebih kecil dari horse.
2. **Arah hadap** (`modelRotY`): saat berjalan, kepala di depan. Jika mundur, set `Math.PI`.
3. **Pijakan** (`modelYOffset`): keempat kaki menyentuh tanah, tidak melayang/terbenam.
4. **Ring seleksi** (`selectionRadius`): melingkari tapak tubuh, tidak lebih lebar dari torso.
5. **Animasi**: Walk saat Roaming, Gallop saat Hunting/Fleeing, Eating setelah membunuh, Idle saat diam; Pause membekukan pose, 4× mempercepat.

- [ ] **Step 6: Verifikasi kompilasi**

Run: `rtk npm run lint`
Expected: lulus.

---

## Task 4: Baris "Prey" di panel informasi

**Files:**
- Modify: `src/components/prototype/BiodiversityPrototype.tsx`

**Interfaces:**
- Consumes: `selectedSpecies.predatorOf` (Task 3 mengisinya untuk wolf; hawk sudah punya), `SPECIES_BY_ID` dari `species.ts`.
- Produces: baris `Prey` di `<dl>` panel, hanya tampil untuk spesies predator.

- [ ] **Step 1: Tambah baris Prey**

Di `BiodiversityPrototype.tsx`, di dalam `<dl>` panel detail, setelah blok baris `Diet` (`<div className="flex justify-between gap-2">...Diet...</div>`), tambahkan:

```tsx
            {selectedSpecies.predatorOf && (
              <div className="flex justify-between gap-2">
                <dt className="text-slate-400">Prey</dt>
                <dd className="text-right">
                  {selectedSpecies.predatorOf
                    .map((id) => SPECIES_BY_ID[id]?.name ?? id)
                    .join(", ")}
                </dd>
              </div>
            )}
```

Pastikan `SPECIES_BY_ID` ada di import dari `./species`; tambahkan jika belum.

- [ ] **Step 2: Verifikasi di browser**

Klik wolf → baris `Prey: Deer, Rabbit` tampil. Klik hawk → `Prey: Rabbit, Duck, Fish`. Klik deer → tidak ada baris Prey.

---

## Task 5: Balancing populasi

**Files:**
- Modify (hanya jika perlu): konstanta di `src/components/prototype/simulation.ts`, angka spesies wolf di `src/components/prototype/species.ts`.

**Interfaces:**
- Consumes: seluruh hasil Task 1–4.
- Produces: konstanta tuning final yang memenuhi kriteria PRD "ekosistem berubah tanpa skrip linear, tetap stabil".

- [ ] **Step 1: Jalankan simulasi ±10 menit pada 4×**

Run: `rtk npm run dev`, biarkan berjalan, amati sensus populasi di header.

Kriteria lulus:
1. Deer dan rabbit tidak punah total (reproduksi sanggup mengimbangi predasi).
2. Wolf tidak mati kelaparan terus-menerus (sesekali boleh — itu ekosistem).
3. Tidak ada osilasi ekstrem: populasi tidak jatuh ke 0 lalu meledak ke cap 24 berulang-ulang.

- [ ] **Step 2: Sesuaikan konstanta bila gagal — jangan tambah aturan baru**

Urutan tuning (satu perubahan per iterasi, ulangi Step 1):
- Prey punah terlalu cepat → naikkan `HUNT_HUNGER_THRESHOLD` (30 → 45) ATAU turunkan `sightDistance` wolf (12 → 9).
- Wolf selalu mati lapar → naikkan `KILL_HUNGER_RESTORE` (65 → 80) ATAU turunkan `hungerRate` wolf (1.2 → 1.0).
- Mangsa terlalu mudah lolos → biarkan; kill rate rendah lebih sehat daripada pemusnahan. Jangan menaikkan `moveSpeed` wolf melebihi mangsanya di kondisi normal.

- [ ] **Step 3: Catat nilai final**

Nilai konstanta hasil tuning dicatat untuk ditulis di handoff doc (Task 6).

---

## Task 6: Lint, build, dokumentasi, dan commit final (tunggu persetujuan user)

**Files:**
- Create: `docs/feature/predator-prey/predator-prey.md`
- Modify: `docs/project/prd.md`

**Interfaces:**
- Consumes: hasil verifikasi manual user atas Task 2–5.
- Produces: satu commit di branch `andino/feat/predator-prey` mencakup semua perubahan.

**PENTING:** Commit hanya setelah user menyelesaikan test manual dan secara eksplisit menyetujui. Jangan commit tanpa persetujuan.

- [ ] **Step 1: Lint dan build penuh**

Run: `rtk npm run lint` lalu `rtk npm run build`
Expected: keduanya lulus tanpa error/warning.

- [ ] **Step 2: User test manual**

Serahkan ke user untuk verifikasi di browser: skenario Task 2 Step 7, kalibrasi Task 3 Step 5, panel Task 4 Step 2, dan stabilitas Task 5. Tunggu persetujuan eksplisit.

- [ ] **Step 3: Tulis handoff doc**

Buat `docs/feature/predator-prey/predator-prey.md` mengikuti pola `docs/feature/dynamic-terrain/dynamic-terrain.md`: ringkasan, keputusan teknis (mailbox `killRewards`, sense pass per frame, prioritas Fleeing > kebutuhan, klip run), nilai konstanta final, hasil validasi (lint/build/browser), known limitations (kill instan tanpa animasi Attack, wolf tunggal, hewan selected kebal sense), dan arah langkah berikutnya (tiga krisis ekosistem).

- [ ] **Step 4: Update PRD**

Di `docs/project/prd.md`: baris `In Progress (Hari 6–9, lanjutan)` dipecah — predator–mangsa menjadi `Implemented` dengan evidence path (`src/components/prototype/simulation.ts`, `Animal.tsx`, `species.ts`, `AnimalModel.tsx`; lihat `docs/feature/predator-prey/predator-prey.md`), tiga krisis ekosistem tetap `In Progress`/`Planned`. Update juga baris tabel Timeline Hari 6–9 dan paragraf baseline di Overview.

- [ ] **Step 5: Review perubahan sebelum commit**

Run: `rtk git status` lalu `rtk git diff`
Expected: hanya file yang direncanakan: `simulation.ts`, `Animal.tsx`, `species.ts`, `AnimalModel.tsx`, `BiodiversityPrototype.tsx`, `docs/feature/predator-prey/*`, `docs/project/prd.md`. Tidak ada file liar.

- [ ] **Step 6: Commit sekali**

```bash
git add src/components/prototype/simulation.ts \
        src/components/prototype/Animal.tsx \
        src/components/prototype/species.ts \
        src/components/prototype/AnimalModel.tsx \
        src/components/prototype/BiodiversityPrototype.tsx \
        docs/feature/predator-prey/ \
        docs/project/prd.md
git commit -m "feat: implement predator-prey ecosystem with wolf and kill rewards"
```

Run: `rtk git log --oneline -1`
Expected: commit teratas adalah pesan di atas.

Catatan: push dan PR menyusul sesuai permintaan user. Jangan push tanpa diminta.

---

## Self-Review (dijalankan setelah semua task)

1. **Cakupan kriteria prompt (`predator-prey-prompt.md`):** reward kill (Task 1+2), serangan menembus status makan/minum + flee override (Task 2), wolf predator darat terkalibrasi (Task 3), baris Prey (Task 4), balancing (Task 5), lint/build/dokumentasi (Task 6). Lengkap.
2. **Konsistensi nama:** `killRewards`, `KILL_RANGE`, `HUNT_HUNGER_THRESHOLD`, `KILL_HUNGER_RESTORE`, `EAT_PREY_DURATION`, `HEARING_RANGE` identik antara Task 1 (definisi) dan Task 2 (pemakaian); `animations.run` identik antara Task 3 Step 1 (tipe) dan Step 2 (`clipFor`) dan Step 3 (data wolf); nama klip `Walk`/`Gallop`/`Eating`/`Idle` sesuai hasil inspeksi GLB nyata.
3. **Regresi:** hawk (neverStops), flocking, POV keyboard, locomotion aquatic tetap lewat jalur kode existing; deer/rabbit tanpa klip `run` jatuh ke fallback `walk` sehingga identik dengan sebelum perubahan.
4. **Aturan repo:** tidak ada React state baru untuk data per-frame (mailbox = Map module-level, timer = ref), satu pass `liveAnimals`, konstanta bernama, lint+build sebelum milestone.

## Catatan lanjutan (bukan bagian eksekusi sekarang)

- **Tiga krisis ekosistem** (kekeringan, overpopulasi, wabah — bentuk final ditentukan saat brainstorming): bagian terakhir milestone Hari 6–9, plan terpisah setelah fitur ini stabil.
- **Animasi Attack/Death wolf**: klipnya sudah ada di GLB. Bisa dipakai nanti untuk polish (Hari 10–12) dengan menambah status/transisi kill yang tidak instan. Jangan dikerjakan sekarang.
- **Hewan selected kebal sense**: mode POV membuat hewan yang dikontrol user tidak bisa dimangsa. Diterima sebagai batasan sadar; ditinjau ulang saat fase balancing Hari 10–12.
