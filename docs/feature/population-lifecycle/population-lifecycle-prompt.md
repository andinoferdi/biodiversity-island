Anda bekerja langsung di repository Next.js yang sedang terbuka, pada branch `andino/feat/population-lifecycle` (dibuat dari `main`).

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan fitur "Population Lifecycle" untuk proyek "Biodiversity Island". Fitur ini adalah langkah ketiga sekaligus penutup fase Hari 3–5 (Simulasi Inti) pada roadmap proyek, setelah Species Roster dan Simulation Needs. Jangan hanya menjelaskan atau memberikan contoh kode. Periksa proyek, buat dan ubah file, jalankan validasi, dan perbaiki semua error yang ditemukan.

KONTEKS PROYEK

Simulation Needs sudah selesai dan terverifikasi: waktu simulasi Pause/1×/4×, kebutuhan lapar–haus per spesies, 1 kolam + 3 petak makanan, perilaku cari→konsumsi→kembali berkeliaran, status dan bar kebutuhan live di panel. Baca dokumentasi berikut sebelum menulis kode:

1. `docs/feature/simulation-needs/simulation-needs.md` — arsitektur dan keputusan teknis terkini (dt = delta × timeScale, prioritas perilaku, lock konsumsi ke status, vitals ref).
2. `docs/feature/population-lifecycle/population-lifecycle-plan.md` — rencana implementasi fitur ini.
3. `docs/feature/species-roster/species-roster.md` — pola seleksi dan polling 250 ms.
4. `docs/feature/prototype/prototype.md` — gotcha Next 16 dan pola render (dynamic ssr:false wajib di file "use client").
5. `AGENTS.md` dan `CLAUDE.md` di root proyek.

Kondisi kode saat ini:

- `src/components/prototype/simulation.ts` — TimeScale, AnimalStatus, RESOURCES, ambang kebutuhan (NEED_MAX 100, SEEK_THRESHOLD 55, SATISFIED_LEVEL 10, CRITICAL_LEVEL 90), AnimalVitals.
- `src/components/prototype/species.ts` — SPECIES (3) dengan hungerRate/thirstRate/consumeRate, ANIMAL_SPAWNS (8) statis, getSpecies().
- `src/components/prototype/Animal.tsx` — semua mutasi memakai dt; kebutuhan naik per frame; prioritas konsumsi → cari air → cari makanan → wander; menulis vitals saat terpilih.
- `src/components/prototype/IslandScene.tsx` — me-render ANIMAL_SPAWNS statis, kolam, petak makanan; GROUND_Y = 0.9, WALK_RADIUS = 5.2.
- `src/components/prototype/BiodiversityPrototype.tsx` — state selectedId + timeScale, tombol Pause/1×/4×, polling vitals 250 ms, header "3 species · 8 animals" statis.

Semua dependency sudah terpasang. Jangan menambah dependency baru. Gunakan npm. Jangan menjalankan `npm audit fix --force`.

TUJUAN POPULATION LIFECYCLE

Menjadikan populasi hasil simulasi, bukan konstanta:

1. Mati: hewan yang salah satu kebutuhannya bertahan di NEED_MAX terlalu lama (konstanta `DEATH_AFTER_CRITICAL` dalam detik-simulasi) mati dan hilang dari pulau. Sebelum mati, status berubah menjadi "Starving"/"Dehydrated" sebagai peringatan di panel.
2. Reproduksi sederhana: hewan yang kedua kebutuhannya terjaga rendah (di bawah `WELL_FED_LEVEL`) selama `REPRODUCE_AFTER` detik-simulasi menghasilkan satu anak di dekatnya, dengan label lanjutan (mis. "Grazer #4"); kebutuhan induk naik sebagai "biaya" reproduksi.
3. Populasi punya batas atas (`MAX_POPULATION`) supaya tidak meledak.
4. Header menampilkan sensus live dari state populasi — bertambah saat lahir, berkurang saat mati.
5. Hewan terpilih yang mati membuat seleksi bersih (deselect otomatis, panel tertutup tanpa error).
6. Pause membekukan timer mati dan reproduksi; 4× mempercepatnya seragam.
7. Proyek tetap lolos lint dan production build.

BATASAN SCOPE

Fitur di bawah ini BUKAN bagian langkah ini — jangan mencurinya ke sini:

- Model GLB (aset di `public/assets/` belum dipakai), tiga bioma, predator–mangsa, krisis (fase Hari 6–9)
- Tutorial, statistik populasi/grafik, save lokal, audio (fase Hari 10–12)
- Genetika, umur, jenis kelamin, corpse/bangkai, animasi kematian
- Zustand atau state library lain, physics engine, halaman baru, dependency baru, API eksternal

