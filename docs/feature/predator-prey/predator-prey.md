# Predator–Prey — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [predator-prey-prompt.md](./predator-prey-prompt.md), rencana di [predator-prey-plan.md](./predator-prey-plan.md) dan [technical plan/2026-07-06-predator-prey.md](./technical%20plan/2026-07-06-predator-prey.md). Fitur ini melengkapi fondasi predator–mangsa yang diletakkan commit "enhance animal AI" (`predatorOf`, `canSee`, status `Hunting`/`Fleeing`, registry `liveAnimals`) — bukan membangun ulang.

## Ringkasan

Predator kini benar-benar mendapat imbalan dari berburu: hunger turun dan status berubah `Eating` sejenak setelah membunuh, lewat mailbox `killRewards` di `simulation.ts` (mangsa menulis saat mati, predator mengklaim di frame berikutnya — komponen `Animal` hanya boleh memutasi ref miliknya sendiri). Kill check dan reaksi kabur dipindah ke sense pass yang berjalan setiap frame di luar cabang wander, sehingga mangsa yang sedang makan/minum tidak lagi kebal — Fleeing sekarang mengalahkan seeking food/water. Wolf ditambahkan sebagai predator darat baru (`predatorOf: ["deer", "rabbit"]`), memakai pipeline GLB beranimasi yang sama dengan deer/horse, dengan klip `Gallop` sebagai kemampuan baru `run` untuk status Hunting/Fleeing.

## Struktur File

```
src/components/prototype/
  simulation.ts              → BARU: KILL_RANGE, HUNT_HUNGER_THRESHOLD, KILL_HUNGER_RESTORE,
                               EAT_PREY_DURATION, HEARING_RANGE, mailbox killRewards
  Animal.tsx                 → BARU: SenseResult + sense() module-level (satu pass liveAnimals per
                               hewan per frame — kill check, threat/prey/flocking sekaligus);
                               eksekusi kematian + klaim reward di awal useFrame; prioritas cabang
                               non-selected: Eating(pasca-kill) > Fleeing > Hunting > kebutuhan lama
  species.ts                 → animations.run? baru (klip cepat Hunting/Fleeing); entry spesies
                               "wolf" + spawn wolf-1; SPECIES_BY_ID diekspor
  AnimalModel.tsx            → clipFor: status Hunting/Fleeing pakai anims.run, fallback ke walk/idle
  BiodiversityPrototype.tsx  → baris "Prey" di panel untuk spesies dengan predatorOf
```

## Data & Konstanta

| Item | Nilai | Arti |
| --- | --- | --- |
| `KILL_RANGE` | 0.8 | Jarak predator–mangsa yang mengakibatkan kill instan (sama seperti perilaku hawk sebelumnya) |
| `HUNT_HUNGER_THRESHOLD` | 55 (semula 30, dinaikkan saat balancing) | Predator hanya mulai mengejar mangsa terlihat di atas ambang hunger ini |
| `KILL_HUNGER_RESTORE` | 65 | Hunger predator berkurang sebesar ini per mangsa yang dibunuh |
| `EAT_PREY_DURATION` | 4 | Detik-simulasi predator berstatus `Eating` setelah kill |
| `HEARING_RANGE` | 3 | Jarak "mendengar" hewan lain meski di luar FOV penglihatan (dipakai di gerbang persepsi `sense()`, bukan lagi untuk trigger Fleeing — lihat Keputusan Teknis) |
| Wolf: `modelScale`/`modelRotY`/`modelYOffset`/`selectionRadius` | 0.13 / 0 / 0 / 0.38 | Dikalibrasi visual di browser (bukan ditebak dari bounding box) — ukuran sedikit di atas deer, jelas di bawah horse; kaki menapak tanah; orientasi mengikuti arah gerak |
| Wolf: `animations` | `{ walk: "Walk", run: "Gallop", eat: "Eating", idle: "Idle" }` | Nama klip hasil inspeksi GLB aktual (`wolf.glb`, FBX2glTF, tanpa texture) |

