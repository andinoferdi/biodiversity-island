Anda bekerja langsung di repository Next.js yang sedang terbuka, pada branch `andino/feat/species-roster` (dibuat dari `develop`).

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan fitur "Species Roster" untuk proyek "Biodiversity Island". Fitur ini adalah langkah awal fase Hari 3–5 (Simulasi Inti) pada roadmap proyek. Jangan hanya menjelaskan atau memberikan contoh kode. Periksa proyek, buat dan ubah file, jalankan validasi, dan perbaiki semua error yang ditemukan.

KONTEKS PROYEK

Fase Hari 1–2 (prototype) sudah selesai dan terverifikasi. Roadmap lengkap ada di `docs/project/prd.md` (bagian Priority dan Timeline). Baca dokumentasi berikut sebelum menulis kode:

1. `docs/feature/prototype/prototype.md` — arsitektur, keputusan teknis, dan gotcha prototype Hari 1–2.
2. `docs/feature/species-roster/species-roster-plan.md` — rencana implementasi fitur ini.
3. `AGENTS.md` dan `CLAUDE.md` di root proyek.

Kondisi kode saat ini:

- `src/app/page.tsx` me-render `BiodiversityPrototype` (Server Component → Client Component → dynamic ssr:false → Canvas). Jangan ubah pola ini; `ssr: false` wajib berada di file `"use client"` pada Next 16.
- `src/components/prototype/IslandScene.tsx` berisi Canvas, kamera orthographic, MapControls, cahaya, laut, pulau, dan 12 pohon. Konstanta penting: `GROUND_Y = 0.9`, `WALK_RADIUS = 5.2`.
- `src/components/prototype/PlaceholderAnimal.tsx` berisi satu hewan hardcoded "Island Grazer" dengan gerakan wander berbasis `useFrame` + delta, batas pulau, dan seleksi pointer.

Semua dependency sudah terpasang. Jangan menambah dependency baru. Gunakan npm. Jangan menjalankan `npm audit fix --force`.

TUJUAN SPECIES ROSTER

Generalisasi satu hewan hardcoded menjadi populasi multi-spesies berbasis data, sebagai fondasi untuk sistem kebutuhan (lapar, haus, makanan, air) pada langkah berikutnya fase Hari 3–5:

1. Satu module data spesies TypeScript berisi minimal 3 spesies dengan atribut berbeda (nama, warna, ukuran, kecepatan, habitat, diet).
2. Minimal 6 individu hewan (total lintas spesies) berkeliaran bersamaan di pulau dengan posisi spawn deterministik.
3. Setiap individu dapat dipilih secara terpisah; seleksi berbasis id, dan berpindah seleksi antar-hewan tanpa harus deselect dulu.
4. Panel informasi menampilkan data spesies dari individu terpilih: nama spesies, label individu, status, habitat, diet, dan koordinat live.
5. Header overlay menampilkan label "Species Roster" (tanpa nomor hari) dan ringkasan populasi (jumlah spesies dan jumlah hewan).
6. Proyek tetap lolos lint dan production build.

BATASAN SCOPE

Fitur di bawah ini BUKAN bagian langkah ini. Sebagian besar adalah langkah berikutnya di fase Hari 3–5 (waktu simulasi, lapar, haus, makanan, air, mati, reproduksi) atau fase Hari 6–9 (GLB, predator–mangsa) — jangan mencurinya ke langkah ini:

- Model GLB atau GLTF, gambar eksternal, API eksternal, database, autentikasi
- Zustand atau state library lain (state lokal `selectedId` masih cukup)
- Sistem lapar, haus, energi, atau kebutuhan lain (langkah berikutnya fase Hari 3–5)
- Waktu simulasi, kontrol waktu, pause, atau kecepatan simulasi (langkah berikutnya fase Hari 3–5)
- Mati dan reproduksi (langkah berikutnya fase Hari 3–5)
- Predator dan mangsa (fase Hari 6–9)
- Physics engine, post-processing, shader kompleks, sistem cuaca
- Halaman baru atau dependency baru

Semua objek 3D tetap dari geometry bawaan Three.js. Perilaku gerakan hewan harus tetap setara Day 1 (wander halus, frame-rate independent, tidak keluar pulau).

DETAIL IMPLEMENTASI

1. Data spesies (`src/components/prototype/species.ts`)

