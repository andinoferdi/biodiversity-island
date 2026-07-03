Anda bekerja langsung di repository Next.js yang sedang terbuka, pada branch `andino/feat/simulation-needs` (dibuat dari `develop`).

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan fitur "Simulation Needs" untuk proyek "Biodiversity Island". Fitur ini adalah langkah kedua fase Hari 3–5 (Simulasi Inti) pada roadmap proyek, setelah Species Roster. Jangan hanya menjelaskan atau memberikan contoh kode. Periksa proyek, buat dan ubah file, jalankan validasi, dan perbaiki semua error yang ditemukan.

KONTEKS PROYEK

Species Roster sudah selesai dan terverifikasi: 3 spesies berbasis data, 8 individu berkeliaran, seleksi per-id, panel data spesies. Baca dokumentasi berikut sebelum menulis kode:

1. `docs/feature/species-roster/species-roster.md` — arsitektur dan keputusan teknis terkini (state di ref, polling 250 ms, pola seleksi).
2. `docs/feature/simulation-needs/simulation-needs-plan.md` — rencana implementasi fitur ini.
3. `docs/feature/prototype/prototype.md` — gotcha Next 16 dan pola render (dynamic ssr:false wajib di file "use client").
4. `AGENTS.md` dan `CLAUDE.md` di root proyek.

Kondisi kode saat ini:

- `src/components/prototype/species.ts` — data `SPECIES` (3) dan `ANIMAL_SPAWNS` (8), helper `getSpecies()`.
- `src/components/prototype/Animal.tsx` — gerakan wander berbasis `useFrame` + delta di ref, boundary steer, seleksi pointer; menulis posisi ke ref bersama hanya saat terpilih.
- `src/components/prototype/IslandScene.tsx` — Canvas, kamera, laut, pulau, 12 pohon; `GROUND_Y = 0.9`, `WALK_RADIUS = 5.2`.
- `src/components/prototype/BiodiversityPrototype.tsx` — state `selectedId`, polling koordinat 250 ms, header + panel.

Semua dependency sudah terpasang. Jangan menambah dependency baru. Gunakan npm. Jangan menjalankan `npm audit fix --force`.

TUJUAN SIMULATION NEEDS

Menghadirkan simulasi pertama yang dapat diamati — kebutuhan mendorong perilaku:

1. Waktu simulasi dengan kontrol Pause / 1× / 4× di header; Pause membekukan seluruh simulasi (gerakan, kebutuhan, konsumsi), 4× mempercepat semuanya secara seragam.
2. Setiap hewan punya kebutuhan lapar dan haus (0–100) yang naik seiring waktu simulasi, dengan laju per-spesies dari `species.ts`.
3. Sumber daya deterministik di pulau: satu kolam air dan 3 petak makanan (geometry primitif, bukan aset).
4. Perilaku berbasis kebutuhan: kebutuhan melewati ambang → hewan berjalan ke sumber daya yang tepat → berhenti dan mengonsumsi → kebutuhan turun → kembali berkeliaran.
5. Status hewan menjadi hasil simulasi ("Roaming", "Seeking water", "Drinking", "Seeking food", "Eating") dan tampil live di panel bersama dua bar kebutuhan (Hunger, Thirst).
6. Proyek tetap lolos lint dan production build.

BATASAN SCOPE

Fitur di bawah ini BUKAN bagian langkah ini — jangan mencurinya ke sini:

- Mati dan reproduksi (langkah ketiga fase Hari 3–5, setelah fitur ini)
- Model GLB, tiga bioma, predator–mangsa, krisis (fase Hari 6–9)
- Tutorial, statistik populasi, save lokal, audio (fase Hari 10–12)
- Zustand atau state library lain, physics engine, post-processing, shader kompleks, sistem cuaca
- Halaman baru, dependency baru, API eksternal, gambar eksternal

Semua objek 3D tetap dari geometry bawaan Three.js. Arsitektur Species Roster dipertahankan: state per-frame di ref, React state hanya untuk UI (`selectedId`, `timeScale`), polling panel 250 ms.

DETAIL IMPLEMENTASI

Ikuti desain di `simulation-needs-plan.md`. Ringkasan wajib:

