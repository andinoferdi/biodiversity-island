# Business Requirements Document: Biodiversity Island

Document ID: BRD-BIODIVERSITY-ISLAND-[2026-07-02]
Date: [2026-07-02]
Owner: [Andino Ferdiansah & Wahyu Agung Laksono]
Status: Draft for Product, Design, Engineering, and QA review

## Executive Summary

Biodiversity Island adalah pengalaman web 3D interaktif yang mensimulasikan sebuah pulau dengan hewan, vegetasi, habitat, sumber daya, dan gangguan ekosistem. Pengguna melihat pulau dari sudut pandang atas, menjelajahi area secara non-linear, memilih makhluk hidup, dan memahami dampak perubahan lingkungan melalui visual serta data yang mudah dibaca.

Tujuan project ini adalah menghasilkan karya portfolio yang menunjukkan kemampuan frontend, 3D web, interaksi, simulasi, data modeling, performance optimization, dan product thinking. Fokus BRD ini adalah nilai yang harus diberikan, batas scope, requirement tingkat bisnis, kriteria sukses, serta kondisi yang harus divalidasi sebelum project berkembang dari prototype ke produk yang polished.

Current baseline yang terverifikasi adalah repository Next.js 16.2.10 dengan App Router, React 19, TypeScript, Tailwind CSS v4, ESLint, React Compiler, npm, folder `src/`, dan Git dengan remote origin. Dependency 3D sudah terpasang dan terverifikasi di `package.json`: `three`, `@react-three/fiber`, `@react-three/drei`, dan `@types/three`.

Fase Hari 1–2 (prototype) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): scene pulau 3D top-down, kamera orthographic dengan MapControls, vegetasi placeholder, satu hewan bergerak yang dapat dipilih, dan panel informasi. Bukti: `src/components/prototype/` dan dokumentasi di `docs/feature/prototype/prototype.md`. Simulation system (kebutuhan, waktu, sebab-akibat ekosistem) belum ada dan tidak boleh dianggap selesai tanpa bukti dari source code.

Project mengikuti roadmap lima tahap: Hari 1–2 prototype; Hari 3–5 simulasi inti (waktu, lapar, haus, makanan, air, batas habitat, mati, reproduksi sederhana); Hari 6–9 tiga bioma, enam spesies GLB, animasi, predator–mangsa, dan tiga krisis; Hari 10–12 UI utama, tutorial, statistik populasi, save lokal, balancing, audio, dan responsivitas; Hari 13–selesai optimasi GLB, instancing tanaman, pengujian, perbaikan bug, dokumentasi, dan deployment. Jumlah hari adalah panduan, bukan target — pindah tahap hanya setelah tahap sebelumnya stabil dan dapat diuji.

Langkah awal Hari 3–5 (species roster) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): 3 spesies placeholder berbasis data, 8 individu berkeliaran bersamaan, seleksi per-individu, panel data spesies, dan ringkasan populasi. Bukti: `src/components/prototype/species.ts`, `src/components/prototype/Animal.tsx`, dan dokumentasi di `docs/feature/species-roster/species-roster.md`.

Langkah kedua Hari 3–5 (simulation needs) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): waktu simulasi dengan kontrol Pause/1×/4×, kebutuhan lapar–haus per spesies, satu kolam air dan tiga petak makanan, perilaku berbasis kebutuhan (cari → konsumsi → kembali berkeliaran), serta status dan bar kebutuhan live di panel — memenuhi FR-006 dan FR-007. Bukti: `src/components/prototype/simulation.ts`, `src/components/prototype/Animal.tsx`, dan dokumentasi di `docs/feature/simulation-needs/simulation-needs.md`.

Langkah terakhir Hari 3–5 (population lifecycle) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): kematian saat kebutuhan bertahan di maksimum (dengan status peringatan "Starving"/"Dehydrated"), reproduksi sederhana berbasis timer well-fed dengan biaya kebutuhan induk, batas populasi 24, sensus live di header, dan deselect otomatis saat hewan terpilih mati. Bukti: `src/components/prototype/simulation.ts`, `src/components/prototype/Animal.tsx`, `src/components/prototype/BiodiversityPrototype.tsx`, dan dokumentasi di `docs/feature/population-lifecycle/population-lifecycle.md`. Fase Hari 3–5 (Simulasi Inti) dengan ini selesai.

Fase Hari 6–9 (Bioma & Spesies) kini **In Progress**. Langkah pertamanya (biome terrain) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): tiga bioma sebagai sektor 120° (hutan, padang rumput, pesisir) dengan warna tanah berbeda, sumber daya per bioma (2 kolam + 3 petak makanan), bioma rumah per spesies dengan batas habitat lunak (steer kembali tanpa dinding keras), serta validasi pertama pipeline GLB — vegetasi primitif diganti `tree.glb`, `rock.glb`, `log.glb` dari `public/assets/environment/` via drei `useGLTF` + `Clone` + preload dengan `Suspense` fallback. Bukti: `src/components/prototype/biomes.ts`, `src/components/prototype/EnvironmentModels.tsx`, dan dokumentasi di `docs/feature/biome-terrain/biome-terrain.md`.

