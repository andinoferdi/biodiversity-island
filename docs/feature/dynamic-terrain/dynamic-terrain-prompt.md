Anda bekerja langsung di repository Next.js yang sedang terbuka.

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan fitur "Dynamic Terrain & Geographic Biomes" untuk proyek "Biodiversity Island". Ini adalah evolusi desain dari iterasi Biome Terrain sebelumnya, yang sekarang menggunakan mesh 3D sesungguhnya (`terrain.glb`) dengan raycasting dinamis.

KONTEKS PROYEK
Fase sebelumnya menggunakan pulau silinder datar. Sekarang kita beralih ke daratan bertopografi (bukit, sungai, tebing curam). Perubahan kontur fisik menuntut pembaruan mendasar pada cara hewan menavigasi ruang, mendeteksi hambatan, dan mengidentifikasi bioma.

TUJUAN
1. Ganti pulau silinder matematis dengan model `terrain.glb` dari `public/assets/environment/terrain/`.
2. Implementasikan Dynamic Raycasting. Gunakan `@react-three/drei` `<Bvh>` membungkus terrain, lalu gunakan `Raycaster` pada `useFrame` di `Animal.tsx` untuk menentukan ketinggian (`Y`) pijakan kaki hewan dan mendeteksi tebing curam serta pinggiran peta.
3. Sederhanakan sistem bioma menjadi dua kategori berbasis ketinggian geografis:
   - **River (Sungai)**: area di mana tinggi pijakan `Y <= WATER_LEVEL`.
   - **Land (Darat)**: area di mana tinggi pijakan `Y > WATER_LEVEL` (gabungan Forest dan Grassland sebelumnya).
4. Terapkan aturan navigasi hewan yang spesifik:
   - Ikan (`fish.glb`): Hanya bisa bergerak dan menetapkan tujuan (*wander target*) di area River.
   - Bebek (`duck.glb`): Hewan amfibi, bisa bergerak melintasi River maupun Land tanpa larangan ketinggian.
   - Hewan darat lainnya: Hanya bisa bergerak di area Land, dan mendekati tepian River hanya saat State mereka sedang mencari air untuk minum.
5. Gunakan `thumbnail.jpg` sebagai fallback UI atau layar loading (Suspense) saat sistem memuat aset GLB 2.3MB agar layar tidak pernah kosong.

BATASAN
- Tebing curam (dilihat dari `normal.y` yang dihasilkan raycast) harus bertindak sebagai rintangan/batas yang membuat hewan memutar arah. Jurang atau titik tanpa pijakan (raycast miss) juga bertindak sebagai batas tepi dunia.
- Jangan menginstall physics engine eksternal seperti Rapier atau Cannon. Cukup manfaatkan Raycaster bawaan Three.js yang diakselerasi dengan Bvh.

KRITERIA SELESAI
- Hewan bergerak mengikuti kontur naik-turun daratan tanpa *clipping* atau mengambang.
- Ikan bertahan hidup di air; bebek berkeliaran bebas; hewan darat memantul dari tebing, memantul dari batas air, dan minum di tepian sungai.
- Lolos linting dan build tanpa warning/error yang tersisa.
- Tidak ada penurunan frame rate yang drastis akibat raycasting (membuktikan BVH bekerja).

Mulai sekarang. Eksekusi sesuai rencana di `dynamic-terrain-plan.md`.