## Keputusan Teknis

### Mailbox `killRewards`, bukan mutasi silang antar-komponen
Setiap komponen `Animal` hanya memutasi ref miliknya sendiri (pola ref per-frame proyek ini). Mangsa yang terbunuh menulis `killRewards.set(predatorId, count+1)` sebelum mati; predator mengklaimnya di awal frame berikutnya (`killRewards.get(spawn.id)`), mengubah hunger dan `eatPreyTimer` miliknya sendiri. Map module-level ini dipilih alih-alih React state karena datanya murni per-frame dan tidak memengaruhi UI kecuali lewat efek tak langsung (hunger, status).

### Sense pass tunggal per hewan per frame, bukan loop terpisah untuk tiap keputusan
Fungsi `sense()` menggantikan loop inline lama yang sebelumnya hanya berjalan di cabang wander (sehingga mangsa yang sedang makan/minum kebal). Sekarang `sense()` dipanggil sekali di awal `useFrame` (sebelum `if (selected)`), hasilnya (`killerId`, `threatCount`, `preyX/Z`, data flocking) dipakai lintas cabang. Kill check berjalan **selalu**, apa pun status mangsa. Populasi maksimum 24 menjaga 24×24 perbandingan jarak tetap murah — sengaja tidak menambah loop kedua.

### Prioritas Eating(pasca-kill) > Fleeing > Hunting > kebutuhan/wander
Predator yang baru membunuh berhenti sejenak (status `Eating`, `moving=false` kecuali `neverStops` seperti hawk). Ancaman nyata memaksa Fleeing, mengalahkan seeking food/water — lapar/haus bisa ditunda, dimakan tidak. Predator lapar yang melihat mangsa berpindah ke Hunting. Baru setelah itu logika drinking/eating/seeking/wander lama (tidak diubah) yang menentukan.

### Bugfix di luar rencana asli: `threatCount` harus mensyaratkan relasi predator sungguhan
Kode di technical plan (Step 3, `sense()`) menulis kondisi ancaman sebagai `otherSpecies.predatorOf?.includes(species.id) || dist < HEARING_RANGE` — bagian `|| dist < HEARING_RANGE` membuat **hewan spesies lain mana pun** yang kebetulan berjarak < 3 unit dianggap ancaman, walau bukan predator sungguhan. Diverifikasi langsung di browser: wolf berstatus `Fleeing` padahal tidak ada predator/mangsa nyata di dekatnya. Ini kemungkinan pendorong utama percepatan penurunan populasi yang teramati saat balancing. Diperbaiki (dengan persetujuan eksplisit user, karena mengubah kode yang persis sesuai teks plan) menjadi hanya `otherSpecies.predatorOf?.includes(species.id)` — `HEARING_RANGE` tetap dipakai di gerbang persepsi (`dist > HEARING_RANGE && !canSee(...)`).

### Kalibrasi wolf lewat Chrome real (bukan browser headless)
Chrome DevTools MCP headless yang tersedia di lingkungan ini tidak mendukung WebGL ("WebGL is not available in this browser"), sehingga kalibrasi visual (ukuran, orientasi, pijakan, ring seleksi) dilakukan lewat skill `browser-harness` yang menyambung ke Chrome asli milik user via CDP, memakai `Page.captureScreenshot` dengan parameter `clip`+`scale` untuk memotong dan memperbesar area kecil layar alih-alih mengandalkan zoom kamera in-app (scroll-wheel sintetis via CDP tidak diterima oleh MapControls di lingkungan ini).

## Validasi