Arsitektur dipertahankan: state per-frame di ref; React state untuk UI dan peristiwa struktural yang jarang (daftar populasi berubah hanya saat lahir/mati — ini pengecualian yang diizinkan); polling panel 250 ms; penempatan awal deterministik; `Math.random()` hanya di dalam frame loop.

DETAIL IMPLEMENTASI

Ikuti desain di `population-lifecycle-plan.md`. Ringkasan wajib:

1. `simulation.ts` — konstanta `DEATH_AFTER_CRITICAL`, `WELL_FED_LEVEL`, `REPRODUCE_AFTER`, `MAX_POPULATION`, `REPRODUCTION_NEED_PENALTY`; perluas `AnimalStatus` dengan "Starving" dan "Dehydrated".
2. `Animal.tsx` — timer `criticalTimer` (naik saat ada kebutuhan di NEED_MAX, reset saat tidak) dan `wellFedTimer` (naik saat kedua kebutuhan < WELL_FED_LEVEL, reset saat tidak), keduanya memakai dt; guard `hasDied` agar `onDeath` terpanggil tepat sekali; `onReproduce` mereset timer dan menaikkan kebutuhan induk; props callback baru.
3. `BiodiversityPrototype.tsx` — state `population: AnimalSpawn[]` diinisialisasi dari `ANIMAL_SPAWNS`; handler kematian (hapus dari populasi + deselect jika perlu) dan kelahiran (id unik dari counter, label lanjutan per spesies, posisi dekat induk di-clamp ke WALK_RADIUS, tolak jika populasi di cap); header sensus dari state; `SPAWN_BY_ID` diturunkan dari state (useMemo).
4. `IslandScene.tsx` — menerima `population` sebagai prop dan me-render darinya; meneruskan callback ke setiap `Animal`. Laut, pulau, pohon, sumber daya, kamera tidak berubah.

KRITERIA SELESAI

- Kematian teramati end-to-end: kebutuhan mentok → status "Starving"/"Dehydrated" → hewan hilang setelah `DEATH_AFTER_CRITICAL` detik-simulasi → sensus turun → jika sedang terpilih, deselect bersih.
- Reproduksi teramati: hewan sehat berkelanjutan → anak muncul di dekat induk → sensus naik → anak berperilaku normal (kebutuhan, seleksi, bisa mati).
- Cap populasi menahan pertumbuhan; Pause membekukan kedua timer; 4× mempercepat seragam; frame-rate independent.
- Semua fitur langkah sebelumnya tetap bekerja: siklus kebutuhan, seleksi per-id, kedua jalur deselect, kontrol waktu.
- Tidak ada error browser console dari kode aplikasi, tidak ada error TypeScript.
- `npm run lint` berhasil dan `npm run build` berhasil.
- Tidak ada aset eksternal, request jaringan untuk model/gambar, atau dependency baru.

PROSES VALIDASI

1. Jalankan `npm run lint`, perbaiki semua error dan warning yang relevan.
2. Jalankan `npm run build`, perbaiki semua error build dan TypeScript.
3. Jalankan dev server sebentar, verifikasi di browser pada 4×: amati satu kematian penuh (termasuk deselect otomatis bila hewan terpilih) dan satu kelahiran penuh; uji Pause membekukan timer; uji sensus header berubah. Matikan server setelah selesai (jangan matikan server milik user jika sudah ada yang berjalan di port 3000 — pakai port yang tersedia).
4. Periksa `git diff` agar tidak ada perubahan di luar scope.

Jangan menyatakan pekerjaan selesai sebelum lint dan build berhasil.

LAPORAN AKHIR

Setelah selesai, berikan laporan singkat yang mencantumkan:

1. File yang dibuat, diubah, dan dihapus.
2. Fitur yang sudah bekerja.
3. Hasil `npm run lint` dan `npm run build`.
4. Keterbatasan langkah ini.
5. Fase berikutnya (Hari 6–9): tiga bioma, enam spesies dengan model GLB dari `public/assets/animal/` (catatan: hanya deer yang punya animasi), predator–mangsa, dan tiga krisis ekosistem.

Setelah implementasi selesai dan tervalidasi, tulis dokumentasi handoff `docs/feature/population-lifecycle/population-lifecycle.md` dengan struktur meniru `docs/feature/simulation-needs/simulation-needs.md`, lalu perbarui status fitur di `docs/project/prd.md`, `docs/project/brd.md`, dan `docs/project/srs.md` (fase Hari 3–5 menjadi sepenuhnya `Implemented`).

Mulai sekarang. Periksa repository dan langsung kerjakan implementasinya.
