Anda bekerja langsung di repository Next.js yang sedang terbuka, pada branch `andino/feat/biome-terrain` (dibuat dari `main` yang sudah memuat population lifecycle).

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan fitur "Biome Terrain" untuk proyek "Biodiversity Island". Fitur ini adalah langkah pertama fase Hari 6–9 (Bioma & Spesies) pada roadmap proyek, setelah fase Hari 3–5 (Simulasi Inti) selesai sepenuhnya. Jangan hanya menjelaskan atau memberikan contoh kode. Periksa proyek, buat dan ubah file, jalankan validasi, dan perbaiki semua error yang ditemukan.

KONTEKS PROYEK

Fase Hari 3–5 sudah selesai dan terverifikasi: waktu simulasi Pause/1×/4×, kebutuhan lapar–haus, perilaku berbasis kebutuhan, kematian (Starving/Dehydrated), reproduksi sederhana, cap populasi 24, sensus live. Baca dokumentasi berikut sebelum menulis kode:

1. `docs/feature/population-lifecycle/population-lifecycle.md` — arsitektur dan keputusan teknis terkini (dt = delta × timeScale, populasi sebagai React state, timer lifecycle, WELL_FED_LEVEL = 65).
2. `docs/feature/biome-terrain/biome-terrain-plan.md` — rencana implementasi fitur ini.
3. `docs/feature/simulation-needs/simulation-needs.md` — prioritas perilaku dan lock konsumsi.
4. `docs/feature/prototype/prototype.md` — gotcha Next 16 dan pola render (dynamic ssr:false wajib di file "use client").
5. `AGENTS.md` dan `CLAUDE.md` di root proyek.

Kondisi kode saat ini: `src/components/prototype/{simulation.ts,species.ts,Animal.tsx,IslandScene.tsx,BiodiversityPrototype.tsx}` — semua fitur Hari 3–5 hidup di sana. Aset GLB tersedia di `public/assets/environment/` (tree.glb 70 KB, rock.glb 30 KB, log.glb 14 KB — dipakai langkah ini) dan `public/assets/animal/` (6 spesies — BUKAN langkah ini). Semua dependency sudah terpasang (drei menyediakan useGLTF dan Clone). Jangan menambah dependency baru. Gunakan npm. Jangan menjalankan `npm audit fix --force`.

TUJUAN BIOME TERRAIN

1. Pulau terbagi menjadi tiga bioma yang terlihat jelas dari kamera top-down: Hutan (forest), Padang Rumput (grassland), dan Pesisir (shore) — tiga sektor 120° dengan warna tanah berbeda, data deterministik di file baru `biomes.ts`.
2. Vegetasi primitif (cone/cylinder) diganti model GLB pertama proyek: `tree.glb`, `rock.glb`, `log.glb` via drei `useGLTF` + `Clone` + preload, dengan komposisi berbeda per bioma. Ini validasi pipeline GLB yang disyaratkan BRD sebelum model hewan dipakai.
3. Setiap bioma punya sumber daya sendiri (total 2 kolam + 3 petak makanan; setiap bioma mandiri: minimal 1 air + 1 makanan).
4. Setiap spesies punya bioma rumah sesuai habitatnya (grazer → padang rumput, hopper → pesisir, strider → hutan): posisi spawn pindah ke bioma rumah, hewan mencari sumber daya di bioma sendiri lebih dulu, dan saat berkeliaran di luar bioma rumah diarahkan kembali (batas habitat lunak — tanpa dinding keras).
5. Panel hewan terpilih menampilkan baris "Biome"; subtitle header menjadi "Biome Terrain".
6. Loading GLB dibungkus Suspense fallback sehingga halaman tidak pernah kosong tanpa feedback.
7. Semua fitur Hari 3–5 tetap bekerja; proyek tetap lolos lint dan production build.

BATASAN SCOPE

Fitur di bawah ini BUKAN bagian langkah ini — jangan mencurinya ke sini:

- Model GLB hewan (`public/assets/animal/`), animasi, penggantian 3 spesies placeholder — langkah berikutnya
- `terrain.glb` (pulau tetap prosedural), HDRI, audio
- Predator–mangsa dan tiga krisis ekosistem (langkah lanjutan Hari 6–9)
- Tutorial, statistik populasi, save lokal (Hari 10–12); InstancedMesh (Hari 13+)
- Zustand atau state library lain, physics engine, halaman baru, dependency baru, API eksternal

