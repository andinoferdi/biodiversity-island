# Business Requirements Document: Biodiversity Island

Document ID: BRD-BIODIVERSITY-ISLAND-[2026-07-02]
Date: [2026-07-02]
Owner: [Andino Ferdiansah & Wahyu Agung Laksono]
Status: Draft for Product, Design, Engineering, and QA review

## Executive Summary

Biodiversity Island adalah pengalaman web 3D interaktif yang mensimulasikan sebuah pulau dengan hewan, vegetasi, habitat, sumber daya, dan gangguan ekosistem. Pengguna melihat pulau dari sudut pandang atas, menjelajahi area secara non-linear, memilih makhluk hidup, dan memahami dampak perubahan lingkungan melalui visual serta data yang mudah dibaca.

Tujuan project ini adalah menghasilkan karya portfolio yang menunjukkan kemampuan frontend, 3D web, interaksi, simulasi, data modeling, performance optimization, dan product thinking. Fokus BRD ini adalah nilai yang harus diberikan, batas scope, requirement tingkat bisnis, kriteria sukses, serta kondisi yang harus divalidasi sebelum project berkembang dari prototype ke produk yang polished.

Current baseline yang terverifikasi adalah repository Next.js 16.2.10 dengan App Router, React 19, TypeScript, Tailwind CSS v4, ESLint, React Compiler, npm, folder `src/`, dan Git dengan remote origin. Dependency 3D sudah terpasang dan terverifikasi di `package.json`: `three`, `@react-three/fiber`, `@react-three/drei`, dan `@types/three`.

Day 1 Prototype sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): scene pulau 3D top-down, kamera orthographic dengan MapControls, vegetasi placeholder, satu hewan bergerak yang dapat dipilih, dan panel informasi. Bukti: `src/components/prototype/` dan dokumentasi di `docs/feature/prototype/prototype.md`. Simulation system (kebutuhan, waktu, sebab-akibat ekosistem) belum ada dan tidak boleh dianggap selesai tanpa bukti dari source code.

## Business Objectives

1. Objective-001: Menyediakan pengalaman eksplorasi ekosistem 3D yang menarik dan dapat dipahami tanpa alur halaman yang linear.
2. Objective-002: Menunjukkan hubungan sebab-akibat antara spesies, habitat, sumber daya, dan gangguan lingkungan melalui simulasi yang dapat diamati.
3. Objective-003: Menghasilkan portfolio teknis yang membuktikan kemampuan membangun aplikasi Next.js dan Three.js yang interaktif, terstruktur, responsif, dan teroptimasi.
4. Objective-004: Menyediakan dasar project yang dapat dikembangkan bertahap dari prototype kecil tanpa terjebak pada produksi banyak asset sebelum gameplay loop terbukti.

## Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Project Owner | [Andino Ferdiansah] | Product direction, scope, priority, and final decisions |
| Product / UX | [Andino Ferdiansah] | User flow, interaction, information hierarchy, and usability |
| Technical Owner | [Andino Ferdiansah] | Architecture, implementation, validation, performance, and delivery |
| 3D / Asset Owner | [Wahyu Agung Laksono] | Modeling, rigging, animation, export, optimization, and licensing |
| QA / Reviewer | [Wahyu Agung Laksono] | Functional, visual, responsive, browser, and performance validation |
| Target Users | Portfolio reviewer, learner, dan pengguna web umum | Exploration, feedback, and usability validation |

## Scope

### In Scope
- Satu pulau 3D dengan laut, terrain, vegetasi, pencahayaan, dan kamera top-down yang dapat dikendalikan.
- Hewan yang bergerak, dapat dipilih, memiliki data ringkas, dan pada MVP bereaksi terhadap kebutuhan atau kondisi habitat.
- UI overlay untuk instruksi, detail objek, kontrol waktu, status simulasi, serta indikator kesehatan ekosistem bila sudah masuk milestone.
- Sistem ekosistem bertahap yang dapat mencakup makanan, air, habitat, predator dan mangsa, reproduksi, kematian, serta event lingkungan sederhana.
- Pipeline asset GLB yang mencakup source, skala, origin, material, rig, animasi, export, compression, attribution, dan runtime validation.
- Performance, responsive behavior, accessibility dasar, loading state, browser compatibility, documentation, dan deployment untuk release.