- Definisikan interface `Species` (id, name, habitat, diet, bodyColor, accentColor, scale, moveSpeed, turnSpeed) dan `AnimalSpawn` (id, speciesId, x, z, heading).
- Export `SPECIES` (3 spesies) dan `ANIMAL_SPAWNS` (6–8 individu, posisi deterministik di dalam `WALK_RADIUS`, tersebar agar tidak bertumpuk saat load).
- Ketiga spesies harus terlihat berbeda pada zoom default: warna kontras satu sama lain dan terhadap terrain, perbedaan ukuran dan kecepatan terlihat jelas.
- Contoh arah: "Island Grazer" (tampilan Day 1, medium), satu spesies kecil dan cepat, satu spesies besar dan lambat. Nama bebas asal konsisten.

2. Komponen hewan (`src/components/prototype/Animal.tsx`)

- Buat dari `PlaceholderAnimal.tsx` lalu hapus file lama pada commit yang sama.
- Bentuk mesh sama seperti Day 1 (badan, kepala, kaki, ekor, ring seleksi), tetapi warna dan skala dari data spesies. Terapkan skala pada group, bukan per-mesh.
- Gerakan identik Day 1 tetapi membaca `moveSpeed` dan `turnSpeed` dari spesies; posisi dan heading awal dari data spawn.
- Semua state per-frame tetap di ref. `Math.random()` hanya untuk target wander di dalam frame loop.
- Tulis posisi ke `positionRef` hanya ketika hewan sedang terpilih.

3. Scene (`src/components/prototype/IslandScene.tsx`)

- Render hewan dengan `ANIMAL_SPAWNS.map(...)`, join spawn ke spesiesnya lewat lookup yang dibuat sekali di module scope.
- Ganti prop `selected: boolean` menjadi `selectedId: string | null` dan `onSelect(id)`.
- Laut, pulau, pohon, kamera, kontrol, dan cahaya tidak berubah.

4. UI (`src/components/prototype/BiodiversityPrototype.tsx`)

- State `selectedId: string | null`. Klik hewan lain langsung memindahkan seleksi. Klik area kosong dan tombol Deselect tetap membatalkan seleksi.
- Panel menampilkan data spesies individu terpilih plus koordinat yang di-refresh lewat interval 250 ms yang sudah ada (hanya aktif saat ada seleksi).
- Tambahkan ringkasan populasi di header, dihitung dari module data — bukan dari state simulasi.

KRITERIA SELESAI

- Minimal 3 spesies dan 6 individu terlihat dan dapat dibedakan secara visual.
- Setiap hewan dapat dipilih; ring seleksi mengikuti hewan yang benar; panel menampilkan data yang benar.
- Semua hewan tetap di dalam pulau dan gerakan tidak bergantung frame rate.
- Tidak ada error browser console dari kode aplikasi, tidak ada error TypeScript.
- `npm run lint` berhasil dan `npm run build` berhasil.
- Tidak ada aset eksternal, request jaringan untuk model/gambar, atau dependency baru.
- Frame rate tetap stabil dengan ~8 hewan.

PROSES VALIDASI

1. Jalankan `npm run lint`, perbaiki semua error dan warning yang relevan.
2. Jalankan `npm run build`, perbaiki semua error build dan TypeScript.
3. Jalankan dev server sebentar, verifikasi di browser: semua hewan bergerak, seleksi per-individu bekerja, panel benar, console bersih. Matikan server setelah selesai.
4. Periksa `git diff` agar tidak ada perubahan di luar scope.

Jangan menyatakan pekerjaan selesai sebelum lint dan build berhasil.

LAPORAN AKHIR

Setelah selesai, berikan laporan singkat yang mencantumkan:

1. File yang dibuat, diubah, dan dihapus.
2. Fitur yang sudah bekerja.
3. Hasil `npm run lint` dan `npm run build`.
4. Keterbatasan langkah ini.
5. Satu langkah berikutnya yang paling logis di fase Hari 3–5 (kemungkinan besar: waktu simulasi plus kebutuhan dasar spesies seperti lapar/haus dan sumber daya air/makanan di pulau, sesuai roadmap di PRD).

Setelah implementasi selesai dan tervalidasi, tulis dokumentasi handoff `docs/feature/species-roster/species-roster.md` dengan struktur meniru `docs/feature/prototype/prototype.md`, lalu perbarui status fitur di `docs/project/prd.md` dan `docs/project/brd.md`.

Mulai sekarang. Periksa repository dan langsung kerjakan implementasinya.
