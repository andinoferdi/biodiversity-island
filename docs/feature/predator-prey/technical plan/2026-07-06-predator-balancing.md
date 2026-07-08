# Predator–Prey Balancing (Hawk Monoculture Fix) - Implementation Plan

**Goal:** Menghentikan monokultur hawk — sensus 10 menit @4× harus berakhir dengan ekosistem multi-spesies (mangsa tidak punah total), tanpa mematikan tekanan predasi sepenuhnya.

**Architecture:** Tiga mekanisme bertumpuk, dari yang paling struktural ke yang paling halus: (1) **kill gating** — predator hanya bisa membunuh saat berstatus `Hunting`, menghapus "free kill" saat predator kenyang lewat begitu saja; (2) **hunt cooldown** — setelah makan hasil buruan, predator tidak berburu lagi selama `HUNT_COOLDOWN` detik-simulasi; (3) **nerf per-spesies hawk** — `huntHungerThreshold` override + `sightDistance` turun. Semua lever berupa konstanta bernama; balancing final lewat iterasi sensus terukur.

**Tech Stack:** Next.js 16 (App Router, React Compiler), React 19, TypeScript, Three.js 0.185 + @react-three/fiber v9 + @react-three/drei v10, TF.js brain (`animalBrain.ts`), npm.

## Konteks Penting (WAJIB dibaca sebelum eksekusi)

- **Arsitektur AI baru sejak commit `3e0030b` ("Feat: change animal behviour logic").** Logika perilaku TIDAK lagi di `Animal.tsx` saja: keputusan ada di `animalDecision.ts` (`decide()`, `checkKilled()`), persepsi di `animalPerception.ts` (`buildPerception()`), brain TF.js di `animalBrain.ts`, dan A* di `pathfinding.ts`. Plan predator-prey lama (`2026-07-06-predator-prey.md`) menjelaskan arsitektur `sense()` yang SUDAH TIDAK ADA — jangan ikuti struktur kodenya, hanya konteks tuning-nya.
- **Akar masalah monokultur yang teridentifikasi dari kode saat ini:**
  1. `checkKilled()` di `animalDecision.ts:240-253` membunuh mangsa setiap kali predator APA PUN berada dalam `KILL_RANGE` (0.8) — tanpa memeriksa apakah predator sedang lapar atau berburu. Hawk yang kenyang dan sekadar terbang lewat tetap membunuh + mendapat `KILL_HUNGER_RESTORE` 65 → hawk hampir selalu well-fed → `wellFedTimer` jalan terus → reproduksi hawk tanpa henti sampai cap 24.
  2. Tidak ada jeda antar-buruan: begitu `eatPreyTimer` (4 detik) habis, predator dengan hunger > 55 langsung berburu lagi.
  3. Hawk overpowered: `sightDistance` 20 (terjauh di roster, deer cuma 12), `neverStops`, memangsa 3 spesies (rabbit/duck/fish), dan fish tidak bisa kabur (cabang Fleeing mengecualikan `aquatic` di `animalDecision.ts:144`).
- **Data baseline lama sudah kadaluarsa.** Sensus monokultur hawk di `docs/feature/remaster-wahyu/remaster-wahyu.md` diukur SEBELUM rewrite AI `3e0030b`. Task 0 wajib mengukur baseline baru; bisa jadi perilakunya bergeser.
- **Gotcha pengukuran:** tab Chrome yang hidden membekukan simulasi (rAF berhenti). Sensus harus lewat **Playwright headed browser** (menonaktifkan background throttling, `visibilityState: visible`). Hitungan per-spesies dibaca dengan menelusuri React fiber `memoizedState` mencari array yang item-nya punya `speciesId`.
- Bug kolaps populasi total SUDAH FIXED (avoidance air + delta hidden-tab, lihat `docs/feature/remaster-wahyu/remaster-wahyu.md`). Jangan diinvestigasi ulang — sensus tidak pernah menyentuh 0.

## Global Constraints

