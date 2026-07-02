Anda bekerja langsung di repository Next.js yang sedang terbuka.

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan prototype Day 1 untuk proyek bernama “Biodiversity Island”. Jangan hanya menjelaskan atau memberikan contoh kode. Periksa proyek, instal dependency, buat file, jalankan validasi, dan perbaiki semua error yang ditemukan.

KONTEKS PROYEK

Proyek sudah dibuat menggunakan:

- Next.js 16 dengan App Router
- React
- TypeScript
- Tailwind CSS
- ESLint
- React Compiler
- Folder src
- npm sebagai package manager

File AGENTS.md dan CLAUDE.md tersedia di root proyek. Baca dan patuhi keduanya sebelum mengubah kode.

TUJUAN DAY 1

Buat satu halaman prototype 3D interaktif yang menampilkan pulau biodiversitas dari sudut pandang atas seperti game simulasi manajemen.

Prototype harus membuktikan bahwa:

1. Scene Three.js dapat berjalan stabil di Next.js.
2. Kamera dapat digerakkan dari sudut pandang atas.
3. Pulau placeholder terlihat jelas.
4. Satu hewan placeholder dapat bergerak.
5. Hewan dapat dipilih dengan klik.
6. Informasi hewan terpilih dapat muncul pada UI sederhana.
7. Proyek lolos lint dan production build.

LANGKAH AWAL

Sebelum menulis kode:

1. Baca package.json.
2. Baca AGENTS.md.
3. Baca CLAUDE.md.
4. Periksa isi src/app dan konfigurasi proyek.
5. Pertahankan konfigurasi Next.js, TypeScript, Tailwind, App Router, dan React Compiler yang sudah ada.
6. Gunakan npm, jangan menggantinya dengan pnpm atau yarn.

Instal dependency berikut jika belum tersedia:

npm install three @types/three @react-three/fiber @react-three/drei

Jangan menjalankan:

npm audit fix --force

Jangan memperbarui dependency utama di luar kebutuhan prototype.

BATASAN SCOPE

Jangan tambahkan:

- Model GLB atau GLTF eksternal
- Gambar eksternal
- API eksternal
- Database
- Autentikasi
- Zustand
- Yuka
- Library physics
- Post-processing
- Shader kompleks
- Sistem cuaca
- Sistem lapar dan haus
- Sistem predator dan mangsa
- Halaman selain halaman prototype
- Dashboard besar
- Landing page lengkap
- Dependency yang tidak diperlukan

Semua objek 3D harus dibuat dari geometry bawaan Three.js agar prototype tidak bergantung pada aset.

HASIL VISUAL YANG DIINGINKAN

Buat scene layar penuh dengan elemen berikut:

1. Laut

- Gunakan plane atau circle geometry besar.
- Gunakan material biru gelap.
- Jangan memakai texture eksternal.
- Buat permukaan terlihat sederhana dan bersih.
- Hindari shader air kompleks.

2. Pulau

Buat pulau placeholder dari beberapa geometry bertumpuk:

- Lapisan batu sebagai dasar.
- Lapisan pasir sebagai tepian.
- Lapisan rumput sebagai permukaan.
- Bentuk tidak perlu realistis, tetapi harus terlihat seperti pulau.
- Gunakan cylinder geometry dengan banyak segment atau bentuk sederhana lain.
- Ukuran pulau harus cukup besar untuk pergerakan hewan.

3. Vegetasi

Tambahkan sekitar 10 sampai 15 pohon placeholder.

Setiap pohon dapat terdiri dari:

- Batang cylinder.
- Daun cone atau sphere.
- Ukuran dan rotasi sedikit bervariasi.
- Posisi tetap berada di dalam batas pulau.
- Pohon tidak perlu dapat diklik.

Gunakan data posisi deterministik. Jangan menghasilkan posisi baru secara acak pada setiap render.

4. Hewan placeholder

Buat satu hewan sederhana dari beberapa primitive geometry.

Contoh bentuk:

- Badan memakai box atau capsule.
- Kepala memakai sphere atau box.
- Empat kaki sederhana.
- Ekor sederhana.
- Warna berbeda dari lingkungan.

Nama hewan sementara:

Island Grazer

Hewan harus:

- Bergerak otomatis di permukaan pulau.
- Tetap berada di dalam batas pulau.
- Mengubah arah ketika mendekati batas.
- Berputar secara halus mengikuti arah gerak.
- Bergerak menggunakan useFrame dan delta time.
- Tidak bergantung pada frame rate.
- Tidak membutuhkan physics engine.
- Tidak menembus laut.

Gunakan useRef untuk state per-frame agar gerakan tidak memicu React render setiap frame.

5. Seleksi hewan

Pengguna harus dapat mengklik hewan.

Ketika hewan dipilih:

- Tampilkan ring atau lingkaran di bawah hewan.
- Ubah sedikit warna atau emissive material.
- Tampilkan panel informasi minimal.
- Klik pada area kosong harus membatalkan seleksi jika implementasinya tetap sederhana dan stabil.
- Ubah cursor menjadi pointer saat hover pada hewan.

Gunakan event pointer dari React Three Fiber. Jangan membuat Raycaster manual jika event bawaan sudah cukup.

6. Kamera

Gunakan kamera orthographic dari sudut pandang atas miring.

Kamera awal harus memberi tampilan seperti game simulasi:

