# Biodiversity Island - Product Requirements Document

## Overview
Build pengalaman web 3D interaktif bernama Biodiversity Island. Pengguna melihat sebuah pulau dari sudut pandang atas, menggerakkan kamera, mengamati hewan, memilih objek, dan memahami hubungan antara spesies, habitat, sumber daya, serta gangguan ekosistem.

Dokumen ini adalah living PRD. Gunakan status berikut agar rencana tidak tercampur dengan implementasi nyata:
- `Implemented`: tersedia dan sudah diverifikasi di source code
- `In Progress`: sedang dikerjakan pada branch aktif
- `Planned`: disetujui untuk milestone berikutnya
- `Deferred`: sengaja ditunda

Current baseline yang terverifikasi adalah project Next.js 16.2.10 dengan App Router, React 19, TypeScript, Tailwind CSS v4, ESLint, React Compiler, folder `src/`, npm, dan repository Git dengan remote origin. Dependency 3D (`three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`) sudah terpasang. Day 1 Prototype sudah `Implemented` di `src/components/prototype/` (lihat `docs/feature/prototype/prototype.md`). Asset GLB dan simulation system belum ada — periksa repository sebelum mengubah status fitur lain menjadi `Implemented`.

## Core Features

### User Management
- MVP tidak membutuhkan login, akun, profil, role, permission, atau penyimpanan data pengguna
- Pengalaman utama harus dapat dibuka langsung dari halaman utama tanpa onboarding panjang
- Persistensi setting lokal dapat dipertimbangkan setelah simulasi inti stabil

### Main Feature
- `Implemented`: Scene pulau 3D dengan laut, terrain, vegetasi, pencahayaan, dan kamera top-down yang dapat di-pan, zoom, serta dirotasi secara terbatas — `src/components/prototype/IslandScene.tsx`
- `Implemented`: Satu hewan placeholder ("Island Grazer") yang bergerak otomatis, tetap berada di area pulau, dan dapat dipilih dengan pointer — `src/components/prototype/PlaceholderAnimal.tsx`
- `Implemented`: Panel informasi hewan terpilih yang menampilkan nama, status, habitat, dan posisi, plus tombol Deselect — `src/components/prototype/BiodiversityPrototype.tsx`
- `Planned`: Tahap MVP menambah beberapa spesies, kebutuhan dasar, sumber air atau makanan, kontrol waktu, dan hubungan sederhana antarspesies
- `Planned`: Tahap lanjutan menambah perubahan habitat, kejadian seperti kekeringan atau kebakaran, metrik kesehatan ekosistem, serta konsekuensi dari tindakan pengguna
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
- Gunakan format GLB untuk model runtime setelah asset pipeline lolos uji satu model, rig, animasi, export, loading, dan disposal
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

## Priority
1. **Phase 1, Day 1 Prototype**: Setup scene, kamera top-down, pulau primitive, pencahayaan, vegetasi placeholder, satu hewan bergerak, seleksi, dan panel informasi
2. **Phase 2, Vertical Slice**: Satu model GLB tervalidasi, animasi dasar, data spesies, kebutuhan makan atau minum, kontrol waktu, dan satu interaksi habitat
3. **Phase 3, MVP Ecosystem**: Beberapa spesies, resource loop, reproduksi atau kematian sederhana, event ekosistem, indikator kesehatan, reset, dan tutorial ringkas
4. **Phase 4, Polish**: Asset final, audio, loading state, visual feedback, accessibility, mobile controls, performance profiling, compression, dan browser testing
5. **Phase 5, Release**: QA, content review, attribution asset, deployment, analytics yang disetujui, dokumentasi, dan backlog pascarilis

## Timeline
Target milestone harus ditentukan berdasarkan hasil setiap fase, bukan tanggal kosmetik.

| Milestone | Output wajib | Status awal |
| --- | --- | --- |
| Day 1 Prototype | Scene interaktif, kamera, pulau placeholder, satu hewan, seleksi, lint dan build | Implemented — lint & build lulus, diverifikasi di browser; lihat `docs/feature/prototype/prototype.md` |
| Vertical Slice | Satu spesies dengan model dan animasi, data, kebutuhan dasar, UI minimum | Planned |
| MVP Ecosystem | Beberapa spesies dan satu loop ekosistem yang dapat berubah | Planned |
| Polish | Asset, audio, UX, performance, responsive, accessibility | Planned |
| Release Candidate | QA, attribution, deployment, known issues, documentation | Planned |

Setelah setiap milestone, update status fitur, known limitations, evidence path, dan langkah berikutnya di dokumen ini.
