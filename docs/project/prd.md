# Biodiversity Island - Product Requirements Document

## Overview
Build pengalaman web 3D interaktif bernama Biodiversity Island. Pengguna melihat sebuah pulau dari sudut pandang atas, menggerakkan kamera, mengamati hewan, memilih objek, dan memahami hubungan antara spesies, habitat, sumber daya, serta gangguan ekosistem.

Dokumen ini adalah living PRD. Gunakan status berikut agar rencana tidak tercampur dengan implementasi nyata:
- `Implemented`: tersedia dan sudah diverifikasi di source code
- `In Progress`: sedang dikerjakan pada branch aktif
- `Planned`: disetujui untuk milestone berikutnya
- `Deferred`: sengaja ditunda

Current baseline yang terverifikasi adalah project Next.js 16.2.10 dengan App Router, React 19, TypeScript, Tailwind CSS v4, ESLint, React Compiler, folder `src/`, npm, dan repository Git dengan remote origin. Dependency 3D (`three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`) sudah terpasang. Fase Hari 1–2 (prototype) sudah `Implemented` di `src/components/prototype/` (lihat `docs/feature/prototype/prototype.md`). Asset GLB dan simulation system belum ada — periksa repository sebelum mengubah status fitur lain menjadi `Implemented`.

Project mengikuti roadmap bertahap Hari 1 sampai selesai (lihat bagian Priority dan Timeline). Jumlah hari adalah panduan, bukan target utama — pindah tahap hanya setelah fitur tahap sebelumnya stabil dan dapat diuji. Pembagian peran teknis: Next.js menangani struktur aplikasi, React Three Fiber menangani Canvas, interaksi, dan animasi per frame, GLTFLoader memuat aset GLB, dan InstancedMesh mengurangi draw call untuk vegetasi berulang.

## Core Features

### User Management
- MVP tidak membutuhkan login, akun, profil, role, permission, atau penyimpanan data pengguna di server
- Pengalaman utama harus dapat dibuka langsung dari halaman utama tanpa onboarding panjang
- `Planned` (Hari 10–12): save lokal state simulasi via localStorage, tanpa backend dan tanpa akun

### Main Feature
- `Implemented`: Scene pulau 3D dengan laut, terrain, vegetasi, pencahayaan, dan kamera top-down yang dapat di-pan, zoom, serta dirotasi secara terbatas — `src/components/prototype/IslandScene.tsx`
- `Implemented`: Hewan berbasis data yang bergerak otomatis, tetap berada di area pulau, dan dapat dipilih dengan pointer — `src/components/prototype/Animal.tsx` (menggantikan `PlaceholderAnimal.tsx` dari Day 1)
- `Implemented`: Panel informasi hewan terpilih yang menampilkan nama spesies, label individu, status, habitat, diet, dan posisi live, plus tombol Deselect — `src/components/prototype/BiodiversityPrototype.tsx`
- `Implemented` (Hari 3–5, langkah awal): species roster — 3 spesies placeholder berbasis data (`src/components/prototype/species.ts`), 8 individu berkeliaran bersamaan (`src/components/prototype/Animal.tsx`), seleksi per-id, panel data spesies, dan ringkasan populasi — lint & build lulus, diverifikasi di browser; lihat `docs/feature/species-roster/species-roster.md`
- `Implemented` (Hari 3–5, langkah kedua): simulation needs — waktu simulasi dengan kontrol Pause/1×/4×, kebutuhan lapar–haus per spesies (`src/components/prototype/species.ts`), sumber daya deterministik 1 kolam + 3 petak makanan (`src/components/prototype/simulation.ts`), perilaku berbasis kebutuhan cari→konsumsi→kembali berkeliaran (`src/components/prototype/Animal.tsx`), status live dan bar kebutuhan di panel — memenuhi FR-006 & FR-007; lint & build lulus, diverifikasi di browser; lihat `docs/feature/simulation-needs/simulation-needs.md`
- `Planned` (Hari 3–5, langkah terakhir): mati ketika kebutuhan bertahan di maksimum terlalu lama dan reproduksi sederhana
- `Planned` (Hari 6–9): tiga bioma, enam spesies dengan model GLB dan animasi, hubungan predator–mangsa, serta tiga krisis ekosistem
- `Planned` (Hari 10–12): UI utama, tutorial, statistik populasi, save lokal, balancing, audio, dan responsivitas
- `Planned` (Hari 13–selesai): optimasi GLB, instancing tanaman, pengujian, perbaikan bug, dokumentasi, dan deployment
- Semua model, texture, audio, dan data spesies harus memiliki sumber serta lisensi yang dapat dilacak

### Organization
- Halaman utama menempatkan Canvas 3D sebagai fokus dan memakai overlay HTML kecil untuk judul, instruksi, status, serta panel detail
- UI harus membedakan informasi penting, kontrol waktu, objek terpilih, dan kondisi ekosistem tanpa menutupi scene
- Interaksi utama harus tetap dapat dipahami pada desktop, touch device, dan layar kecil
- State simulasi harus dipisahkan dari state UI ketika kompleksitas sudah membutuhkan store khusus
- Setiap milestone harus memiliki known limitations agar agent berikutnya tidak menganggap prototype sebagai fitur final

## Technical Requirements

