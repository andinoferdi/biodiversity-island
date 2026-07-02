# Git Workflow Guide

Berlaku untuk project Next.js `biodiversity-island`. Workflow yang digunakan adalah GitHub Flow, dengan `main` sebagai source of truth utama. Remote `origin` sudah aktif; branch kerja saat ini memakai prefix nama, contoh nyata: `andino/feat/prototype`. Branch `develop`, branch protection, CI, dan deployment belum ada dan harus diverifikasi sebelum dianggap aktif.

## Aturan Paling Penting

`main` harus selalu dalam kondisi dapat di-build. Jangan push langsung ke `main` setelah remote dan branch protection tersedia. Semua perubahan dilakukan melalui branch kerja dan Pull Request. Gunakan PR ke `develop` hanya jika branch tersebut memang tersedia dan menjadi bagian workflow repository. Jika belum ada, gunakan PR langsung ke `main` setelah lint, build, dan review selesai.

## 1. Overview

Tim menggunakan GitHub Flow berbasis branch sederhana. Semua pekerjaan dilakukan di branch kerja, lalu dibuka Pull Request untuk review, validation, dan pengujian sebelum perubahan dipromosikan ke `main`.

| Branch | Fungsi | Deploy ke |
| --- | --- | --- |
| `main` | Source of truth, harus dapat di-build | Production atau preview utama |
| `develop` | Integrasi dan testing bila branch tersedia | Development / preview |
| `feature/*` | Pengembangan fitur baru | Preview atau develop via PR |
| `fix/*` | Bug fix non-critical | Preview atau develop via PR |
| `hotfix/*` | Fix critical setelah release | Production, expedited |

## 2. Naming Convention

Format:

```text
type/deskripsi-singkat-dengan-dash
```

| Type | Digunakan untuk | Contoh |
| --- | --- | --- |
| `feature` | Fitur baru | `feature/day-1-island-scene` |
| `fix` | Bug fix tidak urgent | `fix/animal-island-boundary` |
| `hotfix` | Fix critical di production | `hotfix/webgl-startup-crash` |
| `refactor` | Refactor tanpa ubah behavior | `refactor/scene-component-boundaries` |
| `chore` | Config, dependency, atau tooling | `chore/update-three-dependencies` |
| `docs` | Dokumentasi project | `docs/update-mvp-roadmap` |

Gunakan huruf kecil dan dash, bukan underscore atau spasi. Nama branch harus cukup deskriptif agar dapat dipahami tanpa konteks tambahan. Jika memakai prefix nama, gunakan format seperti `andino/feat/prototype` (format yang sedang dipakai di repository ini).

## 3. Alur Kerja Lengkap

### Step 1 - Buat branch dari branch utama yang up-to-date

Selalu mulai dari `main` terbaru. Jangan branch dari branch orang lain kecuali dependency antarpekerjaan sudah disepakati.

```bash
git checkout main
git pull origin main
git checkout -b feature/day-1-island-scene
```

Jika repository belum memiliki remote, tambahkan remote dan push `main` terlebih dahulu sebelum memakai langkah `git pull origin main`.

### Step 2 - Kerjakan fitur dan commit secara rutin

Commit kecil dan terarah lebih mudah ditinjau daripada satu commit besar. Satu commit sebaiknya mewakili satu perubahan yang dapat dijelaskan dan, bila memungkinkan, tetap dapat di-build.

```bash
git add -p
git commit -m "feat(scene): add top-down island prototype"
```

Gunakan `git add -p` untuk source code dan dokumentasi. Periksa file asset secara manual sebelum menambahkannya agar model, texture, cache, atau export yang tidak diperlukan tidak ikut masuk repository.

### Step 3 - Jalankan validation sebelum push

Gunakan script yang benar-benar tersedia di `package.json`. Baseline minimum untuk project saat ini:

```bash
npm run lint
npm run build
```

Jangan menyatakan task selesai jika lint atau production build gagal. Tambahkan test command hanya setelah test runner benar-benar dikonfigurasi.

### Step 4 - Push dan buka PR ke branch target

```bash
git push -u origin feature/day-1-island-scene
```

Pilih target sesuai kondisi repository:

- Base `develop` jika branch develop dan workflow testing sudah aktif
- Base `main` jika project masih memakai GitHub Flow sederhana tanpa develop
- Compare `feature/day-1-island-scene`

### Step 5 - Testing di environment target dan perbaikan

Jalankan pengujian sesuai area perubahan. Untuk scene 3D, periksa browser console, camera control, pointer interaction, resize, loading, missing asset, serta performa dasar.

```bash
git commit -m "fix(animal): keep placeholder inside island bounds"
git push
```

Lanjutkan perbaikan pada branch yang sama selama scope PR tetap satu concern.

### Step 6 - Setelah review dan validation clear, merge

Tunggu approval reviewer sebelum merge jika review tersedia. CI harus hijau jika pipeline sudah dikonfigurasi. Jangan override build merah tanpa alasan yang terdokumentasi.

Setelah merge, hapus branch yang tidak dibutuhkan:

```bash
git push origin --delete feature/day-1-island-scene
git branch -d feature/day-1-island-scene
```

## 4. Commit Message

Gunakan format Conventional Commits:

```text
type(domain): deskripsi singkat
```