- Stack tetap. Jangan tambah dependency, physics engine, atau state library baru.
- React state hanya untuk data yang memengaruhi UI; semua data per-frame di ref (aturan repo).
- Semua angka tuning jadi konstanta bernama di `simulation.ts` atau field di `species.ts` — tidak ada hardcode di `Animal.tsx`/`animalDecision.ts`.
- Proyek belum punya automated test. Verifikasi = `rtk npm run lint` + `rtk npm run build` + sensus browser terukur (protokol di Task 0).
- Semua perintah shell diawali `rtk` (aturan global user).
- Pertahankan perilaku yang tidak terkait balancing: flocking, locomotion aquatic/amphibian/terrestrial, POV keyboard control, hawk `neverStops`, speed multiplier Fleeing 2.5× / Hunting 2.0×, A* pathfinding.
- `MAX_POPULATION = 24` tidak berubah.

## Strategi Git

- Kerjakan di branch `andino/feat/predator-prey` (aktif, HEAD `3e0030b`).
- Conventional Commits. **Satu commit final di akhir (Task 5), hanya setelah user test manual dan menyetujui.** Jangan commit per task, jangan push tanpa diminta.

---

## File Structure

**Modify:**
- `src/components/prototype/simulation.ts` — konstanta baru `HUNT_COOLDOWN`. Tanggung jawab tetap: konstanta & tipe simulasi bersama.
- `src/components/prototype/animalDecision.ts` — kill gating di `checkKilled`, gate cooldown + threshold per-spesies di `decide`. Tanggung jawab tetap: penerjemahan persepsi → keputusan gerak.
- `src/components/prototype/animalPerception.ts` — threshold per-spesies di deteksi prey (konsistensi dengan `decide`). Tanggung jawab tetap: membangun PerceptionVector.
- `src/components/prototype/Animal.tsx` — timer `huntCooldownTimer` di motion ref, set saat klaim kill, diteruskan ke `decide`. Tanggung jawab tetap: orkestrasi per-hewan.
- `src/components/prototype/species.ts` — field `huntHungerThreshold?`, nerf hawk (`sightDistance`, `huntHungerThreshold`), koreksi teks `diet` hawk. Tanggung jawab tetap: data spesies.
- `docs/project/prd.md` — update status (Task 5, setelah verifikasi).
- `docs/feature/predator-prey/predator-prey.md` — handoff doc predator-prey (buat/update di Task 5; belum pernah ditulis).

**Tidak ada file baru di `src/`.**

---

## Task 0: Verifikasi branch + baseline sensus pada AI baru

**Files:** tidak ada perubahan permanen. Hanya verifikasi & pengukuran.

**Interfaces:**
- Produces: tabel baseline populasi per-spesies per-menit (10 menit @4×) pada HEAD `3e0030b`, sebagai pembanding Task 4.

- [ ] **Step 1: Pastikan branch dan working tree**

Run: `rtk git status` dan `rtk git log --oneline -1`
Expected: `On branch andino/feat/predator-prey`, HEAD `3e0030b`. Untracked yang boleh ada hanya plan ini.

- [ ] **Step 2: Lint & build baseline**

Run: `rtk npm run lint` lalu `rtk npm run build`
Expected: keduanya lulus. Jika tidak, berhenti dan laporkan — commit `3e0030b` mungkin menyisakan masalah, dan itu harus dibereskan sebelum balancing.

- [ ] **Step 3: Jalankan sensus baseline 10 menit @4×**

Pastikan dev server jalan (`rtk npm run dev`, port 3000). Jalankan lewat Playwright headed (BUKAN tab user, BUKAN headless — WebGL & throttling):

```
Protokol sensus (sama untuk Task 4):
1. Launch Chromium headed, buka http://localhost:3000, tunggu overlay loading hilang.
2. Klik tombol "4×" via DOM: Array.from(document.querySelectorAll("button")).find(b => b.textContent === "4×").click()
3. Tiap 30 detik real-time (= 2 menit-simulasi), evaluasi hitungan per-spesies dengan
   menelusuri React fiber: cari properti __reactFiber$ di elemen root, telusuri
   memoizedState hingga menemukan array yang item-nya punya field speciesId,
   lalu reduce menjadi { speciesId: count }.
4. Total 20 sampel (10 menit real-time = 40 menit-simulasi). Catat sebagai tabel.
```

