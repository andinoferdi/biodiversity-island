# Markdown Software Requirements Specification (MSRS)

Template **Software Requirements Specification (SRS)** berbasis markdown untuk mendokumentasikan kebutuhan software project `biodiversity-island` secara jelas, terukur, dan mudah dipahami oleh product, design, engineering, QA, dan AI coding agent. Dokumen ini mengikuti praktik umum SRS modern yang menekankan requirement yang dapat diverifikasi, traceability, quality attributes, serta pemisahan antara kebutuhan produk dan detail implementasi.

Template ini dipakai untuk Biodiversity Island, simulasi ekosistem pulau 3D berbasis web dengan sudut pandang atas. Pengguna dapat menjelajahi pulau, mengamati hewan, memilih objek, melihat data spesies, dan pada fase berikutnya mengelola habitat serta melihat dampak perubahan ekosistem.

Baseline project yang sudah terverifikasi:
- Next.js 16.2.10 dengan App Router
- React 19, TypeScript, Tailwind CSS v4, ESLint, dan React Compiler
- Source code di folder `src/`
- npm sebagai package manager
- Repository Git dengan remote origin
- Dependency 3D terpasang: `three`, `@react-three/fiber` v9, `@react-three/drei` v10, `@types/three`
- Fase Hari 1–2 (prototype) `Implemented` di `src/components/prototype/` — scene pulau, kamera top-down, vegetasi, satu hewan bergerak, seleksi, dan panel informasi; lint serta production build lulus (dokumentasi: `docs/feature/prototype/prototype.md`)
- Branch `develop` sudah ada sebagai basis integrasi
- Langkah awal fase Hari 3–5 (species roster) `Implemented` di branch `andino/feat/species-roster` — 3 spesies berbasis data (`src/components/prototype/species.ts`), 8 individu (`src/components/prototype/Animal.tsx`), seleksi per-id, panel data spesies; lint serta production build lulus (dokumentasi: `docs/feature/species-roster/species-roster.md`)
- Langkah kedua fase Hari 3–5 (simulation needs) `Implemented` di branch `andino/feat/simulation-needs` — waktu simulasi Pause/1×/4×, kebutuhan lapar–haus per spesies, sumber daya 1 kolam + 3 petak makanan (`src/components/prototype/simulation.ts`), perilaku berbasis kebutuhan dan status/bar live di panel; lint serta production build lulus (dokumentasi: `docs/feature/simulation-needs/simulation-needs.md`)
- Langkah terakhir fase Hari 3–5 (population lifecycle) `Implemented` di branch `andino/feat/population-lifecycle` — kematian setelah kebutuhan bertahan di maksimum (status "Starving"/"Dehydrated"), reproduksi sederhana berbasis timer well-fed, batas populasi 24, sensus live, deselect otomatis saat hewan terpilih mati (`src/components/prototype/simulation.ts`, `Animal.tsx`, `BiodiversityPrototype.tsx`); lint serta production build lulus (dokumentasi: `docs/feature/population-lifecycle/population-lifecycle.md`)

Fase Hari 3–5 (Simulasi Inti) selesai. Fitur fase berikutnya (asset GLB, bioma, predator–mangsa, krisis, save lokal) belum ada di source code. Dependency dan fitur harus selalu diverifikasi dari `package.json` dan source code sebelum dianggap sudah terpasang atau selesai.

## Roadmap & Milestones

Jumlah hari adalah panduan, bukan target utama. Pindah tahap hanya setelah fitur tahap sebelumnya stabil dan dapat diuji. Pembagian peran teknis: Next.js menangani struktur aplikasi, React Three Fiber menangani Canvas, interaksi, dan animasi per frame, GLTFLoader memuat aset GLB, dan InstancedMesh mengurangi draw call untuk vegetasi berulang.

1. **Hari 1–2 — Prototype** (`Implemented`): pulau placeholder, kamera, cahaya, hewan bergerak, seleksi, dan panel informasi.
2. **Hari 3–5 — Simulasi Inti** (`Implemented` — species roster, simulation needs, dan population lifecycle semuanya tervalidasi): waktu simulasi, lapar, haus, makanan, air, batas habitat, mati, dan reproduksi sederhana.
3. **Hari 6–9 — Bioma & Spesies** (`Planned`): tiga bioma, enam spesies GLB, animasi, predator–mangsa, serta tiga krisis.
4. **Hari 10–12 — Pengalaman Utama** (`Planned`): UI utama, tutorial, statistik populasi, save lokal, balancing, audio, dan responsivitas.
5. **Hari 13–selesai — Optimasi & Release** (`Planned`): optimasi GLB, instancing tanaman, pengujian, perbaikan bug, dokumentasi, dan deployment.

