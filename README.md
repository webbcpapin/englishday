# CEC Quest

Customs English Club Adventure untuk Bea Cukai Pangkalpinang.

## Isi MVP

- Registrasi awal: nama, NIP, unit kerja resmi, dan password.
- Login pegawai: NIP dan password, dengan deteksi nama jika NIP sudah terdaftar.
- Menu mentor dari halaman login dengan password khusus.
- Profil pegawai tampil setelah login, berisi progress, pilihan avatar, dan tombol mulai petualangan.
- Dashboard: XP, level, misi harian, world progress, quick actions.
- Quest: 6 world, World 1 aktif, 10 level berbasis difficulty untuk English for Workplace.
- Quiz: vocabulary, grammar, listening Text-to-Speech, sentence builder.
- Structured question bank dari materi pembelajaran Google Drive Starred: BEDROOM VOCAB, Worksheet Grammar / Adjectives + Prepositions, Phrases, Tongue Twisters, 3 English E-Course, English Day, dan English for Workplace Communication.
- Boss Battle Level 10: self introduction memakai Web Speech API.
- Result: star, XP, badge, confetti.
- Leaderboard tanpa data dummy, badge, profil, mentor dashboard, admin panel.
- Program Monitoring: Executive Dashboard, 5 program CEC, Monthly CEC Class, participant progress, input attendance, assessment, dan monthly report.
- Auto-generate jadwal Selasa untuk English for Workplace Communication.
- Program Health Score memakai bobot kehadiran, keaktifan, tugas, speaking, keterlaksanaan pertemuan, dokumentasi, dan laporan.
- Export report: copy, print, JSON, CSV.
- Local Storage untuk progress browser.
- Template Google Apps Script di `gas_backend.gs`.
- English Day 11 Juni 2026: sesi "The Expert", video, 12 pertanyaan, auto-score keyword ringan, score history, dan level English Day.
- Mentor dashboard: total score, level, sesi terakhir, login terakhir, detail profil, jawaban peserta, dan score per pertanyaan.

## Program CEC yang Dimonitor

1. Language Mastery Initiative
2. English Day
3. Engliscape Initiative
4. LinguaLeap Challenges
5. English for Workplace Communication

## Google Sheet Backend

Backend Google Apps Script memakai spreadsheet:

`1ezBkjO0aKxs65iJuYOwrNMOXIszWWkBPQi_ZmR-mf0c`

Sheet yang dibuat otomatis:

- `Users`
- `Progress`
- `Attempts`
- `Leaderboard`
- `MentorEntries`
- `ProgramData`
- `MonthlyPlans`
- `Assessments`
- `Reports`
- `LoginHistory`
- `EnglishDaySessions`
- `Questions`
- `Submissions`
- `ScoreHistory`

Kolom data utama:

- `Users`: `nip`, `name`, `unit`, `passwordHash`, `avatar`, `xp`, `level`, `stars`, `badges`, `registeredAt`, `lastActive`, `totalScore`, `levelName`, `lastActivity`, `rawJson`
- `LoginHistory`: `id`, `userId`, `nip`, `name`, `loginAt`, `logoutAt`, `deviceInfo`, `status`, `rawJson`
- `EnglishDaySessions`: `id`, `title`, `agenda`, `topic`, `date`, `videoUrl`, `description`, `status`, `createdAt`, `rawJson`
- `Questions`: `id`, `sessionId`, `questionText`, `questionType`, `options`, `correctAnswer`, `scorePoint`, `orderNumber`, `keywords`, `rawJson`
- `Submissions`: `id`, `sessionId`, `userId`, `questionId`, `questionText`, `answerText`, `isCorrect`, `scoreAwarded`, `submittedAt`, `reviewedBy`, `mentorNote`, `rawJson`
- `ScoreHistory`: `id`, `userId`, `sessionId`, `score`, `source`, `createdAt`, `rawJson`

Setelah mengubah `gas_backend.gs`, deploy ulang Web App Apps Script agar versi backend terbaru aktif.

## Menjalankan Lokal

Aplikasi ini static HTML. Cara termudah:

1. Jalankan server static dari folder repo:
   `python -m http.server 8080`
2. Buka `http://localhost:8080`.

Tanpa server juga bisa dengan membuka `index.html`, tetapi beberapa browser lebih ketat untuk fitur Web Speech dan fetch.

## Environment / Konfigurasi

Tidak ada file `.env`. Konfigurasi utama berada di:

- `index.html`: konstanta `APPS_SCRIPT_URL`
- `gas_backend.gs`: konstanta `CONFIG.SPREADSHEET_ID`

Password baru disimpan sebagai `passwordHash`. Akun lama dengan password plain text masih bisa login dan akan dimigrasikan di browser setelah login berhasil.

Untuk mode GitHub Pages static, `localStorage` adalah source of truth utama untuk akun login di browser yang sama. Google Apps Script hanya dipakai sebagai backup/sinkronisasi tambahan, sehingga registrasi dan login lokal tetap berjalan walaupun backend lambat, error, atau terkena CORS.

Login multi perangkat didukung melalui Google Apps Script: jika NIP belum ada di `localStorage` perangkat baru, halaman login akan mencoba mengambil profil dari sheet backend lewat `getUsers`, menyimpan profil itu ke perangkat baru, lalu memverifikasi password. Syaratnya akun pernah berhasil tersinkron ke backend dan memiliki `passwordHash`. Jika backend sedang down, perangkat yang sudah pernah login tetap bisa memakai data lokal.

## Question Bank Drive-Based

Question bank dipisahkan dari logic utama:

- `data/sources.js`: metadata sumber materi.
- `data/questions.js`: 200 soal baru dari materi Bahasa Inggris.
- `index.html`: quiz engine, helper filter, admin stats, dan fallback legacy.

