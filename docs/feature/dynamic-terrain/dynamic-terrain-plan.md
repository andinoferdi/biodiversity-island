# Dynamic Terrain & Geographic Biomes — Implementation Plan

## Context
Rencana ini menggantikan pulau silinder datar prosedural dengan terrain 3D *low-poly* (`terrain.glb`). Karena terrain baru ini memiliki elevasi (bukit, tebing, sungai), kita harus membuang matematika 2D (*flat plane*) dan beralih ke **Dynamic Raycasting** untuk mengkalkulasi posisi sumbu Y entitas. Bioma bersudut (120 derajat) juga dihapus dan diganti dengan bioma geografis murni berbasis elevasi (tinggi air).

## Design & Architecture

### 1. Terrain & BVH Acceleration
- Gunakan `useGLTF("/assets/environment/terrain/terrain.glb")` dan bungkus mesh utamanya ke dalam komponen `<Bvh>` dari `@react-three/drei`. Ini adalah prasyarat wajib agar raycasting pada puluhan hewan tidak menghancurkan *framerate*.
- Hapus silinder `<Island>` yang lama di `IslandScene.tsx` dan ganti dengan komponen baru `<TerrainGLB>`.
- Terapkan layar loading (HTML fallback pada `<Suspense>`) menggunakan `thumbnail.jpg` sebagai latar belakang untuk menyamarkan waktu *load* aset 2.3MB.

### 2. Geographic Biomes (Height-based)
Logika *wedge* matematis dibuang seluruhnya. Bioma kini hanya bergantung pada titik potong Raycast (`hit.point.y`):
- **River**: Didefinisikan secara statis sebagai `Y <= WATER_LEVEL`.
- **Land**: Didefinisikan sebagai `Y > WATER_LEVEL` (menggabungkan area Forest dan Grassland dari PRD lama menjadi satu bioma terestrial).

### 3. Dynamic Raycasting di `Animal.tsx`
- Pada loop `useFrame`, tempatkan origin Raycaster sedikit di atas kepala hewan pada koordinat `(X, Z)` saat ini, arahkan lurus ke bawah `(0, -1, 0)`.
- **Jika mengenai tanah:**
  - `hit.point.y` menjadi `GROUND_Y` dinamis hewan tersebut untuk *frame* ini.
  - Periksa kemiringan lereng via `hit.face.normal.y`. Jika nilai kemiringannya berada di bawah ambang batas (misal `< 0.7`, yang menandakan lereng terjal/tebing), hewan harus memperlakukannya sebagai dinding tabrakan (`obstacle`) dan memutar `headingTarget`.
- **Jika tidak mengenai tanah:**
  - Ini berarti hewan berjalan melampaui ujung *mesh* terrain. Hewan harus bereaksi seolah menabrak dinding dan memutar arah kembali ke pusat `(0,0)`. Ini menggantikan batas matematis absolut `WALK_RADIUS`.

### 4. Spesific Animal Navigation Rules
Sistem pergerakan dimodifikasi untuk menghargai aturan spesies:
- **Ikan (Air)**: Saat membuat `wanderTarget` baru, sistem harus memvalidasi bahwa titik baru tersebut jatuh pada ketinggian `Y <= WATER_LEVEL`.
- **Bebek (Amfibi)**: Dapat menghasilkan `wanderTarget` di mana saja tanpa dibatasi ketinggian.
- **Hewan Darat Lainnya**: `wanderTarget` harus diverifikasi jatuh pada ketinggian `Y > WATER_LEVEL`. Saat *Seek Water* (haus), mekanisme diganti dari mencari 'titik kolam' (`ResourceSpot`) menjadi mencari koordinat batas garis tepi terdekat antara air dan daratan (`WATER_LEVEL`).

## Execution Steps
1. Buat komponen `<TerrainGLB>` di file baru atau di `EnvironmentModels.tsx`, bungkus dengan `Bvh`.
2. Hapus mesh silinder primitif di `IslandScene.tsx` dan ganti dengan `<TerrainGLB>`. Integrasikan `thumbnail.jpg` pada `fallback` UI Suspense.
3. Perbarui `biomes.ts` untuk merepresentasikan bioma River dan Land dengan fungsi validasi Y-axis yang baru.
4. Perbarui `simulation.ts` untuk mendefinisikan konstanta fisik baru: `WATER_LEVEL` dan batas sudut *slope*.
5. Rombak `Animal.tsx`:
   - Suntikkan fungsi `Raycaster` global yang berjalan di `useFrame`.
   - Modifikasi sistem tabrakan (tebing dan ujung peta).
   - Filter generasi target *wander* agar patuh pada aturan amfibi/air/darat.
6. Hapus sumber daya vegetasi deterministik jika bertabrakan secara aneh dengan kontur model 3D (bisa disesuaikan koordinatnya atau bergantung murni pada pohon dari GLB jika tersedia).