Langkah kedua fase Hari 6–9 (animal species) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): tiga spesies placeholder diganti enam spesies dengan model GLB dari `public/assets/animal/` (deer, dove, duck, elephant, fish, turtle) yang tersebar di bioma rumah masing-masing, dengan deer sebagai satu-satunya model beranimasi (klip Walk/Eating mengikuti status simulasi dan kontrol waktu). Bukti: `src/components/prototype/AnimalModel.tsx`, `src/components/prototype/species.ts`, dan dokumentasi di `docs/feature/animal-species/animal-species.md`.

Langkah ketiga fase Hari 6–9 (dynamic terrain) sudah **Implemented** dan tervalidasi (lint, production build, dan pengujian browser lulus): pulau silinder prosedural tiga-sektor diganti mesh 3D nyata `terrain.glb` (bukit, tebing, sungai) yang dibungkus `<Bvh>` dari drei; posisi Y dan bioma hewan kini dihitung dinamis lewat raycasting vertikal per frame, bukan rumus 2D. Bioma disederhanakan menjadi dua kategori berbasis ketinggian air — River dan Land (gabungan Forest & Grassland lama) — dan setiap spesies punya aturan navigasi berbasis locomotion (ikan terkunci di air, bebek bebas di mana saja, spesies lain terkunci di darat dan hanya menyentuh tepi sungai saat minum). Bukti: `src/components/prototype/terrain.ts`, `src/components/prototype/Animal.tsx`, `src/components/prototype/biomes.ts`, dan dokumentasi di `docs/feature/dynamic-terrain/dynamic-terrain.md`. Langkah lanjutan fase ini (predator–mangsa dan tiga krisis) belum ada.

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
- Satu pulau 3D dengan laut, terrain, vegetasi, pencahayaan, dan kamera top-down yang dapat dikendalikan, berkembang menjadi tiga bioma pada fase Hari 6–9.
- Hewan yang bergerak, dapat dipilih, memiliki data ringkas, dan mulai fase Hari 3–5 bereaksi terhadap kebutuhan (lapar, haus) serta kondisi habitat.
- Sistem simulasi inti (Hari 3–5): waktu simulasi, lapar, haus, makanan, air, batas habitat, mati, dan reproduksi sederhana.
- Enam spesies dengan model GLB dan animasi, hubungan predator–mangsa, serta tiga krisis ekosistem (Hari 6–9).
- UI utama, tutorial, statistik populasi, save lokal via localStorage tanpa backend, balancing, audio, dan responsivitas (Hari 10–12).
- UI overlay untuk instruksi, detail objek, kontrol waktu, status simulasi, serta indikator kesehatan ekosistem bila sudah masuk milestone.
- Pipeline asset GLB yang mencakup source, skala, origin, material, rig, animasi, export, compression, attribution, dan runtime validation; loading runtime memakai GLTFLoader.
- Optimasi GLB, instancing vegetasi dengan InstancedMesh, performance, accessibility dasar, loading state, browser compatibility, pengujian, dokumentasi, dan deployment untuk release (Hari 13–selesai).

### Out of Scope
- Open-world berskala besar, multiplayer, akun pengguna, marketplace, pembayaran, atau backend kompleks pada MVP.
- Puluhan spesies (di atas enam spesies roadmap), simulasi ilmiah presisi tinggi, genetics system, procedural world besar, atau AI hewan tingkat lanjut sebelum simulasi inti Hari 3–5 stabil.
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
- FR-011: Sistem harus dapat menyimpan dan memulihkan state simulasi secara lokal (localStorage) tanpa backend pada fase Hari 10–12.
- FR-012: Sistem harus menyediakan statistik populasi dan tutorial ringkas agar pengguna memahami kondisi ekosistem dan cara bermain.
- FR-013: Sistem harus menyediakan tiga bioma dan tiga krisis ekosistem yang dapat diamati dampaknya pada fase Hari 6–9.

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
- Kriteria-002: Prototype (Hari 1–2) membuktikan scene, camera control, animal movement, selection, panel informasi, lint, dan build dapat berjalan bersama.
- Kriteria-003: Simulasi inti (Hari 3–5) menunjukkan waktu simulasi, lapar, haus, makanan, air, batas habitat, mati, dan reproduksi sederhana yang dapat diamati tanpa skrip linear.
- Kriteria-004: Fase Hari 6–9 menunjukkan tiga bioma, enam spesies GLB beranimasi, hubungan predator–mangsa, dan tiga krisis yang dampaknya dapat dijelaskan melalui data atau visual.
- Kriteria-005: Fase Hari 10–12 menghadirkan UI utama, tutorial, statistik populasi, save lokal, balancing, audio, dan responsivitas yang nyaman digunakan.
- Kriteria-006: Release (Hari 13–selesai) mempunyai optimasi GLB, instancing vegetasi, hasil pengujian, asset attribution, known issues, dokumentasi terbaru, dan deployment.
- Kriteria-007: Project dinyatakan selesai saat ekosistem dapat berubah tanpa skrip linear, tetap stabil, dan nyaman dimainkan pada perangkat target.