Komposisi soal baru:

- `BEDROOM VOCAB`: 40 soal untuk vocabulary, reading, sentence builder, speaking, dan listening.
- `Worksheet Grammar / Adjectives + Prepositions`: 80 soal grammar, listening grammar, error correction, dan sentence completion.
- `Phrases`: 30 soal conversation, roleplay, office phrases, dan English Day challenge.
- `Tongue Twisters`: 20 soal pronunciation, speaking, fluency, dan listening.
- `English for Workplace Communication`: 30 soal reading, listening, speaking, writing, grammar, dan roleplay.

Setiap soal memakai struktur standar:

```js
{
  id: "bedroom_vocab_l5_q001",
  source: "BEDROOM VOCAB",
  world: 1,
  level: 5,
  levelName: "Colors and Object Description",
  type: "vocab",
  skill: "vocabulary",
  difficulty: "easy",
  title: "Vocabulary Hunter",
  prompt: "What is the meaning of 'pillow'?",
  options: ["bantal", "lemari", "tirai", "kasur"],
  answer: "bantal",
  explanation: "Pillow means bantal. It is usually placed on the bed.",
  xp: 10
}
```

Tipe yang didukung:

- `vocab`, `grammar`, `reading`, `listening`: gunakan `options` dan `answer`.
- `sentence`: gunakan `words` dan `answer`.
- `speaking`, `roleplay`, `pronunciation`: gunakan `expectedAnswer`, `rubric`, dan `exampleAnswer`.

Helper quiz tersedia di `index.html`:

- `getQuestionsByLevel(level)`
- `getQuestionsByType(type)`
- `getQuestionsBySource(source)`
- `getQuestionSetForQuiz(level, limit)`
- `getQuestionStats()`

Quiz memakai pola:

```js
const USE_LEGACY_QUESTIONS = false;
const LEGACY_QUESTION_BANK = buildQuestionBank();
const DRIVE_QUESTION_BANK = window.DRIVE_QUESTION_BANK;
const QUESTION_BANK = USE_LEGACY_QUESTIONS
  ? [...DRIVE_QUESTION_BANK, ...LEGACY_QUESTION_BANK]
  : [...DRIVE_QUESTION_BANK];
```

Jika level belum punya cukup soal dari Drive, sistem mengambil soal dari difficulty yang berdekatan. Legacy questions tidak dipakai kecuali `USE_LEGACY_QUESTIONS` diubah menjadi `true` untuk debug/admin legacy mode.

## Mapping Materi ke Level

World 1 mempertahankan sistem leveling, tetapi nama dan isi level sudah naik kelas:

1. Workplace Warm-up
2. Vocabulary in Context
3. Reading and Description
4. Sentence Builder
5. Grammar Pattern 1
6. Grammar Pattern 2
7. Office Phrases and Conversation
8. Listening and Pronunciation
9. Roleplay and Workplace Case
10. CEC Boss Challenge

Mapping materi baru:

- `BEDROOM VOCAB`: Level 2, 3, 4, 9, 10.
- `Worksheet Grammar`: Level 5 dan 6.
- `Phrases`: Level 1, 7, 9, 10.
- `Tongue Twisters`: Level 8 dan 10.
- `English for Workplace Communication`: Level 1, 7, 9, 10 dan program English Day / English for Workplace Communication.

World 2 sampai World 6 tetap tampil sebagai locked/future expansion untuk materi 3 English E-Course dan program CEC lanjutan.

## Menambah atau Update Soal Manual dari Google Drive

1. Buka materi yang di-starred di Google Drive.
2. Salin kosakata, kalimat, grammar point, phrase, atau prompt speaking.
3. Tambahkan object soal baru ke `data/questions.js`.
4. Pastikan `id` unik, `source` sesuai metadata, dan `level` sesuai mapping.
5. Untuk pilihan ganda, isi `options`, `answer`, dan `explanation`.
6. Untuk speaking/roleplay/pronunciation, isi `expectedAnswer`, `rubric`, `exampleAnswer`, dan `explanation`.
7. Jalankan app secara lokal dan cek Admin -> Question Bank untuk memastikan statistik dan filter terbaca.
8. Pastikan `USE_LEGACY_QUESTIONS` tetap `false` jika ingin quiz default hanya memakai materi Drive.

Tidak ada build step. Selama file `.js` dan `index.html` tetap static, GitHub Pages tetap compatible.

## Test GitHub Pages

1. Jalankan lokal dengan `python -m http.server 8080`.
2. Buka `http://localhost:8080`.
3. Cek registrasi: setelah daftar, user harus langsung masuk.
4. Cek logout dan login ulang dengan NIP/password yang sama.
5. Buka Quest level 1 sampai 10 dan pastikan tidak ada soal alphabet, numbers, colors, days, months, atau family sebagai quiz default.
6. Cek Admin -> Question Bank untuk total 200 soal, breakdown by level/type/source/difficulty, dan filter.
7. Push ke GitHub Pages dan buka `https://webbcpapin.github.io/englishday/`.

## Deploy GitHub Pages

1. Push folder ini ke repository `englishday`.
2. Buka GitHub repository settings.
3. Pilih Pages.
4. Source: `main` branch, folder `/root`.
5. Akses: `https://webbcpapin.github.io/englishday/`.

## Setup Google Apps Script

1. Buat Google Sheet baru.
2. Buka Extensions -> Apps Script.
3. Tempel isi `gas_backend.gs`.
4. Deploy -> New deployment -> Web app.
5. Execute as: Me.
6. Who has access: Anyone.
7. Salin Web App URL.
8. Isi konstanta `APPS_SCRIPT_URL` di `index.html`.