### Out of Scope
- Open-world berskala besar, multiplayer, akun pengguna, marketplace, pembayaran, atau backend kompleks pada MVP.
- Puluhan spesies, simulasi ilmiah presisi tinggi, genetics system, procedural world besar, atau AI hewan tingkat lanjut sebelum vertical slice stabil.
- Pembuatan semua model final sebelum satu model uji berhasil melewati pipeline Blender ke GLB dan berjalan baik di browser.
- Native mobile app, VR, AR, atau desktop executable tanpa inisiatif terpisah.
- Klaim ilmiah atau data konservasi yang tidak mempunyai sumber dan review yang jelas.

## Functional Requirements

- FR-001: Sistem harus menampilkan scene pulau 3D yang dapat dijelajahi dari kamera top-down.
- FR-002: Pengguna harus dapat melakukan pan, zoom, dan rotasi terbatas tanpa memindahkan kamera ke posisi yang merusak pengalaman.
- FR-003: Sistem harus menampilkan minimal satu hewan yang bergerak secara otomatis dan tetap berada dalam batas habitat.
- FR-004: Pengguna harus dapat memilih hewan dan melihat informasi yang relevan pada panel UI.
- FR-005: Sistem harus memberikan feedback visual untuk hover, selection, loading, error, dan perubahan status penting.
- FR-006: MVP harus menyediakan kontrol waktu atau mekanisme observasi yang membuat perubahan ekosistem dapat dipahami.
- FR-007: MVP harus memiliki minimal satu hubungan sebab-akibat, misalnya ketersediaan air memengaruhi kondisi atau pergerakan hewan.
- FR-008: Sistem harus dapat memuat model GLB dan animasi setelah asset pipeline dinyatakan stabil.
- FR-009: Sistem harus menyediakan reset atau pemulihan state simulasi agar pengguna dapat mengulang skenario.
- FR-010: Dokumentasi harus membedakan fitur yang sudah diimplementasikan, sedang dikerjakan, direncanakan, dan ditunda.

## Non-Functional Requirements

- NFR-001: Prototype harus lolos TypeScript check, lint, dan production build sesuai script repository yang tersedia.
- NFR-002: Scene harus mempertahankan interaksi yang responsif pada perangkat referensi yang disepakati, dengan target frame rate dicatat setelah profiling awal.
- NFR-003: Loading asset harus menampilkan status yang jelas dan tidak membuat halaman kosong tanpa feedback.
- NFR-004: UI harus tetap dapat dibaca pada desktop dan viewport mobile yang disepakati.
- NFR-005: Pointer interaction harus memiliki alternatif yang layak untuk touch, dan kontrol penting tidak boleh bergantung hanya pada hover.
- NFR-006: Asset harus memiliki lisensi, attribution, ukuran file, polycount, texture size, dan status optimasi yang dapat dilacak.
- NFR-007: Object, geometry, material, texture, dan animation resource yang tidak digunakan harus dikelola agar tidak menimbulkan memory leak yang jelas.
- NFR-008: Tidak boleh ada hardcoded secret, credential, atau endpoint privat di source code dan dokumentasi.

## Assumptions

- Project dikembangkan secara bertahap oleh satu developer dengan bantuan AI coding agent.
- Next.js App Router, TypeScript, Tailwind CSS, React Compiler, ESLint, npm, dan folder `src/` tetap menjadi baseline sampai ada keputusan teknis baru.
- Three.js, React Three Fiber, dan Drei digunakan hanya setelah package dan integrasinya diverifikasi di repository.
- Asset awal memakai primitive geometry atau asset berlisensi jelas, lalu diganti bertahap setelah pipeline GLB stabil.
- Data spesies awal bersifat edukatif dan sederhana, lalu diperkuat dengan sumber yang dapat dipercaya jika project memuat klaim ilmiah.
- Target device, browser, frame rate, bundle budget, deployment platform, dan analytics masih perlu dikonfirmasi melalui milestone performance dan release.

## Success Criteria

- Kriteria-001: Pengguna dapat memahami cara menjelajahi pulau dan memilih hewan tanpa tutorial panjang.
- Kriteria-002: Prototype membuktikan scene, camera control, animal movement, selection, panel informasi, lint, dan build dapat berjalan bersama.
- Kriteria-003: Vertical slice membuktikan satu model GLB, animasi, data spesies, kebutuhan dasar, dan feedback UI dapat berjalan tanpa arsitektur berlebihan.
- Kriteria-004: MVP menunjukkan perubahan ekosistem yang dapat diamati dan dijelaskan melalui data atau visual.
- Kriteria-005: Release candidate mempunyai asset attribution, browser check, responsive check, performance evidence, known issues, dan dokumentasi yang diperbarui.