Expected: tabel trajektori. Hipotesis dari kode: hawk memonopoli cap. Jika baseline pada AI baru TERNYATA sudah stabil multi-spesies, laporkan ke user sebelum lanjut — scope plan ini mungkin menyusut jadi verifikasi + dokumentasi saja.

---

## Task 1: Kill gating — hanya predator berstatus Hunting yang membunuh

**Files:**
- Modify: `src/components/prototype/animalDecision.ts`

**Interfaces:**
- Consumes: `AnimalState.status` yang sudah dipublikasikan tiap frame ke `liveAnimals` oleh `Animal.tsx:146-151`.
- Produces: `checkKilled(selfId, x, z, species)` — signature tidak berubah, tetapi hanya mengembalikan id predator yang `status === "Hunting"`. Task 2–4 mengandalkan semantik baru ini.

Ini perubahan struktural terpenting: menghapus "free kill" yang membuat hawk kenyang abadi. Predator kenyang yang lewat di atas rabbit tidak lagi membunuhnya.

- [ ] **Step 1: Gate kill pada status Hunting**

Di `animalDecision.ts`, fungsi `checkKilled`, tambahkan satu guard di awal loop:

```ts
export function checkKilled(
  selfId: string,
  x: number, z: number,
  species: Species,
): string | null {
  for (const [id, state] of liveAnimals.entries()) {
    if (id === selfId) continue;
    // Hanya predator yang sedang berburu yang membunuh. Predator kenyang
    // yang kebetulan lewat tidak lagi mendapat kill gratis (akar monokultur:
    // kill gratis -> hunger selalu rendah -> reproduksi tanpa henti).
    if (state.status !== "Hunting") continue;
    const dist = Math.hypot(state.x - x, state.z - z);
    if (dist >= KILL_RANGE) continue;
    const other = getSpecies(state.speciesId);
    if (other.predatorOf?.includes(species.id)) return id;
  }
  return null;
}
```

- [ ] **Step 2: Verifikasi kompilasi**

Run: `rtk npm run lint`
Expected: lulus, 0 error 0 warning.

- [ ] **Step 3: Smoke test di browser**

Buka halaman (dev server), amati @4× selama ±2 menit:
1. Hawk/wolf yang TIDAK berstatus Hunting melintas dekat mangsa → mangsa tetap hidup.
2. Predator lapar (klik untuk cek hunger > threshold) mengejar → status "Hunting" → mangsa dalam jarak dekat mati → hunger predator turun drastis.

---

## Task 2: Hunt cooldown setelah makan hasil buruan

**Files:**
- Modify: `src/components/prototype/simulation.ts`
- Modify: `src/components/prototype/animalDecision.ts`
- Modify: `src/components/prototype/Animal.tsx`

**Interfaces:**
- Consumes: mailbox `killRewards` + `eatPreyTimer` yang sudah ada di `Animal.tsx:212-219`.
- Produces: `HUNT_COOLDOWN: number` (detik-simulasi) di `simulation.ts`; field `huntCooldown: number` di `DecisionInput`; field `huntCooldownTimer` di motion ref `Animal.tsx`. Task 4 menjadikan `HUNT_COOLDOWN` lever tuning utama.

- [ ] **Step 1: Konstanta di simulation.ts**

Tambahkan setelah `HEARING_RANGE` di `src/components/prototype/simulation.ts`:

```ts
// Jeda (detik-simulasi) setelah predator memakan hasil buruan sebelum ia
// boleh berburu lagi. Memberi jendela pemulihan populasi mangsa.
export const HUNT_COOLDOWN = 20;
```

- [ ] **Step 2: Timer di Animal.tsx**

Di objek `useRef({ ... })` `motion` (`Animal.tsx:114-138`), tambahkan setelah `eatPreyTimer: 0,`:

```ts
    huntCooldownTimer: 0,
```

Di blok klaim kill reward (`Animal.tsx:213-219`), tambahkan `HUNT_COOLDOWN` ke import dari `./simulation` dan set timer saat klaim:

```ts
      const claimed = killRewards.get(spawn.id);
      if (claimed) {
        killRewards.delete(spawn.id);
        m.hunger = Math.max(0, m.hunger - KILL_HUNGER_RESTORE * claimed);
        m.eatPreyTimer = EAT_PREY_DURATION;
        m.huntCooldownTimer = HUNT_COOLDOWN;
      }
      if (m.eatPreyTimer > 0) m.eatPreyTimer = Math.max(0, m.eatPreyTimer - dt);
      if (m.huntCooldownTimer > 0)
        m.huntCooldownTimer = Math.max(0, m.huntCooldownTimer - dt);
```

Lalu di pemanggilan `decide({ ... })` (`Animal.tsx:295-305`), tambahkan properti:

```ts
            huntCooldown: m.huntCooldownTimer,
```

- [ ] **Step 3: Gate di decide()**

Di `animalDecision.ts`, interface `DecisionInput`, tambahkan:

```ts
  huntCooldown: number;
```

Di loop deteksi prey (`decide()`, sekitar baris 118), tambahkan syarat cooldown:

```ts
    if (isPredator && hunger > HUNT_HUNGER_THRESHOLD && inp.huntCooldown <= 0 &&
        species.predatorOf!.includes(state.speciesId) && dist < nearestPreyDist) {
```

(Catatan: `HUNT_HUNGER_THRESHOLD` di baris ini akan diganti threshold per-spesies pada Task 3 — kerjakan berurutan.)

- [ ] **Step 4: Verifikasi kompilasi**

Run: `rtk npm run lint`
Expected: lulus.

- [ ] **Step 5: Smoke test di browser**

@4×: setelah predator membunuh dan selesai `Eating`, ia harus kembali `Roaming`/`Seeking` — BUKAN langsung `Hunting` lagi — selama ±20 detik-simulasi (≈5 detik real-time @4×) meski mangsa lain terlihat.

---

## Task 3: Nerf hawk per-spesies + koreksi data panel

**Files:**
- Modify: `src/components/prototype/species.ts`
- Modify: `src/components/prototype/animalDecision.ts`
- Modify: `src/components/prototype/animalPerception.ts`

**Interfaces:**
- Consumes: `HUNT_HUNGER_THRESHOLD` global (55) sebagai fallback.
- Produces: `Species.huntHungerThreshold?: number`; hawk dengan `huntHungerThreshold: 70` dan `sightDistance: 12`; teks `diet` hawk yang benar. `decide()` dan `buildPerception()` membaca `species.huntHungerThreshold ?? HUNT_HUNGER_THRESHOLD`.

- [ ] **Step 1: Field baru di tipe Species**

Di interface `Species` di `species.ts`, tambahkan setelah `predatorOf?`:

```ts
  // Ambang hunger untuk mulai berburu; fallback ke HUNT_HUNGER_THRESHOLD
  // global. Naikkan untuk predator yang terlalu dominan.
  huntHungerThreshold?: number;
```

- [ ] **Step 2: Nerf entry hawk**

Di entry hawk di `SPECIES` (`species.ts`), ubah tiga hal:

```ts
    diet: "Rabbits, ducks & fish",   // sebelumnya "Seeds & berries" — salah data
    // ...field lain tidak berubah...
    predatorOf: ["rabbit", "duck", "fish"],
    huntHungerThreshold: 70,  // hawk baru berburu saat benar-benar lapar
    fov: 1.8,
    sightDistance: 12, // sebelumnya 20 — setara deer, tidak lagi melihat seisi pulau
```

(`hungerRate: 2.0` hawk tidak diubah — laju lapar tinggi + threshold tinggi = jendela berburu tetap ada tapi lebih pendek.)

- [ ] **Step 3: Pakai threshold per-spesies di decide()**

Di `animalDecision.ts`, `decide()`, sebelum loop `liveAnimals`, tambahkan:

```ts
  const huntThreshold = species.huntHungerThreshold ?? HUNT_HUNGER_THRESHOLD;
```

lalu di syarat deteksi prey ganti `hunger > HUNT_HUNGER_THRESHOLD` menjadi `hunger > huntThreshold`.