Project selesai saat ekosistem dapat berubah tanpa skrip linear, tetap stabil, dan nyaman dimainkan pada perangkat target. Requirement pada Section 3 harus dipetakan ke salah satu tahap di atas.

Designed to be:
- Readable, developer-friendly, dan AI-interpretable untuk pengembangan Biodiversity Island
- Cukup lengkap untuk project simulasi 3D nyata, tetapi tetap fleksibel untuk milestone kecil
- Mudah diperbarui sesuai tahap roadmap: Hari 1–2, Hari 3–5, Hari 6–9, Hari 10–12, dan Hari 13–selesai

## Highlights

- **Standards-aware:** dapat diselaraskan dengan IEEE 830 dan ISO/IEC/IEEE 29148 bila project membutuhkan formalitas lebih tinggi
- **Comprehensive structure** dengan pola requirement yang jelas, testable, dan relevan untuk Next.js, React, TypeScript, serta scene Three.js
- Dedicated sections untuk performance WebGL, accessibility, responsive behavior, asset pipeline, simulation rules, loading, error handling, dan observability bila relevan
- **Built-in guidance, tips, and checklists** untuk kamera, terrain, hewan, vegetasi, interaksi, state simulasi, UI overlay, serta optimasi aset GLB
- **Traceability-ready** dengan requirement ID dan verification matrix yang dapat dihubungkan ke issue, commit, PR, component, test, asset, dan milestone
- Cocok untuk workflow bertahap dari Day 1 prototype sampai versi yang polished tanpa menganggap fitur rencana sebagai fitur yang sudah ada

## Who Should Use This

- **Product owner dan designer** yang mendefinisikan pengalaman eksplorasi, simulasi, scope, dan prioritas
- **Frontend dan 3D engineer** yang merancang solusi Next.js, React Three Fiber, Three.js, UI, serta asset pipeline
- **QA dan performance reviewer** yang menyiapkan verification, test plan, device target, dan acceptance criteria
- **Content atau biodiversity reviewer** yang memeriksa data spesies, habitat, rantai makanan, dan pesan edukasi
- **AI agent atau coding assistant** yang perlu memahami status project sebelum mengubah component, scene, state, style, atau asset

## Quick Start

1. Simpan dokumen ini sebagai `srs.md` di root repository atau folder dokumentasi.
2. Baca `package.json`, `src/`, file konfigurasi, `brd.md`, `prd.md`, dan `git-workflow.md` sebelum menulis requirement atau kode.
3. Isi metadata version, author, date, status dokumen, serta milestone target.
4. Gunakan status `Implemented`, `In Progress`, `Planned`, atau `Deferred` pada requirement agar agent tidak mengarang progres.
5. Tulis requirement dengan ID unik, acceptance criteria, prioritas, dan bukti implementasi seperti path component, test, screenshot, atau commit.
6. Definisikan verification untuk lint, production build, browser check, interaction test, serta performance check pada perangkat target.
7. Update revision history setelah milestone selesai atau keputusan teknis berubah.

## Template Structure (Overview)

1. Introduction: Purpose, scope, glossary, references, status implementasi, dan document conventions
2. Product Overview: Context Biodiversity Island, user experience, constraints, assumptions, dan milestone
3. Requirements:
    - External Interfaces: UI overlay, pointer input, keyboard input, touch input, browser, WebGL, serta asset GLB (dimuat via GLTFLoader) bila sudah digunakan
    - Functional Requirements: camera navigation, island scene, animal movement, object selection, species information, simulasi inti Hari 3–5 (waktu, lapar, haus, makanan, air, batas habitat, mati, reproduksi), bioma dan krisis Hari 6–9 (predator–mangsa, tiga krisis), pengalaman Hari 10–12 (tutorial, statistik populasi, save lokal), dan reset simulation
    - Quality of Service: frame rate, loading time, bundle size, draw call (instancing vegetasi dengan InstancedMesh pada Hari 13–selesai), reliability, usability, accessibility, responsive layout, memory disposal, dan error handling
    - Content & Data: data spesies, sumber data, attribution, satuan, habitat, diet, behavior, dan validasi konten
    - Design & Implementation Constraints: Next.js 16, App Router, TypeScript, Tailwind, React Compiler, npm, browser rendering, asset budget, build, dan deployment
    - AI/Agent Workflow: aturan membaca dokumentasi, memeriksa source code, membatasi scope, menjalankan validasi, dan memperbarui status milestone
