# Population Lifecycle — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [population-lifecycle-prompt.md](./population-lifecycle-prompt.md), rencana implementasi di [population-lifecycle-plan.md](./population-lifecycle-plan.md). Fitur ini adalah **langkah ketiga sekaligus penutup fase Hari 3–5 (Simulasi Inti)** pada roadmap, dibangun langsung di atas Simulation Needs ([../simulation-needs/simulation-needs.md](../simulation-needs/simulation-needs.md)).

## Ringkasan

Populasi kini adalah **hasil simulasi, bukan konstanta**. Hewan yang salah satu kebutuhannya bertahan di `NEED_MAX` selama `DEATH_AFTER_CRITICAL` detik-simulasi **mati** dan hilang dari pulau — panel menampilkan status peringatan "Starving"/"Dehydrated" sebelum itu terjadi. Hewan yang kedua kebutuhannya terjaga di bawah `WELL_FED_LEVEL` selama `REPRODUCE_AFTER` detik-simulasi **bereproduksi**: satu anak muncul di dekat induk dengan label lanjutan (mis. "Grazer #4"), dan kebutuhan induk naik `REPRODUCTION_NEED_PENALTY` sebagai biaya. Populasi dibatasi `MAX_POPULATION = 24`. Header menampilkan sensus live ("3 species · N animals"); hewan terpilih yang mati membuat panel tertutup bersih (deselect otomatis).

Tidak ada dependency baru, tidak ada aset eksternal; semua objek 3D tetap geometry bawaan Three.js.

## Struktur File

```
src/components/prototype/
  simulation.ts             → + DEATH_AFTER_CRITICAL, WELL_FED_LEVEL, REPRODUCE_AFTER, MAX_POPULATION,
                              REPRODUCTION_NEED_PENALTY, WALK_RADIUS (pindah dari IslandScene);
                              AnimalStatus + "Starving" | "Dehydrated"
  species.ts                → AnimalSpawn + initialHunger?/initialThirst? (dipakai anak; roster awal
                              tetap deterministik via initialNeed)
  Animal.tsx                → criticalTimer & wellFedTimer (keduanya × dt), guard hasDied,
                              props onDeath/onReproduce, override status Starving/Dehydrated
  IslandScene.tsx           → me-render prop population (bukan ANIMAL_SPAWNS statis), meneruskan callback
  BiodiversityPrototype.tsx → state population (seeded dari ANIMAL_SPAWNS), handler mati/lahir,
                              counter label per spesies, cap, sensus live, spawnById via useMemo
```

## Data & Konstanta

| Konstanta | Nilai | Arti |
| --- | --- | --- |
| `DEATH_AFTER_CRITICAL` | 20 | Detik-simulasi kebutuhan harus mentok di `NEED_MAX` sebelum mati |
| `WELL_FED_LEVEL` | 65 | Kedua kebutuhan harus < ini agar timer reproduksi berjalan |
| `REPRODUCE_AFTER` | 45 | Detik-simulasi well-fed berturut-turut sebelum melahirkan |
| `MAX_POPULATION` | 24 | Batas atas global; reproduksi dilewati diam-diam di cap |
| `REPRODUCTION_NEED_PENALTY` | 25 | Ditambahkan ke lapar + haus induk setelah melahirkan |
| `OFFSPRING_INITIAL_NEED` | 40 | Kebutuhan awal anak (di BiodiversityPrototype) |

## Keputusan Teknis

### `WELL_FED_LEVEL = 65`, bukan 35 seperti rencana awal — deviasi yang disengaja
Rencana menetapkan 35, tetapi itu **tidak akan pernah menghasilkan reproduksi**: kebutuhan berosilasi antara `SATISFIED_LEVEL` (10) dan `SEEK_THRESHOLD` (55) — hewan baru bereaksi di 55, jadi kebutuhan rutin melewati 35 dan timer selalu ke-reset jauh sebelum 45 detik (terverifikasi secara empiris: 240+ detik-simulasi tanpa satu kelahiran). Dengan 65 (di atas ambang seek), timer hanya ke-reset saat perjalanan panjang menuju sumber daya, dan reproduksi teramati dalam ~1–2 menit-simulasi.

