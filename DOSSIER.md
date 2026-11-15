# SALTWATCH — Dossier

Tactical FPS 5v5 original (three.js 0.187.0, file statis, tanpa network) di
dermaga malam "Salt Dock": palet biru malam / lampu sodium amber / teal Tide.

## Cara main
- **Tujuan:** tim Tide (kamu + 4 bot) selalu menyerang. Menang ronde jika semua
  musuh Rust tereliminasi atau bom meledak. Kalah jika kamu gugur, bom di-defuse,
  atau waktu 100 detik habis tanpa plant. Pertama sampai **5 ronde** menang match.
- **Bom:** kamu membawa bom. Di dalam Site A **Crane Yard** atau Site B **Cold Store**,
  tahan **E** 2,5 detik untuk plant. Fuse 45 detik; musuh akan datang defuse
  (5 detik). Ledakan = menang, defuse = kalah.
- **Ekonomi:** mulai $800. Kill +$300, plant +$300, menang ronde +$3250,
  kalah ronde +$1900. Beli di buy phase (15 detik antar ronde) dengan **B**
  atau tombol 1–5.

## Senjata & granat
| Senjata | Harga | Sifat |
|---|---|---|
| P7 Gull | gratis | semi, 12 peluru |
| B12 Breaker (shotgun) | $1200 | 8 pellet, jarak dekat |
| TR-9 Riptide (SMG) | $1500 | auto, fire rate tinggi |
| AR-61 Saltline (rifle) | $2700 | auto, serbaguna |
| HM-50 Harpoon (sniper) | $4750 | 95 dmg, semi |

Granat: Salt Frag $300 (ledakan radius, tombol 3), Strobe Flash $200
(membutakan bot yang melihat, tombol 4).

## Gunplay
Hitscan raycast ke hitbox bot: headshot x4, badan x1, kaki x0.75, plus damage
falloff jarak. Spread + recoil (bloom) bertambah tiap tembakan; penalti bergerak
sampai x4.0 (sniper), sprint x2.8, jongkok/diam x0.55, ADS (klik kanan, FOV
mengecil) x0.7. Reload **R**, mag + reserve, auto vs semi sesuai senjata.

## Gerakan — jongkok & akselerasi (diuji di game yang berjalan)
- **Jongkok (Ctrl/C):** tinggi mata TIDAK meloncat — `player.eyeHeight` mengejar
  target 1.62 → 1.08 secara halus (~0,15 detik), kamera benar-benar turun,
  crosshair merapat (spread 0.006 → 0.0033), badge HUD "JONGKOK · SPREAD −45% ·
  LANGKAH SUNYI" menyala, langkah hampir tak terdengar (radius suara 3 m vs 12 m
  saat sprint), dan bot lebih sulit membidik target jongkok (aim error +0.008).
- **Akselerasi:** kecepatan mengejar target secara eksponensial
  (ACCEL_GROUND 9/s, DECEL_GROUND 13/s, ACCEL_AIR 2.2/s) — diukur di game:
  0 → 2.89 → 4.18 → 4.75 → 5.0 m/s saat menahan W, lalu meluncur 1.51 → 0.44 →
  0.13 m/s setelah melepas W. Tidak ada berhenti instan. Sprint juga menaikkan
  FOV 74 → 78 sehingga ramp kecepatan terlihat.
- Collision AABB melawan dinding, kontainer, dan peti; lompat Spasi.

## Bot — melihat DAN mendengar (diuji di game yang berjalan)
Bot AI memakai waypoint graph: hold site, patrol, investigate, engage (cek
line-of-sight, aim error per jarak, burst fire, strafe), dan defuse saat bom
terpasang. **Mendengar:** tiap suara membawa radius (tembakan 30 m, ledakan
40 m, langkah sprint 12 m, jalan 6 m, jongkok 3 m); bot dalam radius + bonus
pendengarannya menoleh dulu ke arah suara (yaw berputar ke sumber suara sebelum
kakinya bergerak), lalu berjalan menyelidiki dengan marker **"?"** melayang di
atas kepala; saat engage marker berubah **"!"**. Diuji dengan tembakan asli
(tikus, pointer lock): LOS sengaja dihalangi tumpukan kontainer 5,2 m, bot
dalam keadaan hold menghadap menjauh — setelah tembakan, bot berbalik 180°
(yaw 3.19 → 0), state `hold` → `investigate`, marker "?" menyala, dan ia
mulai berjalan ke sumber suara. Bot teman mengikuti pemain dari jarak.

## HUD & audio
Health + bar, ammo mag/reserve, uang, timer ronde, skor ronde, pips hidup 5v5,
kill feed, crosshair dinamis, hitmarker, vignette + arah damage, timer bom,
progress ring plant (lingkaran penuh 239 = 2,5 detik), banner akhir ronde,
badge stance (JONGKOK/SPRINT), menu awal, pause Esc.
Semua suara disintesis WebAudio (tembakan per senjata, reload, langkah, kill
chime, beep plant, ledakan, stinger menang/kalah). **M** mute.

## Map
Pier (sightline panjang tengah, cover setinggi jongkok sehingga pemain jongkok
bersembunyi di balik peti), Crane Alley (barat), Store Alley (timur), Mid,
Site A Crane Yard (gantry crane oranye + kontainer teal bertumpuk), Site B Cold
Store (kontainer rust + blok gudang). Lampu sodium amber di sepanjang pier
(satu berkedip), bulan biru + bintang, fog malam. Semua tekstur prosedural
dari canvas (aspal, beton, baja kontainer bergelombang, hazard, marking site).

## Teknologi
- Modul satu tugas: `state` (state terpusat + konstanta), `rng` (mulberry32),
  `map`, `textures`, `audio`, `weapons`, `player`, `bots`, `combat`,
  `rounds`, `hud`, `viewmodel`, `shots`, `main` (bootstrap + loop).
- Simulasi fixed-step 60 Hz terpisah dari render; scratch vector dipakai ulang,
  tanpa alokasi di hot loop.
- Screenshot deterministik: `?shot=start|play|buy|end&seed=1` — pose dan bot
  ditentukan seed, lalu frame dibekukan dengan `window.__shotReady`.

## Kontrol
WASD gerak · Mouse bidik · Klik tembak · Klik kanan ADS · R reload · Shift sprint ·
Ctrl/C jongkok · Spasi lompat · E pasang bom · B beli · 1–5 beli senjata ·
3/4 granat · M mute · Esc jeda.