- `npm run lint` → lulus, 39 error/3 warning **pre-existing** tidak berubah (Animal.tsx `prefer-const`/react-hooks, EnvironmentModels.tsx dan IslandScene.tsx react-hooks/immutability-purity dari commit-commit sebelum branch ini) — tidak satu pun berasal dari perubahan predator-prey.
- `npm run build` → lulus (Turbopack compile + TypeScript bersih, static prerender `/`).
- Diverifikasi langsung di Chrome nyata (bukan headless) via skill `browser-harness`:
  - Wolf muncul di peta, terseleksi dengan benar (`Wolf #1`, `Diet: Deer & rabbits`), ukuran/orientasi/pijakan/ring seleksi visual diterima.
  - Panel "Prey" tampil untuk wolf (`Deer, Rabbit`) dan tetap ada untuk hawk; tidak muncul untuk deer/horse/duck/rabbit/fish.
  - Kill reward + status Eating pasca-kill diverifikasi via kode (sense pass) dan tinjauan reviewer per-task; tidak diverifikasi ulang secara visual live karena populasi terlanjur anjlok saat pengamatan (lihat Known Limitations).

## Known Limitations & Bug Kritis (di luar scope)

- **Kolaps populasi total, pre-existing, di luar scope fitur ini.** Dalam pengamatan manual (~1–3 menit real-time pada 1×), seluruh populasi — termasuk horse yang tidak dimangsa siapa pun — mati. Diselidiki dengan A/B test terisolasi (git worktree) terhadap commit dasar sebelum SEMUA pekerjaan predator-prey (`9988494`): kolaps total yang sama terjadi di sana juga, mengonfirmasi ini adalah bug pada sistem kebutuhan/pencarian makanan-air umum (bukan predator-prey) yang sudah ada sejak sebelum branch ini. Hipotesis bahwa obstacle-avoidance (potential field vegetasi) mendominasi arah menuju food/water spot **sudah diuji dan disingkirkan** — `VEGETATION` di `terrain.ts` adalah daftar sparse/deterministik (bukan hutan lebat dekoratif yang terlihat di render), dan menaikkan bobot arah tujuan secara eksperimen (0.4 → 1.6) tidak mengubah hasil kolaps sama sekali (perubahan sudah di-revert). Root cause pastinya **belum ditemukan**. Kriteria PRD "populasi stabil ±10 menit" **tidak terpenuhi** — bukan karena tuning predator-prey, melainkan bug pre-existing ini. Perlu investigasi terpisah dan dedicated (kemungkinan di `sampleGround`/raycasting, reproduksi, atau state kebutuhan) sebelum balancing predator-prey bisa benar-benar diverifikasi selesai.
- **Kill instan tanpa animasi Attack/Death.** Klip `Attack`/`Death` sudah ada di `wolf.glb` tapi belum dipakai; kill tetap instan dalam `KILL_RANGE`, sama seperti hawk.
- **Satu individu wolf.** Roster jadi 13 individu; wolf kedua belum ditambahkan karena balancing belum bisa dituntaskan akibat bug survival di atas.
- **Hewan `selected` (mode POV) kebal sense.** Diterima sebagai batasan sadar sejak Task 2 — direview ulang saat fase balancing berikutnya.
- **Multi-kill serentak hanya menghasilkan satu kredit.** Jika beberapa predator berada dalam `KILL_RANGE` mangsa yang sama di frame yang sama, `sense()` mengembalikan `killerId` pertama yang ditemukan (urutan iterasi `liveAnimals`) — mencerminkan perilaku `break`-on-first-match kode asli, bukan regresi baru.

## Langkah Berikutnya

1. **Investigasi & perbaiki bug kolaps populasi umum** (prioritas tinggi, blocker untuk balancing predator-prey yang sah) — di luar scope plan ini, perlu sesi/branch terpisah.
2. Setelah itu, tuntaskan Task 5 (balancing) yang sebenarnya: jalankan simulasi ±10 menit, pastikan deer/rabbit tidak punah total dan wolf tidak selalu mati kelaparan.
3. **Tiga krisis ekosistem** (kekeringan, overpopulasi, wabah) — bagian terakhir milestone Hari 6–9, plan terpisah setelah fitur ini benar-benar stabil.
