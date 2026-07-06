Anda bekerja langsung di repository Next.js yang sedang terbuka, pada branch `andino/feat/predator-prey`.

Tugas Anda adalah MENGEKSEKUSI dan menyelesaikan fitur "Predator–Prey" untuk proyek "Biodiversity Island". Ini adalah bagian ketiga dari milestone Hari 6–9 (setelah biome terrain, animal species, dan dynamic terrain), menyisakan tiga krisis ekosistem sebagai bagian terakhir.

KONTEKS PROYEK
Commit "enhance animal AI" sudah meletakkan fondasi: field `predatorOf`/`fov`/`sightDistance` di `species.ts` (hawk sudah predator rabbit/duck/fish), status `Hunting`/`Fleeing`, registry `liveAnimals` di `simulation.ts`, sistem penglihatan `canSee`, dan kill instan jarak < 0.8 di `Animal.tsx`. Jangan bangun ulang sistem ini — tutup kekurangannya.

TUJUAN
1. Beri predator imbalan dari membunuh: hunger predator berkurang (`KILL_HUNGER_RESTORE`) dan predator berstatus `Eating` sejenak setelah kill, lewat mailbox `killRewards` di `simulation.ts` (mangsa menulis saat mati, predator mengklaim di frame berikutnya).
2. Pindahkan kill check dan reaksi kabur keluar dari cabang wander di `Animal.tsx`: mangsa yang sedang makan/minum/mencari harus tetap bisa diserang dan harus kabur ketika melihat predator. Fleeing meng-override seeking food/water.
3. Tambahkan predator darat baru: wolf (`public/assets/animal/wolf/wolf.glb`, GLB open-source beranimasi minimal klip Walk) sebagai predator `["deer", "rabbit"]`, dengan kalibrasi `modelScale`/`modelRotY`/`animations`/`selectionRadius` dari GLB aktual di browser, mengikuti pola kalibrasi di `docs/feature/animal-species/animal-species.md`.
4. Tampilkan baris "Prey" di panel informasi untuk spesies predator (nama mangsa dari `SPECIES_BY_ID`).
5. Jaga keseimbangan: predator hanya berburu saat lapar (`HUNT_HUNGER_THRESHOLD`), kenyang setelah kill. Dalam ±10 menit simulasi, populasi prey tidak punah total dan predator tidak selalu mati kelaparan.

BATASAN
- Jangan tambah health/HP, animasi kematian, partikel, pack hunting, atau predator aquatic baru. Kill tetap instan dalam `KILL_RANGE`.
- Jangan tambah loop kedua atas `liveAnimals` per hewan per frame — satu pass sense per frame sudah cukup untuk populasi maksimum 24.
- Semua angka tuning menjadi konstanta bernama di `simulation.ts`, bukan hardcode di `Animal.tsx`.
- Model wolf harus punya sumber dan lisensi yang dapat dilacak (aturan PRD untuk semua aset).

KRITERIA SELESAI
- Hawk atau wolf yang lapar mengejar mangsanya, membunuhnya, hunger-nya turun, lalu berhenti berburu sampai lapar lagi.
- Mangsa kabur saat predator terlihat, termasuk saat sedang makan atau minum.
- Status `Hunting`/`Fleeing` dan baris "Prey" terlihat di panel.
- Lolos `npm run lint` dan `npm run build` tanpa error.
- `docs/feature/predator-prey/predator-prey.md` ditulis dan `docs/project/prd.md` diupdate dengan bukti implementasi.

Mulai sekarang. Eksekusi sesuai rencana di `predator-prey-plan.md`.
