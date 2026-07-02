# Prototype Day 1 — Biodiversity Island

Dokumentasi untuk programmer berikutnya. Spesifikasi asli ada di [prototype-prompt.md](./prototype-prompt.md), rencana implementasi di [prototype-plan.md](./prototype-plan.md).

## Ringkasan

Halaman utama (`/`) menampilkan pulau 3D interaktif dari sudut pandang atas ala game simulasi manajemen: laut, pulau bertingkat, 12 pohon, dan satu hewan placeholder ("Island Grazer") yang berkeliaran otomatis dan bisa diklik untuk melihat panel informasinya.

Stack: Next.js 16 (App Router, Turbopack, React Compiler aktif), React 19, Three.js + `@react-three/fiber` v9 + `@react-three/drei` v10, Tailwind CSS v4. Semua objek 3D dibuat dari geometry bawaan Three.js — **tidak ada aset eksternal, gambar, atau request jaringan**.

## Struktur File

```
src/
  app/
    page.tsx                 → Server Component, hanya me-render BiodiversityPrototype
    layout.tsx               → metadata "Biodiversity Island"
  components/prototype/
    BiodiversityPrototype.tsx → entry client-side: dynamic import scene + overlay UI + state seleksi
    IslandScene.tsx           → Canvas, kamera, kontrol, cahaya, laut, pulau, pohon
    PlaceholderAnimal.tsx     → mesh hewan + logika gerakan + event seleksi
```

## Alur Render (penting untuk Next 16)

```
page.tsx (Server Component)
  └─ BiodiversityPrototype ("use client")
       └─ dynamic(() => import("./IslandScene"), { ssr: false })
            └─ <Canvas> → Sea / Island / Tree[] / PlaceholderAnimal / MapControls
```

**Jangan pindahkan `dynamic(..., { ssr: false })` ke `page.tsx`.** Di Next 16 opsi `ssr: false` error jika dipanggil dari Server Component — harus berada di dalam file `"use client"`. Ini alasan `BiodiversityPrototype.tsx` ada sebagai lapisan perantara.

## Keputusan Teknis

### State vs Ref
- **React state** hanya untuk hal yang memengaruhi UI: `selected: boolean` dan `coords` (koordinat di panel).
- **Ref** untuk semua data per-frame: posisi hewan, heading, timer wander (`motion` ref di `PlaceholderAnimal`). Gerakan hewan **tidak pernah** memicu render React.
- Koordinat di panel di-refresh via `setInterval` 250 ms (hanya saat terpilih), membaca `animalPositionRef` yang ditulis oleh frame loop. Jadi panel terasa "live" dengan maksimal 4 render/detik.

### Gerakan Hewan (`PlaceholderAnimal.tsx`)
- Frame-rate independent: semua perpindahan memakai `delta` dari `useFrame`.
- Wander: setiap 2–5 detik pilih target heading baru (offset acak ±90°), lalu berbelok halus ke arah target lewat shortest-arc interpolation (`atan2(sin, cos)` untuk wrap sudut).
- Batas pulau: saat jarak dari pusat > 85% `WALK_RADIUS` (5.2), target heading dipaksa mengarah ke pusat pulau → belokan alami, bukan pantulan. Ada hard clamp radius sebagai jaring pengaman.
- `Math.random()` hanya dipakai untuk arah wander di frame loop — posisi pohon dan spawn deterministik (spec melarang posisi acak per render).

### Seleksi
- Klik hewan → `onClick` R3F dengan `stopPropagation()`; klik area kosong → `onPointerMissed` di `<Canvas>` → deselect. Tombol "Deselect" di panel juga tersedia.
- Saat terpilih: ring kuning (`ringGeometry`) di dalam group hewan (ikut bergerak otomatis) + material body diberi emissive.
- Cursor pointer via `onPointerOver/Out` yang mengubah `document.body.style.cursor`.

### Kamera & Kontrol (`IslandScene.tsx`)
- Kamera orthographic di `[12, 14, 12]`, `zoom: 38`, menghadap pusat pulau.
- `MapControls` (drei): damping aktif, `minZoom 18` / `maxZoom 120`, `maxPolarAngle Math.PI / 2.4` supaya kamera tidak bisa masuk ke bawah tanah.

### Cahaya & Shadow
- `hemisphereLight` + `directionalLight` (shadow map 1024², frustum dibatasi ±12).
- Canvas memakai `shadows="percentage"` (PCFShadowMap), bukan `shadows` boolean, karena default `PCFSoftShadowMap` sudah deprecated di three ≥ 0.185 dan memunculkan warning console.

### Konstanta yang Sering Dipakai
Di `IslandScene.tsx`: `GROUND_Y = 0.9` (permukaan rumput, tempat hewan & pohon berdiri) dan `WALK_RADIUS = 5.2` (radius jelajah hewan). Ubah ukuran pulau → sesuaikan keduanya.

## Gotcha / Catatan

- **React Compiler aktif global** (`reactCompiler: true` di `next.config.ts`). Kode mutasi ref ala R3F aman sejauh ini; kalau ada komponen 3D yang berperilaku aneh setelah compile, escape hatch resmi: directive `"use no memo"` di atas komponen tersebut.
- **Tailwind v4**: tidak ada `tailwind.config.js`; konfigurasi lewat `@theme` di `src/app/globals.css`.
- Warning console `THREE.Clock: This module has been deprecated` berasal dari internal react-three-fiber, bukan kode aplikasi — abaikan sampai R3F merilis perbaikan.
- Fallback: prop `loading` pada `dynamic()` menampilkan "Loading island…", dan prop `fallback` pada `<Canvas>` menampilkan pesan jika WebGL gagal dibuat.
- Dokumentasi Next 16 versi lokal ada di `node_modules/next/dist/docs/` — baca itu, bukan pengetahuan Next 13–15 (lihat `AGENTS.md`).

## Validasi

- `npm run lint` → lulus tanpa error/warning.
- `npm run build` → lulus (compile + TypeScript bersih).
- Diverifikasi di browser: hewan bergerak & tetap di pulau, seleksi/deseleksi bekerja, 0 error console dari kode aplikasi, 0 request eksternal.

## Batasan Day 1 & Arah Day 2

Batasan: satu hewan, wander acak sederhana tanpa kebutuhan/perilaku nyata, pulau simetris, belum ada suara/partikel/cuaca.

Langkah Day 2 yang disarankan: generalisasi `PlaceholderAnimal` menjadi banyak hewan dari satu array data spesies (nama, warna, kecepatan, habitat) dengan seleksi berbasis id — fondasi sistem populasi tanpa mengubah arsitektur.
