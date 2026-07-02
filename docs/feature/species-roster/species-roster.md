# Species Roster — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [species-roster-prompt.md](./species-roster-prompt.md), rencana implementasi di [species-roster-plan.md](./species-roster-plan.md). Fitur ini adalah **langkah awal fase Hari 3–5 (Simulasi Inti)** pada roadmap; dokumentasi prototype Hari 1–2 ada di [../prototype/prototype.md](../prototype/prototype.md).

## Ringkasan

Satu hewan hardcoded dari prototype digeneralisasi menjadi **populasi multi-spesies berbasis data**: 3 spesies × 8 individu berkeliaran bersamaan di pulau, masing-masing dapat dipilih per-individu (seleksi berbasis id), dengan panel informasi yang membaca data spesies. Header menampilkan ringkasan populasi ("3 species · 8 animals").

Tidak ada dependency baru, tidak ada aset eksternal, tidak ada request jaringan untuk model/gambar. Semua objek 3D tetap dari geometry bawaan Three.js.

## Struktur File

```
src/components/prototype/
  species.ts                → data module: interface Species & AnimalSpawn, SPECIES (3), ANIMAL_SPAWNS (8), getSpecies()
  Animal.tsx                → komponen hewan generik (menggantikan PlaceholderAnimal.tsx yang dihapus)
  IslandScene.tsx           → me-render ANIMAL_SPAWNS.map(...), prop selectedId/onSelect
  BiodiversityPrototype.tsx → state selectedId: string | null, panel data spesies, ringkasan populasi
```

## Data Spesies (`species.ts`)

| Spesies | id | Ukuran (scale) | Kecepatan | Warna |
| --- | --- | --- | --- | --- |
| Island Grazer | `island-grazer` | 1.0 (medium) | 1.2 (medium) | Oranye-cokelat (tampilan Day 1) |
| Dune Hopper | `dune-hopper` | 0.55 (kecil) | 2.1 (cepat) | Putih pasir |
| Highland Strider | `highland-strider` | 1.45 (besar) | 0.7 (lambat) | Biru kelabu |

- `AnimalSpawn` menyimpan `id`, `speciesId`, `label` (mis. "Grazer #2"), posisi `x/z`, dan `heading` awal — semuanya deterministik, tersebar di dalam `WALK_RADIUS` (5.2).
- `getSpecies(speciesId)` melempar error untuk id yang tidak dikenal (data statis, jadi ini hanya penjaga typo saat development).
- 8 individu: 3 Grazer, 3 Hopper, 2 Strider.

## Keputusan Teknis

### Arsitektur gerakan tidak berubah dari Day 1
`Animal.tsx` adalah `PlaceholderAnimal.tsx` yang diparameterisasi: wander setiap 2–5 detik, belokan shortest-arc, boundary steer ke pusat pulau pada 85% `WALK_RADIUS`, hard clamp radius, semua berbasis `delta` (frame-rate independent), semua state per-frame di ref. Yang berubah hanya sumber nilainya: `moveSpeed`/`turnSpeed` dari data spesies, posisi/heading awal dari data spawn, warna/skala dari data spesies. Skala diterapkan pada `<group>`, bukan per-mesh.

### Satu `positionRef` dibagi semua hewan
Panel hanya menampilkan satu hewan, jadi satu ref cukup: frame loop hewan **hanya menulis ke `positionRef` ketika `selected`** — tidak ada 8 tulisan per frame yang tidak dibaca siapa pun. Interval polling 250 ms di `BiodiversityPrototype` tidak berubah dari Day 1 (aktif hanya saat ada seleksi).

Konsekuensi kecil: sesaat setelah memilih hewan, panel bisa menampilkan koordinat lama/0 selama ≤1 frame + 250 ms sampai tulisan pertama dari hewan terpilih masuk. Tidak terasa di pemakaian nyata.

### Seleksi per-id
- `selectedId: string | null` di `BiodiversityPrototype`; `Animal` menerima `selected: boolean` hasil `spawn.id === selectedId`.
- Klik hewan lain langsung memindahkan seleksi (tanpa deselect dulu) karena `onSelect(id)` menimpa `selectedId`.
- Deselect: `onPointerMissed` di Canvas (klik laut/terrain — terrain tidak punya handler sehingga tetap terhitung "missed") + tombol Deselect.
- Emissive saat terpilih memakai `species.accentColor` (menggantikan warna emissive hardcoded Day 1) supaya cocok untuk semua warna spesies; ring kuning tidak berubah.

## Validasi

- `npm run lint` → lulus tanpa error/warning.
- `npm run build` → lulus (compile + TypeScript bersih).
- Diverifikasi di browser (Playwright, dev server): 8 hewan bergerak dan tetap di pulau; tiga spesies terbedakan jelas (warna + ukuran + kecepatan); seleksi per-individu menampilkan panel dengan nama spesies, label individu, habitat, diet, dan koordinat live (ter-update via polling); pindah seleksi antar-hewan bekerja; deselect via tombol dan via klik laut bekerja; 0 error console dari kode aplikasi; 0 request eksternal.
- Warning console `THREE.Clock: This module has been deprecated` tetap berasal dari internal react-three-fiber — abaikan (lihat catatan di prototype.md).

## Batasan Langkah Ini & Langkah Berikutnya

Batasan: hewan hanya wander tanpa tujuan — belum ada waktu simulasi, kebutuhan (lapar/haus), sumber makanan/air, mati, atau reproduksi; status di panel masih hardcoded "Roaming"; semua spesies memakai bentuk mesh yang sama (hanya beda warna/ukuran).

Langkah berikutnya fase Hari 3–5: waktu simulasi + kebutuhan dasar (lapar/haus per spesies dari data `species.ts`) + sumber daya air/makanan di pulau, sehingga status hewan ("Roaming"/"Thirsty"/"Eating") menjadi hasil simulasi, bukan teks statis.
