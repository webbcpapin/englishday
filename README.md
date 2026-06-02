# CEC Quest

Customs English Club Adventure untuk Bea Cukai Pangkalpinang.

## Isi MVP

- Registrasi awal: nama, NIP, unit kerja resmi, dan password.
- Login pegawai: NIP dan password, dengan deteksi nama jika NIP sudah terdaftar.
- Menu mentor dari halaman login dengan password khusus.
- Profil pegawai tampil setelah login, berisi progress, pilihan avatar, dan tombol mulai petualangan.
- Dashboard: XP, level, misi harian, world progress, quick actions.
- Quest: 6 world, World 1 aktif, 10 level, 250 soal terstruktur.
- Quiz: vocabulary, grammar, listening Text-to-Speech, sentence builder.
- Boss Battle Level 10: self introduction memakai Web Speech API.
- Result: star, XP, badge, confetti.
- Leaderboard tanpa data dummy, badge, profil, mentor dashboard, admin panel.
- Local Storage untuk progress browser.
- Template Google Apps Script di `gas_backend.gs`.

## Deploy GitHub Pages

1. Push folder ini ke repository `cec-quest`.
2. Buka GitHub repository settings.
3. Pilih Pages.
4. Source: `main` branch, folder `/root`.
5. Akses: `https://webbcpapin.github.io/cec-quest/`.

## Setup Google Apps Script

1. Buat Google Sheet baru.
2. Buka Extensions -> Apps Script.
3. Tempel isi `gas_backend.gs`.
4. Deploy -> New deployment -> Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Salin Web App URL.
8. Isi konstanta `APPS_SCRIPT_URL` di `index.html`.
