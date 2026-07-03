# Simulation Needs — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [simulation-needs-prompt.md](./simulation-needs-prompt.md), rencana implementasi di [simulation-needs-plan.md](./simulation-needs-plan.md). Fitur ini adalah **langkah kedua fase Hari 3–5 (Simulasi Inti)** pada roadmap, dibangun langsung di atas Species Roster ([../species-roster/species-roster.md](../species-roster/species-roster.md)).

## Ringkasan

Simulasi sebab-akibat pertama yang dapat diamati: setiap hewan punya kebutuhan **lapar dan haus** (0–100) yang naik seiring waktu simulasi dengan laju per-spesies. Ketika kebutuhan melewati ambang, hewan berjalan ke sumber daya yang tepat (satu kolam air, tiga petak makanan), berhenti mengonsumsi sampai puas, lalu kembali berkeliaran. Header mendapat kontrol waktu **Pause / 1× / 4×**; panel hewan terpilih menampilkan status live ("Roaming", "Seeking water", "Drinking", "Seeking food", "Eating") plus dua bar kebutuhan.

Ini memenuhi PRD FR-006 (kontrol waktu/observasi) dan FR-007 (minimal satu hubungan sebab-akibat). Tidak ada dependency baru, tidak ada aset eksternal; semua objek 3D tetap geometry bawaan Three.js.

## Struktur File

```
src/components/prototype/
  simulation.ts             → (baru) TimeScale, AnimalStatus, ResourceSpot, RESOURCES (1 kolam + 3 petak),
                              konstanta ambang (NEED_MAX, SEEK_THRESHOLD, SATISFIED_LEVEL, CRITICAL_LEVEL),
                              AnimalVitals (menggantikan AnimalPosition sebagai payload ref bersama)
  species.ts                → + hungerRate, thirstRate, consumeRate per spesies
  Animal.tsx                → dt = delta * timeScale untuk SEMUA mutasi; kebutuhan naik per frame;
                              prioritas: konsumsi → cari air → cari makanan → wander; menulis vitals saat terpilih
  IslandScene.tsx           → render kolam + petak makanan dari RESOURCES; meneruskan timeScale & vitalsRef
  BiodiversityPrototype.tsx → state timeScale (0|1|4), tombol Pause/1×/4× (aria-pressed), status live + NeedBar
```

## Data & Konstanta

| Spesies | hungerRate | thirstRate | consumeRate |
| --- | --- | --- | --- |
| Island Grazer | 1.4 | 1.8 | 20 |
| Dune Hopper (tercepat) | 2.0 | 2.5 | 24 |
| Highland Strider (terlambat) | 1.0 | 1.2 | 16 |

Satuan: poin per detik-simulasi. Ambang: `SEEK_THRESHOLD = 55` (mulai mencari), `SATISFIED_LEVEL = 10` (berhenti konsumsi), `CRITICAL_LEVEL = 90` (hanya mengubah warna bar — mati datang di langkah berikutnya), `NEED_MAX = 100`.

Sumber daya deterministik (semua di dalam `WALK_RADIUS` 5.2, tidak menimpa 12 posisi pohon): kolam `(-2.8, -2.6)` radius 1.1; petak makanan `(3.1, 0.2)`, `(-0.6, -1.5)`, `(0.4, 2.2)` radius 0.7.

## Keputusan Teknis

### Semua mutasi memakai `dt = delta * timeScale`
Gerak, timer wander, kenaikan kebutuhan, dan konsumsi semuanya dikali `dt`. Akibatnya Pause (`timeScale = 0`) membekukan seluruh simulasi dalam satu mekanisme, dan 4× mempercepat semuanya seragam serta tetap frame-rate independent. Saat pause, frame loop tetap menulis vitals hewan terpilih supaya panel tetap terbaca.

### Prioritas perilaku per frame (if/else sederhana, bukan state machine class)
1. Sedang `Drinking`/`Eating` di sumber daya dan kebutuhan masih > `SATISFIED_LEVEL` → konsumsi, diam di tempat.
2. `thirst > SEEK_THRESHOLD` → menuju kolam (haus menang karena tumbuh lebih cepat); jika sudah sampai → status `Drinking`.
3. `hunger > SEEK_THRESHOLD` → menuju petak makanan **terdekat**; jika sudah sampai → status `Eating`.
4. Selain itu → wander lama (status `Roaming`).

Konsumsi di-lock ke status (`m.status === "Drinking"`) agar hewan menghabiskan konsumsinya sampai `SATISFIED_LEVEL`, bukan berhenti begitu turun di bawah `SEEK_THRESHOLD` — tanpa lock, hewan akan bolak-balik di tepi ambang. Boundary steer hanya aktif saat `Roaming` (sumber daya semuanya di dalam radius, seek tidak boleh dibelokkan), hard clamp tetap sebagai pengaman terluar.

### Nilai awal kebutuhan bervariasi deterministik
`initialNeed()` diturunkan dari posisi/heading spawn (hash aritmetika sederhana) sehingga 8 hewan tidak serentak mencari sumber daya, tetapi hasilnya sama setiap reload (tidak ada `Math.random()` di luar frame loop — aturan arsitektur lama tetap berlaku).

### `AnimalVitals` menggantikan `AnimalPosition`
Payload ref bersama sekarang `{ x, z, hunger, thirst, status }`, tetap satu ref untuk semua hewan (hanya hewan terpilih yang menulis), tetap dipoll 250 ms oleh `BiodiversityPrototype`. Type pindah dari `Animal.tsx` ke `simulation.ts`.

### Kolam & petak tanpa pointer handler
Mesh sumber daya tidak punya handler sehingga klik di atasnya tetap terhitung `onPointerMissed` → deselect tetap bekerja di seluruh permukaan non-hewan. Header overlay kehilangan `pointer-events-none` karena sekarang berisi tombol.

## Validasi

- `npm run lint` → lulus tanpa error/warning.
- `npm run build` → lulus (compile + TypeScript bersih).
- Diverifikasi di browser (Playwright, dev server, 4×): siklus penuh teramati berulang — bar naik → "Seeking water"/"Seeking food" → "Drinking"/"Eating" → bar turun → "Roaming"; Pause membekukan posisi, status, dan kedua bar (identik setelah 4 detik); seleksi per-id, pindah seleksi, deselect via tombol dan via klik laut tetap bekerja; semua hewan tetap di pulau; 0 error console dari kode aplikasi; 0 request eksternal.
- Warning `THREE.Clock: This module has been deprecated` tetap dari internal react-three-fiber — abaikan (lihat prototype.md).

## Batasan Langkah Ini & Langkah Berikutnya

Batasan: kebutuhan yang mentok di 100 belum berdampak (hewan hanya terus mencari); belum ada mati, reproduksi, batas habitat per spesies; sumber daya tidak habis (kapasitas tak terbatas); `CRITICAL_LEVEL` hanya mengubah warna bar; semua spesies masih memakai mesh primitif yang sama.

Langkah berikutnya (langkah ketiga/terakhir fase Hari 3–5): **mati** ketika kebutuhan bertahan di `NEED_MAX` terlalu lama + **reproduksi sederhana**, memakai sistem kebutuhan ini sebagai fondasi.
