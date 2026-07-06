# Predator–Prey — Implementation Plan

## Context
Fitur ini menyelesaikan bagian "hubungan predator–mangsa" dari milestone Hari 6–9 (lihat `docs/project/prd.md`). Commit `9988494` ("enhance animal AI") sudah meletakkan fondasinya di branch ini:

- `species.ts`: field `predatorOf?: string[]`, `fov`, `sightDistance`; hawk sudah menjadi predator `["rabbit", "duck", "fish"]`.
- `simulation.ts`: status `"Hunting"` dan `"Fleeing"`, registry global `liveAnimals: Map<string, AnimalState>` (posisi, status, heading semua hewan hidup).
- `Animal.tsx`: sistem penglihatan (`canSee`, FOV + jarak), flocking, kill instan saat predator berjarak < 0.8, prey kabur saat melihat predator, speed multiplier Fleeing 2.5× / Hunting 2.0×.

Rencana ini TIDAK membangun ulang sistem itu. Rencana ini menutup empat kekurangan yang membuat predator–prey belum layak disebut hubungan ekosistem:

1. **Predator tidak mendapat apa pun dari membunuh.** Kill dideteksi di sisi mangsa (`isDead`), predator tidak pernah tahu ia berhasil — hunger-nya tidak turun. Berburu saat ini murni kosmetik.
2. **Mangsa yang sedang makan/minum kebal.** Seluruh blok sense (kill check, flee, hunt) berada di cabang `else` setelah logika seeking food/water di `useFrame`. Hewan yang sedang `Eating`/`Drinking` tidak pernah memeriksa predator: tidak bisa dibunuh dan tidak kabur.
3. **Hanya ada satu predator (hawk, udara).** Belum ada predator darat; deer dan horse tidak punya musuh sama sekali.
4. **Tidak ada dokumentasi & PRD belum diupdate.**

## Design & Architecture

### 1. Kill event & reward predator (`simulation.ts`, `Animal.tsx`)
Setiap komponen `Animal` hanya memutasi state dirinya sendiri (pola per-frame ref), jadi mangsa tidak boleh langsung memutasi hunger predator. Gunakan mailbox sederhana di `simulation.ts`:

```ts
// simulation.ts
export const killRewards = new Map<string, number>(); // predatorId -> jumlah kill belum diklaim
export const KILL_RANGE = 0.8;
export const HUNT_HUNGER_THRESHOLD = 30;   // predator mulai berburu di atas ini
export const KILL_HUNGER_RESTORE = 65;     // hunger predator berkurang sebesar ini per kill
export const EAT_PREY_DURATION = 4;        // detik-simulasi predator "Eating" setelah kill
```

Alur:
- Sisi mangsa (sudah ada, dimodifikasi): saat mendeteksi predator berjarak `< KILL_RANGE`, mangsa mati seperti sekarang (`hasDied`, `liveAnimals.delete`, `onDeath`), TAPI sebelum mati ia menulis `killRewards.set(predatorId, (killRewards.get(predatorId) ?? 0) + 1)`. Loop deteksi sudah memegang `id` predator, tinggal disimpan saat `isDead` di-set.
- Sisi predator (baru): di awal `useFrame`, cek `killRewards.get(spawn.id)`. Jika ada, klaim: `m.hunger = Math.max(0, m.hunger - KILL_HUNGER_RESTORE * n)`, hapus entry, set `m.status = "Eating"` dan `m.consumeTimer = EAT_PREY_DURATION` (pakai timer konsumsi yang sudah ada) sehingga predator berhenti sejenak "memakan" mangsanya dan animasi Eat ikut jalan lewat `statusRef` yang sudah dibaca `AnimalModel`.
- Hewan burung (`neverStops`, hawk) tetap terbang saat Eating — perilaku `neverStops` yang ada sudah menangani ini, jangan diubah.

### 2. Kill check & flee keluar dari cabang wander (`Animal.tsx`)
Pindahkan pemeriksaan ancaman ke fase awal `useFrame`, sebelum logika seeking:

- Ekstrak loop `liveAnimals` yang ada menjadi satu pass per frame yang menghasilkan `{ killedBy, nearestThreat, preyTarget, flockData }`.
- `killedBy` (predator dalam `KILL_RANGE`) dieksekusi selalu, apa pun status mangsa.
- `nearestThreat` (predator terlihat via `canSee` atau terdengar `dist < 3`) memaksa `status = "Fleeing"` dan meng-override seeking food/water — lapar bisa ditunda, dimakan tidak.
- Flocking dan pemilihan `preyTarget` tetap hanya berlaku di cabang wander seperti sekarang (predator yang sedang minum tidak perlu mengejar).
- Jaga agar tetap satu iterasi `liveAnimals` per hewan per frame — populasi maksimum 24, jadi 24×24 perbandingan jarak per frame masih murah, tetapi jangan menambah loop kedua.

