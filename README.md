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
- Structured question bank dari materi pembelajaran Drive: BEDROOM VOCAB, Adjectives + Prepositions, Phrases, Tongue Twisters, dan English for Workplace Communication.
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

## Question Bank

Question bank dipisahkan dari logic utama:

- `data/sources.js`: metadata sumber materi.
- `data/questions.js`: 150 soal baru dari materi Bahasa Inggris.
- `index.html`: quiz engine, helper filter, admin stats, dan fallback legacy.

Komposisi soal baru:

- `BEDROOM VOCAB`: 40 soal untuk vocabulary, reading, sentence builder, speaking, dan listening.
- `Adjectives + Prepositions`: 60 soal grammar, listening grammar, error correction, dan sentence completion.
- `Phrases`: 20 soal conversation, roleplay, office phrases, dan English Day challenge.
- `Tongue Twisters`: 15 soal pronunciation, speaking, fluency, dan listening.
- `English for Workplace Communication`: 15 soal reading, listening, speaking, dan roleplay.

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
const LEGACY_QUESTION_BANK = buildQuestionBank();
const DRIVE_QUESTION_BANK = window.DRIVE_QUESTION_BANK;
const QUESTION_BANK = [...DRIVE_QUESTION_BANK, ...LEGACY_QUESTION_BANK];
```

Jika level belum punya cukup soal dari Drive, sistem otomatis mencampur soal Drive dengan fallback legacy.

## Mapping Materi ke Level

World 1 tetap mempertahankan level lama:

1. Alphabet & Pronunciation
2. Numbers
3. Days of Week
4. Months
5. Colors and Object Description
6. Family
7. Occupation
8. Countries
9. Daily Activities
10. Self Introduction

Mapping materi baru:

- `BEDROOM VOCAB`: Level 5, 8, 9, 10.
- `Adjectives + Prepositions`: Level 9, 10, 11, 12.
- `Phrases`: World 2, Level 11 sampai 20.
- `Tongue Twisters`: Level 1, 10, 20.
- `English for Workplace Communication`: Level 11 sampai 20 dan program English Day / English for Workplace Communication.

## Menambah atau Update Soal Manual dari Google Drive

1. Buka materi yang di-starred di Google Drive.
2. Salin kosakata, kalimat, grammar point, phrase, atau prompt speaking.
3. Tambahkan object soal baru ke `data/questions.js`.
4. Pastikan `id` unik, `source` sesuai metadata, dan `level` sesuai mapping.
5. Untuk pilihan ganda, isi `options`, `answer`, dan `explanation`.
6. Untuk speaking/roleplay/pronunciation, isi `expectedAnswer`, `rubric`, `exampleAnswer`, dan `explanation`.
7. Jalankan app secara lokal dan cek Admin -> Question Bank untuk memastikan statistik dan filter terbaca.

Tidak ada build step. Selama file `.js` dan `index.html` tetap static, GitHub Pages tetap compatible.

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