- Posisi sekitar [12, 14, 12].
- Mengarah ke pusat pulau.
- Pulau terlihat penuh saat halaman dibuka.

Gunakan MapControls atau OrbitControls dari @react-three/drei.

Kontrol harus mendukung:

- Pan.
- Zoom.
- Rotasi terbatas.
- Kamera tidak boleh berputar sampai berada di bawah tanah.
- Zoom tidak boleh terlalu dekat atau terlalu jauh.
- Aktifkan damping agar gerakan terasa halus.

Pilih MapControls jika lebih sesuai untuk navigasi game top-down.

7. Pencahayaan

Gunakan pencahayaan sederhana:

- Ambient light atau hemisphere light.
- Directional light sebagai matahari.
- Shadow aktif jika performanya tetap stabil.
- Batasi ukuran shadow map agar tidak berlebihan.
- Gunakan contact shadow hanya jika tidak menambah masalah build atau performa.

8. UI minimum

Buat overlay HTML sederhana di atas Canvas.

Bagian kiri atas:

- Judul “Biodiversity Island”
- Label “Day 1 Prototype”
- Instruksi singkat untuk drag, zoom, dan memilih hewan

Ketika hewan dipilih, tampilkan panel kecil yang berisi:

- Nama: Island Grazer
- Status: Roaming
- Habitat: Grassland
- Koordinat X dan Z yang dibulatkan
- Tombol kecil “Deselect”

UI harus:

- Mudah dibaca.
- Tidak menutupi sebagian besar scene.
- Responsif.
- Tidak menjadi dashboard lengkap.
- Menggunakan Tailwind atau CSS proyek yang sudah tersedia.
- Tidak memakai library UI tambahan.

ARSITEKTUR KODE

Gunakan struktur yang sederhana dan mudah dikembangkan.

Struktur yang disarankan:

src/
  app/
    page.tsx
    globals.css
  components/
    prototype/
      BiodiversityPrototype.tsx
      IslandScene.tsx
      PlaceholderAnimal.tsx

Anda boleh menyesuaikan struktur jika ada alasan teknis yang kuat, tetapi jangan membuat terlalu banyak file abstraksi.

Ketentuan:

- Komponen yang memakai Canvas dan browser API harus menjadi Client Component dengan “use client”.
- page.tsx harus tetap sederhana.
- Hindari hydration mismatch.
- Gunakan TypeScript secara ketat.
- Jangan gunakan any.
- Jangan menonaktifkan ESLint.
- Jangan menambahkan komentar yang menjelaskan hal jelas.
- Tambahkan komentar hanya pada logika gerakan atau keputusan teknis yang memang membutuhkan penjelasan.
- Jangan membuat general-purpose engine atau entity component system.
- Jangan melakukan premature optimization.

STATE

Gunakan React state lokal hanya untuk:

- Hewan yang sedang dipilih.
- Data yang perlu ditampilkan pada UI.

Gunakan ref untuk:

- Posisi hewan.
- Arah pergerakan.
- Update per-frame.

Jangan memasang Zustand pada Day 1.

RESPONSIVE DAN FALLBACK

Pastikan:

- Halaman memenuhi viewport.
- Tidak ada horizontal scrollbar.
- Canvas tetap terlihat pada desktop dan mobile.
- UI tidak keluar layar.
- Tampilkan fallback sederhana ketika Canvas belum siap.
- Beri pesan sederhana jika WebGL gagal dibuat, jika dapat dilakukan tanpa menambah dependency.

AKSESIBILITAS DASAR

- Tombol Deselect harus memiliki label yang jelas.
- Gunakan kontras teks yang cukup.
- Hindari teks berukuran terlalu kecil.
- Jangan membuat seluruh interaksi bergantung pada hover.

KRITERIA SELESAI

Prototype dianggap selesai jika:

- `npm run dev` dapat dijalankan.
- Halaman utama menampilkan pulau 3D.
- Kamera dapat di-pan, zoom, dan dirotasi secara terbatas.
- Satu hewan bergerak otomatis.
- Hewan tetap berada di pulau.
- Hewan dapat dipilih.
- Ring seleksi dan panel informasi muncul.
- Tidak ada error pada browser console yang berasal dari kode aplikasi.
- Tidak ada error TypeScript.
- `npm run lint` berhasil.
- `npm run build` berhasil.
- Tidak ada aset eksternal atau request jaringan untuk model dan gambar.

PROSES VALIDASI

Setelah implementasi:

1. Jalankan `npm run lint`.
2. Perbaiki semua error dan warning yang relevan.
3. Jalankan `npm run build`.
4. Perbaiki semua error build dan TypeScript.
5. Jalankan development server sebentar jika memungkinkan untuk memastikan aplikasi dapat dimulai.
6. Jangan biarkan development server terus berjalan setelah pemeriksaan selesai.
7. Periksa git diff agar tidak ada perubahan yang tidak berkaitan.

Jangan menyatakan pekerjaan selesai sebelum lint dan build berhasil.

LAPORAN AKHIR

Setelah selesai, berikan laporan singkat yang mencantumkan:

1. Dependency yang ditambahkan.
2. File yang dibuat atau diubah.
3. Fitur yang sudah bekerja.
4. Hasil `npm run lint`.
5. Hasil `npm run build`.
6. Keterbatasan prototype Day 1.
7. Satu langkah paling logis untuk Day 2.

Mulai sekarang. Periksa repository dan langsung kerjakan implementasinya.