### Frontend
- Gunakan stack project yang terverifikasi: Next.js 16 App Router, React, TypeScript, Tailwind CSS, React Compiler, ESLint, dan npm
- Gunakan Three.js melalui React Three Fiber untuk scene React, serta Drei hanya untuk helper yang benar-benar diperlukan
- Komponen Canvas, pointer interaction, animation loop, dan browser API harus berada dalam Client Component
- Gunakan primitive geometry untuk prototype sebelum memasukkan model GLB final
- Gunakan `useFrame` dan `delta` untuk gerakan berbasis waktu, serta `useRef` untuk state per-frame yang tidak perlu memicu render React
- Gunakan format GLB untuk model runtime setelah asset pipeline lolos uji satu model, rig, animasi, export, loading, dan disposal; muat GLB dengan GLTFLoader (melalui helper drei seperti `useGLTF`) mulai fase Hari 6–9
- Gunakan InstancedMesh untuk vegetasi dan objek berulang pada fase optimasi (Hari 13–selesai) agar draw call tetap rendah
- Save lokal (Hari 10–12) memakai localStorage tanpa backend
- Jangan menambah physics engine, post-processing, backend, auth, atau state library sebelum ada kebutuhan yang terbukti

### Backend
- MVP tidak membutuhkan backend aplikasi, database, autentikasi, atau API internal
- Data spesies awal dapat memakai file TypeScript atau JSON statis yang tervalidasi
- Backend hanya ditambahkan jika fitur seperti penyimpanan skenario, akun, leaderboard, CMS, atau sinkronisasi data memang masuk scope produk
- Jangan membuat endpoint, schema database, atau service yang belum mempunyai requirement dan acceptance criteria

### Infrastructure
- Gunakan environment configuration hanya untuk nilai yang memang berbeda antar-environment
- Jalankan `npm run lint` dan `npm run build` sebelum menandai milestone selesai
- Tambahkan automated test setelah behavior simulasi memiliki aturan stabil yang layak diuji
- Deployment target, analytics, error reporting, dan CI/CD harus dikonfirmasi sebelum disebut aktif
- Asset 3D berukuran besar harus melalui review ukuran file, lisensi, compression, dan strategi Git sebelum masuk repository

## Success Criteria
- Prototype awal dapat menampilkan scene pulau 3D tanpa error aplikasi, dengan kamera yang dapat dikendalikan dan objek yang dapat dipilih
- Gerakan hewan tidak bergantung pada frame rate dan hewan tetap berada pada batas habitat yang ditetapkan
- Pengguna dapat memahami apa yang dapat diklik dan melihat informasi objek tanpa membaca dokumentasi teknis
- Production build berhasil, tidak ada error TypeScript, dan tidak ada request asset yang rusak
- MVP menunjukkan minimal satu hubungan sebab-akibat ekosistem, bukan sekadar galeri model 3D
- Versi polished memiliki performa dan responsivitas yang telah diuji pada perangkat target yang disepakati
- Definisi selesai: ekosistem dapat berubah tanpa skrip linear, tetap stabil, dan nyaman dimainkan pada perangkat target

## Priority
Jumlah hari adalah panduan, bukan target utama. Pindah tahap hanya setelah fitur tahap sebelumnya stabil dan dapat diuji.

1. **Hari 1–2, Prototype**: Pulau placeholder, kamera top-down, pencahayaan, vegetasi placeholder, hewan bergerak, seleksi, dan panel informasi
2. **Hari 3–5, Simulasi Inti**: Species roster berbasis data (langkah awal), waktu simulasi, lapar, haus, makanan, air, batas habitat, mati, dan reproduksi sederhana
3. **Hari 6–9, Bioma & Spesies**: Tiga bioma, enam spesies GLB dengan animasi, hubungan predator–mangsa, serta tiga krisis ekosistem
4. **Hari 10–12, Pengalaman Utama**: UI utama, tutorial, statistik populasi, save lokal, balancing, audio, dan responsivitas
5. **Hari 13–selesai, Optimasi & Release**: Optimasi GLB, instancing tanaman, pengujian, perbaikan bug, dokumentasi, dan deployment

## Timeline
Target milestone harus ditentukan berdasarkan hasil setiap tahap, bukan tanggal kosmetik. Status hanya boleh berubah dengan bukti dari source code.

| Milestone | Output wajib | Status awal |
| --- | --- | --- |
| Hari 1–2 Prototype | Scene interaktif, kamera, pulau placeholder, satu hewan, seleksi, lint dan build | Implemented — lint & build lulus, diverifikasi di browser; lihat `docs/feature/prototype/prototype.md` |
| Hari 3–5 Simulasi Inti | Species roster, waktu simulasi, lapar, haus, makanan, air, batas habitat, mati, reproduksi sederhana | In Progress — species roster dan simulation needs `Implemented` (lint & build lulus, diverifikasi di browser; lihat `docs/feature/species-roster/species-roster.md` dan `docs/feature/simulation-needs/simulation-needs.md`); mati & reproduksi masih `Planned` |
| Hari 6–9 Bioma & Spesies | Tiga bioma, enam spesies GLB, animasi, predator–mangsa, tiga krisis | Planned |
| Hari 10–12 Pengalaman Utama | UI utama, tutorial, statistik populasi, save lokal, balancing, audio, responsivitas | Planned |
| Hari 13–selesai Optimasi & Release | Optimasi GLB, instancing tanaman, pengujian, perbaikan bug, dokumentasi, deployment | Planned |

Project dinyatakan selesai saat ekosistem dapat berubah tanpa skrip linear, tetap stabil, dan nyaman dimainkan pada perangkat target.

Setelah setiap milestone, update status fitur, known limitations, evidence path, dan langkah berikutnya di dokumen ini.