- [ ] **Step 4: Pakai threshold per-spesies di buildPerception()**

Di `animalPerception.ts`, `buildPerception()`, dengan pola yang sama: tambahkan `const huntThreshold = species.huntHungerThreshold ?? HUNT_HUNGER_THRESHOLD;` sebelum loop dan ganti `hunger > HUNT_HUNGER_THRESHOLD` pada blok deteksi prey (sekitar baris 110) menjadi `hunger > huntThreshold`. Persepsi dan keputusan harus konsisten agar input brain tidak bertentangan dengan gate keputusan.

- [ ] **Step 5: Verifikasi kompilasi + panel**

Run: `rtk npm run lint`
Expected: lulus. Di browser: klik hawk → baris Diet menunjukkan "Rabbits, ducks & fish"; baris Prey (sudah ada dari fitur predator-prey) tetap "Rabbit, Duck, Fish".

---

## Task 4: Sensus balancing + iterasi tuning

**Files:**
- Modify (hanya jika iterasi menuntut): konstanta di `simulation.ts`, angka di `species.ts`.

**Interfaces:**
- Consumes: seluruh hasil Task 1–3 + protokol sensus Task 0 Step 3.
- Produces: nilai konstanta final + tabel sensus bukti untuk handoff doc.

- [ ] **Step 1: Jalankan sensus 10 menit @4× (protokol Task 0 Step 3)**

Kriteria lulus (dari PRD "ekosistem berubah tanpa skrip linear, tetap stabil"):
1. Pada sampel terakhir: minimal 4 spesies masih hidup, termasuk minimal 2 spesies mangsa (deer/rabbit/duck/fish/horse).
2. Tidak ada monokultur: tidak ada satu spesies pun yang mengisi > 60% populasi total pada sampel terakhir.
3. Predator tidak punah permanen sepanjang pengukuran (mati sesekali boleh — itu ekosistem).
4. Tidak ada osilasi ekstrem 0 ↔ cap 24 berulang.

- [ ] **Step 2: Iterasi tuning bila gagal — satu perubahan per iterasi, ulangi Step 1**

Urutan lever (dari yang paling murah):

| Gejala | Lever | Arah |
|---|---|---|
| Mangsa masih tergerus habis | `HUNT_COOLDOWN` | 20 → 35 |
| Hawk masih dominan | `huntHungerThreshold` hawk | 70 → 80 |
| Fish spesifik punah (tidak bisa kabur) | hapus `"fish"` dari `predatorOf` hawk | — |
| Predator selalu mati kelaparan | `KILL_HUNGER_RESTORE` | 65 → 80 |
| Wolf tidak pernah dapat buruan | `sightDistance` wolf | 12 → 14 |
| Populasi mangsa meledak tak terkendali | `HUNT_COOLDOWN` | turunkan kembali |

Jangan menambah aturan/mekanisme baru pada fase ini — hanya angka. Jika setelah 5 iterasi kriteria tetap gagal, berhenti dan laporkan data ke user (kemungkinan butuh mekanisme baru, mis. reproduksi mangsa lebih cepat — itu keputusan produk).

- [ ] **Step 3: Catat nilai final + tabel sensus**

Simpan tabel trajektori lulus + daftar konstanta final untuk Task 5.

---

## Task 5: Lint, build, dokumentasi, dan commit final (tunggu persetujuan user)

**Files:**
- Create/Update: `docs/feature/predator-prey/predator-prey.md`
- Modify: `docs/project/prd.md`

**PENTING:** Commit hanya setelah user menyelesaikan test manual dan menyetujui secara eksplisit.

- [ ] **Step 1: Lint dan build penuh**

Run: `rtk npm run lint` lalu `rtk npm run build`
Expected: keduanya lulus tanpa error/warning.

- [ ] **Step 2: User test manual**

Serahkan ke user: skenario kill gating (Task 1 Step 3), cooldown (Task 2 Step 5), panel hawk (Task 3 Step 5), dan hasil sensus (Task 4). Tunggu persetujuan eksplisit.

- [ ] **Step 3: Tulis handoff doc**