| Type | Kapan dipakai | Contoh |
| --- | --- | --- |
| `feat` | Fitur baru | `feat(scene): add top-down map controls` |
| `fix` | Perbaikan bug | `fix(animal): prevent movement outside island` |
| `refactor` | Refactor tanpa ubah behavior | `refactor(scene): split environment components` |
| `chore` | Dependency, config, atau tooling | `chore: add react three fiber dependencies` |
| `docs` | Perubahan dokumentasi | `docs: update biodiversity MVP requirements` |
| `test` | Tambah atau perbaiki test | `test(simulation): cover hunger state transition` |
| `style` | Formatting tanpa ubah logika | `style: format prototype components` |
| `perf` | Optimasi terukur | `perf(vegetation): instance repeated tree meshes` |

Gunakan imperative mood dan jelaskan efek perubahan.

Contoh commit yang baik:

```text
feat(animal): add selectable island grazer
fix(camera): clamp top-down rotation angle
perf(asset): reduce island texture size
```

Contoh commit yang buruk:

```text
fix bug
update
wip
tes1
tes2
```

## 5. Pull Request

Template deskripsi PR bersifat opsional, tetapi sangat disarankan.

```markdown
## Apa yang berubah?

Menambahkan scene pulau Day 1 dengan kamera top-down, terrain placeholder, vegetasi primitive, satu hewan bergerak, selection ring, dan panel informasi.

## Kenapa perlu berubah?

Prototype perlu membuktikan integrasi Next.js dan React Three Fiber sebelum asset GLB, simulation system, atau UI lanjutan dibuat.

## Cara test

1. Jalankan `npm install` jika dependency belum tersedia.
2. Jalankan `npm run dev` dan buka halaman utama.
3. Uji pan, zoom, rotasi terbatas, selection, deselect, resize, dan mobile viewport.
4. Pastikan hewan tidak keluar dari pulau dan browser console tidak menampilkan error aplikasi.
5. Jalankan `npm run lint` dan `npm run build`.

## Checklist

- [ ] Scope PR sesuai PRD dan milestone aktif
- [ ] `npm run lint` berhasil
- [ ] `npm run build` berhasil
- [ ] Tidak ada console error yang berasal dari kode aplikasi
- [ ] Tidak ada missing model, texture, audio, atau request asset
- [ ] Asset baru memiliki sumber dan lisensi yang jelas
- [ ] Dokumentasi status implementasi sudah diperbarui
- [ ] Tidak ada credential, `.env`, cache, atau file export yang tidak perlu
```

Aturan review:

- Minimal 1 approval untuk perubahan besar bila reviewer tersedia.
- Satu PR = satu concern. Pisahkan fitur, refactor besar, optimasi, dan produksi asset.
- Sertakan screenshot atau rekaman singkat untuk perubahan visual yang sulit dinilai dari diff.
- Cantumkan hasil profiling sebelum dan sesudah untuk PR bertipe `perf`.
- Resolve comment atau dokumentasikan keputusan sebelum merge.

## 6. Aturan Wajib

Aturan berikut sebaiknya diterapkan melalui branch protection setelah remote repository siap.

- Push langsung ke `main` diblokir.
- Semua perubahan penting melalui PR.
- Lint dan production build wajib berhasil sebelum merge.
- Dokumentasi tidak boleh mengklaim fitur sudah selesai tanpa bukti source code.
- Model, texture, audio, dan data harus mempunyai sumber serta lisensi yang jelas.
- File `.env`, credential, cache Blender, render sementara, dan build output tidak boleh di-commit.
- Perubahan dependency harus mempunyai alasan dan tidak memakai `npm audit fix --force` tanpa review dampak breaking change.

## 7. Handling Conflict

Conflict dapat terjadi jika beberapa branch mengubah scene root, state store, data spesies, atau dokumentasi yang sama. Sync branch secara rutin dengan `main`.

```bash
git checkout main
git pull origin main

git checkout feature/day-1-island-scene
git merge main

git add -p
git commit -m "chore: merge main into feature/day-1-island-scene"
git push
```

Gunakan merge untuk branch yang sudah dibagikan. Rebase hanya digunakan bila Anda memahami rewrite history dan branch belum dipakai orang lain.

### Frekuensi sync yang disarankan

Sync branch sebelum memulai sesi kerja besar, sebelum menambah asset berukuran besar, dan sebelum membuka PR. Untuk task panjang, sync setiap 2 sampai 3 hari atau setelah perubahan besar masuk `main`.

## 8. Yang Tidak Boleh Dilakukan

- Force push ke branch bersama tanpa koordinasi.
- Commit credential, API key, `.env`, private key, atau secret lain.
- Commit folder `.next`, `node_modules`, export Blender sementara, texture sumber berukuran berlebihan, atau asset tanpa lisensi.
- Mengubah model final, gameplay loop, state architecture, dan UI besar dalam satu PR.
- Menambah physics, backend, auth, post-processing, atau dependency berat tanpa requirement dan bukti kebutuhan.
- Menandai milestone selesai hanya karena tampilan terlihat benar. Lint, build, interaksi, error console, dan dokumentasi tetap harus diperiksa.
- Membiarkan branch idle terlalu lama tanpa sync atau membuat PR terlalu besar untuk ditinjau.

Jika keputusan workflow berubah, update file ini pada PR yang sama agar coding agent berikutnya tidak memakai aturan lama.