Arsitektur dipertahankan: state per-frame di ref; React state hanya untuk UI dan peristiwa struktural jarang; polling panel 250 ms; data awal deterministik; `Math.random()` hanya di dalam frame loop.

DETAIL IMPLEMENTASI

Ikuti desain di `biome-terrain-plan.md`. Ringkasan wajib:

1. `biomes.ts` (baru) — `Biome { id, name, groundColor, thetaStart, thetaLength, centerX, centerZ }`, `BIOMES` (3 sektor 120°), `biomeAt(x, z)` berbasis `atan2`, `getSpecies`-style `getBiome(id)`.
2. `simulation.ts` — `ResourceSpot` + `biomeId`; layout baru 2 kolam + 3 petak, deterministik, setiap bioma mandiri; semua ambang dan konstanta lifecycle tidak berubah.
3. `species.ts` — `Species` + `biomeId`; `ANIMAL_SPAWNS` dipindah ke bioma rumah masing-masing.
4. `Animal.tsx` — seek memilih sumber daya terdekat di bioma rumah (fallback global bila tidak ada); saat `Roaming` di luar bioma rumah, `headingTarget` menuju pusat bioma rumah (mekanisme sama dengan steer pantai yang sudah ada).
5. `EnvironmentModels.tsx` (baru) — komponen Tree/Rock/Log membungkus `useGLTF` + `<Clone>`, `useGLTF.preload` untuk ketiganya, koreksi scale/offset per model (periksa hasil load di browser), `castShadow` via traverse sekali di file ini.
6. `IslandScene.tsx` — tiga wedge tanah berwarna per bioma (`circleGeometry` dengan `thetaStart`/`thetaLength`), tabel posisi vegetasi deterministik per bioma, `<Suspense>` fallback; kamera, laut, dan mekanika lain tidak berubah.
7. `BiodiversityPrototype.tsx` — baris "Biome" di panel (dari spesies), subtitle "Biome Terrain".

KRITERIA SELESAI

- Tiga bioma terlihat jelas dan berbeda dari kamera top-down; setiap bioma punya air + makanan; setiap spesies hidup dan bertahan di bioma rumahnya.
- Pipeline GLB terbukti: tree/rock/log termuat dari `public/assets/environment/` tanpa 404, skala dan orientasi benar, bayangan bekerja, 0 error console.
- Hewan yang berkeliaran keluar bioma rumah kembali sendiri; siklus kebutuhan, kematian, reproduksi, cap, sensus, seleksi/deselect, dan kontrol waktu semua tetap bekerja.
- Tidak ada dependency baru; tidak ada request aset selain dari `public/`.
- `npm run lint` berhasil dan `npm run build` berhasil.

PROSES VALIDASI

1. Jalankan `npm run lint`, perbaiki semua error dan warning yang relevan.
2. Jalankan `npm run build`, perbaiki semua error build dan TypeScript.
3. Jalankan dev server sebentar, verifikasi di browser: tiga bioma tampak, GLB termuat benar (cek tab network untuk 404 dan console untuk error), amati hewan kembali ke bioma rumahnya, jalankan satu siklus kebutuhan penuh dan satu kelahiran di 4×, uji Pause. Matikan server setelah selesai (jangan matikan server milik user jika sudah ada yang berjalan — pakai port yang tersedia).
4. Periksa `git diff` agar tidak ada perubahan di luar scope.

Jangan menyatakan pekerjaan selesai sebelum lint dan build berhasil.

LAPORAN AKHIR

Setelah selesai, berikan laporan singkat yang mencantumkan:

1. File yang dibuat, diubah, dan dihapus.
2. Fitur yang sudah bekerja.
3. Hasil `npm run lint` dan `npm run build`.
4. Keterbatasan langkah ini.
5. Langkah berikutnya (Hari 6–9 lanjutan): mengganti 3 spesies placeholder dengan 6 spesies GLB dari `public/assets/animal/` (deer, dove, duck, elephant, fish, turtle — hanya deer yang punya animasi), lalu predator–mangsa dan tiga krisis.

Setelah implementasi selesai dan tervalidasi, tulis dokumentasi handoff `docs/feature/biome-terrain/biome-terrain.md` dengan struktur meniru `docs/feature/population-lifecycle/population-lifecycle.md`, lalu perbarui status fitur di `docs/project/prd.md`, `docs/project/brd.md`, dan `docs/project/srs.md` (fase Hari 6–9 menjadi `In Progress` dengan langkah biome-terrain `Implemented`).

Mulai sekarang. Periksa repository dan langsung kerjakan implementasinya.
