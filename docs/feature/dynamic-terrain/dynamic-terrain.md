# Dynamic Terrain & Geographic Biomes

Dokumentasi arsitektur untuk implementasi topografi dinamis dan bioma geografis. Fitur ini merupakan langkah lanjut dari simulasi pergerakan primitif, menempatkan entitas pada ruang 3D yang bergelombang dan organik.

## Ringkasan Fitur
Daripada menggunakan hamparan bidang matematis yang datar, pulau ini secara penuh dirender menggunakan `terrain.glb` (model 3D *low-poly* dengan detail gunung, lembah, dan aliran sungai). Permukaan yang tidak merata memaksa logika simulasi untuk bermigrasi ke sistem **Dynamic Raycasting** guna mendeteksi pijakan, kemiringan lereng, serta tipe geografis area tempat entitas berada (sungai vs daratan).

## Konsep Teknis Utama

### 1. Raycasting & Bounding Volume Hierarchy (BVH)
Raycasting naif terhadap mesh *low-poly* yang besar dengan puluhan agen hewan akan mencekik performa rendering. Solusinya, geometri mesh `terrain.glb` dibungkus dalam algoritma partisi spasial `<Bvh>` dari `@react-three/drei`.
Setiap siklus `useFrame` di `Animal.tsx`, sebuah `Raycaster` ditembakkan vertikal ke bawah menembus (X, Z) dari tiap hewan:
- **`hit.point.y`**: Berfungsi sebagai poros `Y` (ground level) presisi untuk frame tersebut.
- **`hit.face.normal`**: Vektor tegak lurus dari segitiga tanah yang diinjak. Jika sumbu Y dari normal ini di bawah ambang batas (lereng curam/tebing), sistem menyimpulkannya sebagai batas fisik (tembok) dan agen akan bermanuver putar arah.
- **Missed Hit**: Jika raycast tembus ke kehampaan, hewan telah mencapai ujung perbatasan *mesh* dan langsung dialihkan kembali.

### 2. Bioma Ketinggian (Height-based Biomes)
Sistem sektor *wedge* 120-derajat ditiadakan sepenuhnya. Bioma secara dinamis diartikan dari elevasi geometri model, menciptakan batasan habitat alami yang kohesif.
- **River (Sungai)**: Terdefinisi oleh properti ketinggian `Y <= WATER_LEVEL`.
- **Land (Darat)**: Seluruh sisa daratan (dahulu Forest & Grassland) dengan `Y > WATER_LEVEL`.

### 3. Logika Navigasi Habitat Spesies
Algoritma pencarian jalan (pathfinding / wander) kini mengacu pada identitas spesies dan hubungannya dengan air:
- **Hewan Akuatik (`fish.glb`)**: Terjebak secara eksklusif dalam elevasi River. Titik *wander* tidak akan mengarah ke ketinggian lebih dari `WATER_LEVEL`.
- **Hewan Amfibi (`duck.glb`)**: Bebas berkeliaran menembus garis batas sungai dan daratan, tidak terpengaruh oleh *clip* ketinggian air.
- **Hewan Terestrial (Lainnya)**: Keberadaannya dikunci di ekosistem Land. Mereka terhalang oleh tebing yang curam dan batas tepi air sungai secara pasif. Satu-satunya interaksi dengan River adalah saat *State* mereka beralih ke "Haus", di mana mereka mencari pinggiran air terdekat, menyentuh tepian batas air (`WATER_LEVEL`) sejenak, sebelum berbalik kembali ke darat.

## Catatan Performansi
Kunci stabilitas arsitektur ini bergantung pada **penggunaan Bounding Volume Hierarchy (BVH)** dan penggunaan *shared/recycled instance* dari class `Raycaster` maupun `Vector3` dalam *render loop* untuk mencegah beban berlebih *Garbage Collection* di browser.