Buat/update `docs/feature/predator-prey/predator-prey.md` mengikuti pola `docs/feature/dynamic-terrain/dynamic-terrain.md`: ringkasan mekanik predator-prey + balancing, keputusan teknis (kill gating via `state.status`, `HUNT_COOLDOWN`, `huntHungerThreshold` per-spesies, arsitektur AI baru `animalDecision`/`animalPerception`/`animalBrain`), nilai konstanta final, tabel sensus bukti, known limitations (fish tidak bisa kabur, hewan selected kebal sense, kill instan tanpa animasi Attack), dan langkah berikutnya (tiga krisis ekosistem).

- [ ] **Step 4: Update PRD**

Di `docs/project/prd.md`: predator–mangsa `In Progress` → `Implemented` dengan evidence path + catatan balancing lulus; perbarui paragraf baseline Overview dan baris tabel Timeline Hari 6–9 (sisa: tiga krisis ekosistem). Sebutkan juga arsitektur AI baru (`3e0030b`) agar dokumen tidak menyesatkan agent berikutnya.

- [ ] **Step 5: Review perubahan sebelum commit**

Run: `rtk git status` lalu `rtk git diff`
Expected: hanya `simulation.ts`, `animalDecision.ts`, `animalPerception.ts`, `Animal.tsx`, `species.ts`, `docs/feature/predator-prey/*`, `docs/project/prd.md`. Tidak ada file liar.

- [ ] **Step 6: Commit sekali**

```bash
git add src/components/prototype/simulation.ts \
        src/components/prototype/animalDecision.ts \
        src/components/prototype/animalPerception.ts \
        src/components/prototype/Animal.tsx \
        src/components/prototype/species.ts \
        docs/feature/predator-prey/ \
        docs/project/prd.md
git commit -m "feat: balance predator-prey with hunt-gated kills, hunt cooldown, and hawk nerfs"
```

Run: `rtk git log --oneline -1`
Expected: commit teratas adalah pesan di atas. Jangan push tanpa diminta.

---

## Self-Review

1. **Cakupan masalah:** monokultur hawk punya tiga akar teridentifikasi dari kode — free kill tanpa status Hunting (Task 1), tanpa jeda antar-buruan (Task 2), hawk overpowered sight/threshold (Task 3) — masing-masing tertangani, diverifikasi terukur (Task 4), didokumentasikan (Task 5).
2. **Konsistensi nama:** `HUNT_COOLDOWN` identik antara Task 2 Step 1 (definisi), Step 2 (Animal.tsx), Step 3 (DecisionInput); `huntHungerThreshold` identik antara Task 3 Step 1 (tipe), Step 2 (data hawk), Step 3–4 (pemakaian); `huntCooldown` di `DecisionInput` vs `huntCooldownTimer` di motion ref — dua nama berbeda disengaja (input vs timer).
3. **Regresi:** wolf ikut terkena kill gating dan cooldown (dikehendaki — mekanisme berlaku untuk semua predator); deer/horse non-predator tidak tersentuh; `buildPerception` diubah konsisten dengan `decide` sehingga brain TF.js tidak menerima sinyal prey saat gate keputusan menutupnya (hanya threshold — cooldown sengaja tidak dimasukkan ke persepsi agar vektor input tetap 16 slot).
4. **Aturan repo:** timer di ref bukan state; konstanta bernama; satu pass `liveAnimals` per fungsi; lint+build sebelum milestone; commit tunggal setelah persetujuan.

## Catatan lanjutan (bukan bagian eksekusi sekarang)

- **Tiga krisis ekosistem** (bagian terakhir Hari 6–9): plan terpisah setelah balancing lulus.
- **Fish tidak bisa kabur** (`Fleeing` mengecualikan aquatic): jika lever "hapus fish dari predatorOf hawk" terpakai di Task 4, pertimbangkan mekanik menyelam/burst-speed untuk fish di fase polish.
- **Reproduksi mangsa**: jika tuning angka mentok, lever produk berikutnya adalah `REPRODUCE_AFTER` per-spesies (mangsa beranak lebih cepat dari predator) — butuh keputusan user.