### 3. Predator darat baru: Wolf (`species.ts`, `public/assets/animal/wolf/`)
Model GLB open-source beranimasi (minimal klip Walk; Run/Attack bonus) disiapkan pemilik proyek di `public/assets/animal/wolf/wolf.glb` + `thumbnail.jpg`, mengikuti pola folder hewan lain. Entry spesies:

```ts
{
  id: "wolf",
  name: "Wolf",
  habitat: "Wooded hills",
  locomotion: "terrestrial",
  diet: "Deer & rabbits",
  modelUrl: "/assets/animal/wolf/wolf.glb",
  modelScale: 1,      // WAJIB dikalibrasi dari bounding box GLB aktual di browser
  modelYOffset: 0,
  modelRotY: 0,
  animated: true,
  animations: { walk: "Walk" }, // WAJIB disesuaikan dengan nama klip GLB aktual
  selectionRadius: 0.4,
  moveSpeed: 0.9,     // sedikit di bawah prey saat normal; menang lewat speed multiplier Hunting 2.0×
  turnSpeed: 2.0,
  hungerRate: 1.2,
  thirstRate: 1.4,
  consumeRate: 18,
  predatorOf: ["deer", "rabbit"],
  sightDistance: 12,
}
```

Tambahkan 1–2 spawn wolf di `ANIMAL_SPAWNS` di area Land. `modelScale`, `modelRotY`, `animations`, dan `selectionRadius` tidak boleh ditebak — periksa GLB di browser dulu (pola yang sama dipakai saat kalibrasi enam spesies di `docs/feature/animal-species/animal-species.md`).

**Kalibrasi balancing agar populasi tidak langsung punah**: wolf hanya berburu saat `hunger > HUNT_HUNGER_THRESHOLD`; setelah kill ia kenyang dan berhenti mengejar. Jika saat verifikasi rabbit/deer habis dalam < 5 menit simulasi, naikkan `HUNT_HUNGER_THRESHOLD` atau turunkan `sightDistance` wolf, bukan menambah aturan baru.

### 4. Panel informasi (`BiodiversityPrototype.tsx`)
- Status `"Hunting"` / `"Fleeing"` sudah tampil lewat pipeline status yang ada — verifikasi saja.
- Tambah satu baris statis di panel untuk spesies predator: `Prey: Deer, Rabbit` (dari `species.predatorOf` di-map ke nama spesies via `SPECIES_BY_ID`). Untuk prey tidak perlu baris baru.

### 5. Dokumentasi
Setelah verifikasi browser: tulis `docs/feature/predator-prey/predator-prey.md` (handoff doc mengikuti pola `dynamic-terrain.md`) dan update `docs/project/prd.md` (status milestone Hari 6–9: predator–mangsa → Implemented dengan evidence path; sisa milestone tinggal tiga krisis ekosistem).

## Yang Sengaja TIDAK Dikerjakan (YAGNI)
- Crocodile / predator aquatic — fish sudah punya predator (hawk); tambah lagi hanya jika balancing menuntut.
- Health/HP, animasi kematian, ragdoll, darah, partikel.
- Attack animation wajib — jika GLB wolf tidak punya klip Attack, kill tetap instan dalam `KILL_RANGE` seperti perilaku hawk sekarang.
- Pack hunting, ambush, stamina, memory posisi mangsa.

## Execution Steps
1. `simulation.ts`: tambah `killRewards`, `KILL_RANGE`, `HUNT_HUNGER_THRESHOLD`, `KILL_HUNGER_RESTORE`, `EAT_PREY_DURATION`; ganti angka hardcode `0.8` dan `30` di `Animal.tsx` dengan konstanta ini.
2. `Animal.tsx`: refactor loop sense — kill check + flee berjalan setiap frame (termasuk saat Eating/Drinking/Seeking); mangsa menulis `killRewards` sebelum mati; predator mengklaim reward di awal frame (hunger turun, status Eating sementara).
3. Verifikasi cepat di browser dengan hawk (predator yang sudah ada): hawk lapar memburu rabbit, rabbit mati, hunger hawk turun, rabbit yang sedang makan tetap bisa diserang.
4. `species.ts`: tambah entry wolf + spawn; kalibrasi `modelScale`/`modelRotY`/`animations`/`selectionRadius` dari GLB aktual di browser. (Prasyarat: `wolf.glb` sudah ada di `public/assets/animal/wolf/`.)
5. `BiodiversityPrototype.tsx`: baris "Prey" di panel untuk spesies dengan `predatorOf`.
6. Balancing: jalankan simulasi ±10 menit; populasi prey tidak boleh punah total dan predator tidak boleh mati kelaparan terus-menerus. Sesuaikan konstanta bila perlu.
7. `npm run lint` dan `npm run build` harus lulus.
8. Tulis `predator-prey.md` dan update `prd.md`.