4. Verification: lint, build, manual browser check, interaction scenarios, responsive check, performance profile, dan traceability
5. Appendixes: diagram, screenshot, asset list, data schema, decision log, known limitations, dan referensi PR

## Workflows

* `srs.md` — Kebutuhan software dan quality attributes Biodiversity Island.
* `prd.md` — Scope produk, pengalaman pengguna, fitur, milestone, dan success criteria.
* `brd.md` — Tujuan, nilai, stakeholder, scope bisnis, dan batasan project.
* `git-workflow.md` — Aturan branch, commit, PR, validasi, dan pengelolaan asset.

#### One-shot document

  * Isi requirement untuk satu milestone yang jelas.
  * Jalankan review terhadap source code dan status implementasi.
  * Bagikan ke product, engineering, QA, dan reviewer untuk persetujuan scope.

#### Long-lived SRS in VCS

  * Perlakukan `srs.md` sebagai living document, bukan arsip statis.
  * Tambahkan atau ubah requirement secara bertahap sesuai issue, PR, dan milestone Biodiversity Island.
  * Jangan menandai requirement sebagai `Implemented` tanpa bukti di repository.
  * Berikan SRS ke AI agent sebagai konteks utama sebelum coding.
  * Setelah implementasi selesai, update status, verification evidence, dan known limitations.

#### Breakout files (MADR-inspired)

  * Kelola SRS utama plus requirement terpisah di `requirements/` bila satu sistem mulai terlalu besar.
  * Gunakan file terpisah untuk area besar seperti animal simulation, habitat system, crisis events, asset pipeline, atau performance budget.
  * Link setiap requirement dari index Section 3 di SRS.
  * Track hubungan requirement, issue, commit, PR, component, asset, test, dan release di Section 4.

#### Requirements-only (MADR-style)

  * Kelola `requirements/*.md` tanpa SRS monolithic bila project berkembang menjadi beberapa modul besar.
  * Generate index atau ringkasan SRS jika dibutuhkan.

## On Requirements Engineering

#### Overlaps Between Functional and Non-Functional Requirements

Dalam Biodiversity Island, batas functional requirement dan non-functional requirement dapat tumpang tindih. Contohnya, menampilkan banyak pohon dan hewan merupakan fungsi visual, tetapi jumlah objek, LOD, instancing, serta ukuran texture juga menentukan frame rate, waktu muat, dan stabilitas memori.

#### Why Requirement Taxonomies Still Matter

Kategorisasi tetap penting agar tim dapat membedakan apa yang pengguna lakukan, bagaimana simulasi bereaksi, seberapa baik scene harus berjalan, data apa yang dapat dipercaya, dan batas teknis apa yang tidak boleh dilanggar. Struktur ini membantu mencegah agent menggabungkan terlalu banyak fitur dalam satu milestone atau menganggap aset final sudah tersedia.

Untuk developer, QA, designer, dan AI agent di `biodiversity-island`, taxonomy requirement menjadi peta kerja dari analisis, prototype, implementasi, testing, optimasi, sampai polishing.

## Related Projects

* `brd.md` untuk tujuan dan kebutuhan tingkat bisnis Biodiversity Island
* `prd.md` untuk kebutuhan produk, scope, milestone, dan success criteria
* `git-workflow.md` untuk branch, commit, PR, validation, dan asset handling
* `AGENTS.md` dan `CLAUDE.md` untuk aturan coding agent yang berlaku di repository
* Issue atau task notes untuk acceptance criteria, keputusan teknis, dan riwayat implementasi

## License

Dokumen ini dapat disalin, diubah, dan digunakan untuk project Biodiversity Island. Lisensi source code dan asset 3D harus mengikuti lisensi repository serta sumber asset masing-masing.