### Populasi jadi React state — pengecualian arsitektur yang diizinkan
Mati dan lahir adalah peristiwa struktural yang jarang (beberapa per menit), bukan data per-frame, jadi `setPopulation` pada peristiwa itu konsisten dengan aturan "state per-frame di ref". Callback dipanggil dari `useFrame` (legal — hanya menjadwalkan render) dan diguard supaya terpanggil sekali per peristiwa: `hasDied` untuk mati, reset `wellFedTimer` sebelum `onReproduce` untuk lahir. Cap dicek di dalam functional updater `setPopulation` (satu sumber kebenaran ukuran populasi, aman dari stale state).

### Timer memakai `dt` yang sama
`criticalTimer` dan `wellFedTimer` bertambah dengan `dt = delta * timeScale`, jadi Pause membekukan timer mati/reproduksi lewat mekanisme yang sudah ada, dan 4× mempercepatnya seragam serta frame-rate independent.

### Status Starving/Dehydrated adalah override label, bukan state perilaku
Rantai prioritas perilaku tidak berubah; setelahnya, jika `criticalTimer > 0` status ditimpa "Dehydrated" (haus menang seri) atau "Starving". Hewan tetap berusaha mencapai sumber daya — hanya panelnya yang memberi peringatan.

### Label & id anak deterministik dari counter
Counter per spesies diinisialisasi dari jumlah roster awal (Grazer #3 → anak berikutnya #4), id `${speciesId}-${n}`. Posisi anak = posisi induk + offset tegak-lurus heading (deterministik, tanpa `Math.random()` di luar frame loop), di-clamp ke `WALK_RADIUS`. Anak mulai dengan kebutuhan 40/40 (via field opsional `initialHunger`/`initialThirst` di `AnimalSpawn`) supaya langsung ikut simulasi tanpa instan mati/beranak.

### `WALK_RADIUS` pindah ke `simulation.ts`
`BiodiversityPrototype` butuh nilai ini untuk clamp posisi anak, tetapi tidak boleh meng-import statis dari `IslandScene` (yang dimuat via `dynamic ssr:false`). Konstanta netral seperti ini tempatnya memang di `simulation.ts`.

## Validasi

- `npm run lint` → lulus tanpa error/warning.
- `npm run build` → lulus (compile + TypeScript bersih).
- Diverifikasi di browser (Playwright, dev server, 4×):
  - **Kelahiran**: sensus naik 8 → 24 lalu berhenti tepat di cap; anak ("Strider #10") dapat diseleksi, punya vitals live, dan berperilaku normal.
  - **Kematian** (diuji dengan menaikkan `SEEK_THRESHOLD` sementara ke 999 agar semua hewan kelaparan, lalu dikembalikan): status "Dehydrated" tampil di panel → sensus turun 8 → 5 → 2 → 0 → hewan terpilih yang mati menutup panel bersih tanpa error.
  - **Pause** membekukan posisi, status, dan kedua bar (identik setelah 4 detik); kontrol waktu, seleksi per-id, dan kedua jalur deselect tetap bekerja.
  - 0 error console dari kode aplikasi; 0 request eksternal.
- Warning `THREE.Clock: This module has been deprecated` tetap dari internal react-three-fiber — abaikan (lihat prototype.md).

## Batasan Langkah Ini & Langkah Berikutnya

Batasan: kematian alami jarang terjadi selama sumber daya tak terbatas (hewan hampir selalu sempat makan/minum) — kematian baru relevan saat kompetisi/krisis hadir di fase berikutnya; tidak ada bangkai, animasi kematian, umur, jenis kelamin, atau genetika; reproduksi aseksual berbasis timer; cap global tunggal (tanpa cap per spesies); semua spesies masih memakai mesh primitif yang sama.

Langkah berikutnya (fase Hari 6–9): **tiga bioma**, **enam spesies dengan model GLB** dari `public/assets/animal/` (catatan: hanya deer yang punya animasi), **predator–mangsa**, dan **tiga krisis ekosistem**.