1. `src/components/prototype/simulation.ts` (baru) — `type TimeScale = 0 | 1 | 4`; interface `ResourceSpot` dan data `RESOURCES` (1 kolam + 3 petak makanan, posisi deterministik dalam `WALK_RADIUS`, tidak menimpa posisi pohon); konstanta ambang (`NEED_MAX`, `SEEK_THRESHOLD`, `SATISFIED_LEVEL`, `CRITICAL_LEVEL`); type `AnimalVitals` (x, z, hunger, thirst, status) yang menggantikan `AnimalPosition` sebagai payload ref bersama.
2. `species.ts` — tambah `hungerRate`, `thirstRate`, `consumeRate` per spesies (Dune Hopper tercepat, Highland Strider terlambat). Data lain tidak berubah.
3. `Animal.tsx` — `const dt = delta * timeScale` dipakai untuk SEMUA mutasi (gerak, timer wander, kenaikan kebutuhan, konsumsi). Prioritas per frame: konsumsi jika di sumber daya dan masih butuh → cari air jika haus lewat ambang → cari makanan jika lapar lewat ambang → wander. Nilai awal kebutuhan dibuat bervariasi secara deterministik agar hewan tidak serentak. Hewan terpilih menulis vitals lengkap ke ref bersama.
4. `IslandScene.tsx` — render kolam dan petak makanan dari `RESOURCES` (tanpa pointer handler), teruskan `timeScale` dan ref vitals ke setiap `Animal`. Laut, pulau, pohon, kamera, cahaya tidak berubah.
5. `BiodiversityPrototype.tsx` — state `timeScale` (default 1) + tiga tombol Pause/1×/4× di header (tandai yang aktif, `aria-pressed`); panel menampilkan status live dan dua bar kebutuhan dari polling ref; koordinat tetap.

KRITERIA SELESAI

- Loop sebab-akibat dapat diamati end-to-end: bar naik → hewan menuju sumber daya yang benar dengan status "Seeking…" → berhenti dan status "Drinking"/"Eating" → bar turun → kembali "Roaming".
- Pause membekukan gerakan, bar, dan konsumsi; 4× mempercepat semuanya; gerakan tetap frame-rate independent di semua kecepatan.
- Semua hewan tetap di dalam pulau; seleksi per-id, pindah seleksi, dan kedua cara deselect (tombol + klik laut) tetap bekerja — kolam dan petak makanan tidak boleh menelan `onPointerMissed`.
- Tidak ada error browser console dari kode aplikasi, tidak ada error TypeScript.
- `npm run lint` berhasil dan `npm run build` berhasil.
- Tidak ada aset eksternal, request jaringan untuk model/gambar, atau dependency baru.

PROSES VALIDASI

1. Jalankan `npm run lint`, perbaiki semua error dan warning yang relevan.
2. Jalankan `npm run build`, perbaiki semua error build dan TypeScript.
3. Jalankan dev server sebentar, verifikasi di browser: amati satu siklus penuh haus→minum dan lapar→makan (gunakan 4× agar cepat), uji Pause, uji seleksi dan deselect. Matikan server setelah selesai (jangan matikan server milik user jika sudah ada yang berjalan di port 3000 — pakai port yang tersedia atau server yang ada).
4. Periksa `git diff` agar tidak ada perubahan di luar scope.

Jangan menyatakan pekerjaan selesai sebelum lint dan build berhasil.

LAPORAN AKHIR

Setelah selesai, berikan laporan singkat yang mencantumkan:

1. File yang dibuat, diubah, dan dihapus.
2. Fitur yang sudah bekerja.
3. Hasil `npm run lint` dan `npm run build`.
4. Keterbatasan langkah ini.
5. Langkah berikutnya fase Hari 3–5: mati ketika kebutuhan mentok di maksimum terlalu lama + reproduksi sederhana.

Setelah implementasi selesai dan tervalidasi, tulis dokumentasi handoff `docs/feature/simulation-needs/simulation-needs.md` dengan struktur meniru `docs/feature/species-roster/species-roster.md`, lalu perbarui status fitur di `docs/project/prd.md`, `docs/project/brd.md`, dan `docs/project/srs.md`.

Mulai sekarang. Periksa repository dan langsung kerjakan implementasinya.
