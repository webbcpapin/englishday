import { LESSONS, WORLDS, QUESTIONS, VOCABULARY, SCENARIOS, SOURCES } from '../data/curriculum.mjs';
import { GRAMMAR } from '../data/grammar.mjs';
import {
  SKILLS,
  dayKey,
  escapeHtml as esc,
  normalize,
  grade,
  reviewNext,
  skillSummary,
  recommend,
  dailyStreak,
  estimatePlacement,
  programHealth,
  csv,
  safeUrl,
  validateQuestion,
  tuesdayDates,
} from './core.mjs';
import { readPractice, savePractice, legacySummary, importLegacyPractice } from './storage.mjs';
import { request, signIn, signOut, getSession } from './api.mjs';
import * as speech from './speech.mjs';
const $ = (id) => document.getElementById(id),
  p = readPractice();
let official = null,
  mentorData = null,
  adminData = null,
  sessions = [],
  quiz = null,
  flashIndex = 0,
  flashBack = false,
  recording = false,
  noticeTimer,
  imported = [],
  challenge = '',
  routeVersion = 0,
  pendingOfficial = null;
let audio = { accent: 'en-GB', rate: 0.85, volume: 1 };
const PROGRAMS = {
  language_mastery: 'Language Mastery Initiative',
  english_day: 'English Day',
  engliscape: 'Engliscape Initiative',
  lingualeap: 'LinguaLeap Challenges',
  workplace_communication: 'English for Workplace Communication',
};
const NAV = [
  ['home', '⌂', 'Beranda'],
  ['worlds', '◈', 'Learning World'],
  ['daily', '☀', 'Daily Journey'],
  ['vocabulary', '▤', 'Vocabulary'],
  ['grammar', 'Aa', 'Grammar Academy'],
  ['listening', '◉', 'Listening Lab'],
  ['speaking', '♫', 'Speaking Lab'],
  ['conversation', '↔', 'Conversation'],
  ['tutor', '✧', 'English Tutor'],
  ['review', '↺', 'Review Due'],
  ['progress', '▥', 'Progress'],
  ['englishday', '▦', 'English Day'],
  ['achievements', '☆', 'Achievements'],
  ['leaderboard', '♜', 'Leaderboard'],
];
const button = (text, action, extra = '') =>
  `<button class="button ${extra}" type="button" data-action="${action}">${text}</button>`;
const link = (text, to, extra = '') => `<a class="button ${extra}" href="#${to}">${text}</a>`;
const tag = (text) => `<span class="tag">${esc(text)}</span>`;
const heading = (title, description, extra = '') =>
  `<div class="page-heading"><div><p class="eyebrow">CEC QUEST 2.0</p><h1>${title}</h1><p class="muted">${description}</p></div>${extra}</div>`;
const empty = (text) => `<div class="empty">${text}</div>`;
function notice(text) {
  clearTimeout(noticeTimer);
  $('notice').textContent = text;
  noticeTimer = setTimeout(() => ($('notice').textContent = ''), 7000);
}
function save() {
  if (!savePractice(p))
    notice(
      'Penyimpanan perangkat penuh atau diblokir. Progres sesi ini hanya tersimpan di memori.',
    );
}
function navigate(to) {
  location.hash = to;
}
function render(html) {
  $('content').innerHTML = html;
  $('content').focus({ preventScroll: true });
}
function stats(items) {
  return `<div class="grid four spaced">${items.map(([value, label]) => `<article class="card stat-card"><b>${esc(value)}</b><span>${esc(label)}</span></article>`).join('')}</div>`;
}
function due() {
  return Object.entries(p.reviews).filter(([, v]) => v.dueAt <= Date.now());
}
function scoreEvents() {
  return p.events.filter((e) => typeof e.correct === 'boolean');
}
function skillBars(events) {
  return Object.entries(skillSummary(events))
    .map(
      ([k, v]) =>
        `<div class="skill-row"><div><span>${esc(k)}</span><span>${v.score == null ? 'Belum dinilai' : v.score + '%'} · ${v.evidence} bukti</span></div><div class="progress-track"><div class="progress-fill" style="width:${v.score || 0}%"></div></div></div>`,
    )
    .join('');
}
function radar(events) {
  const values = Object.values(skillSummary(events)),
    points = values
      .map((v, i) => {
        const a = ((i * 60 - 90) * Math.PI) / 180,
          r = (v.score || 0) * 0.83;
        return `${150 + Math.cos(a) * r},${130 + Math.sin(a) * r}`;
      })
      .join(' ');
  return `<svg class="radar" viewBox="0 0 300 260" role="img" aria-label="Radar bukti enam skill. Nilai dan jumlah bukti tersedia pada daftar skill."><polygon points="150,47 222,88 222,172 150,213 78,172 78,88" fill="none" opacity=".3"/><polygon points="${points}"/>${SKILLS.map(
    (k, i) => {
      const a = ((i * 60 - 90) * Math.PI) / 180;
      return `<text x="${150 + Math.cos(a) * 111}" y="${130 + Math.sin(a) * 111}" text-anchor="middle">${k}</text>`;
    },
  ).join('')}</svg>`;
}
function recommended() {
  return recommend(LESSONS, p.progress, p.events, p.placement?.level);
}
function lessonLink(l) {
  return `<a class="card lesson-link" href="#lesson/${l.id}"><span class="number">${p.progress[l.id]?.mastered ? '✓' : l.level}</span><div><h3>${esc(l.title)}</h3><small>${l.cefr} · ${l.minutes} menit · ${p.progress[l.id]?.stage || 'Learn'}</small></div>${tag('Preview')}</a>`;
}
function home() {
  const l = p.journey
      ? LESSONS.find((x) => x.id === p.journey.lessonId) || recommended()
      : recommended(),
    events = scoreEvents(),
    today = p.events.filter((e) => dayKey(new Date(e.at)) === dayKey());
  render(
    `${heading('Your next chapter starts here.', 'Latihan singkat untuk komunikasi sehari-hari, profesional, dan kepabeanan.', tag(dayKey()))}<article class="hero-card"><div><p class="eyebrow">CONTINUE LEARNING · ${l.cefr}</p><h2>${esc(l.title)}</h2><p class="muted">${esc(l.objective)}</p>${link(p.quizSession ? 'Lanjutkan evaluasi →' : 'Lanjutkan belajar →', p.quizSession ? 'quiz' : `lesson/${l.id}`, 'gold')} <small class="muted">± ${l.minutes} menit · progres otomatis disimpan</small></div><div class="hero-art" aria-hidden="true">${esc(p.avatar)}</div></article>${stats(
      [
        [p.xp + ' XP', 'Aktivitas latihan mandiri'],
        [dailyStreak(p.events) + ' hari', 'Daily streak'],
        [due().length, 'Review jatuh tempo'],
        [
          Object.values(p.progress).filter((v) => v.mastered).length + '/60',
          'Latihan level selesai',
        ],
      ],
    )}<div class="grid spaced"><article class="card"><div class="card-title"><h2>Today’s mission</h2>${tag(p.goal + ' menit')}</div><div class="list-item"><span class="number">${today.length ? '✓' : '1'}</span><div><b>Bangun satu kebiasaan kecil</b><p class="muted">Kosakata, grammar, latihan, dan speaking.</p></div></div><div class="list-item"><span class="number">↺</span><div><b>${due().length} materi perlu diulang</b><p class="muted">Pengulangan mengikuti hasil ingatan Anda.</p></div></div><div class="controls spaced">${link('Mulai daily journey', 'daily')}${link('Review sekarang', 'review', 'secondary')}</div></article><article class="card"><div class="card-title"><h2>Skill progress</h2>${link('Lihat bukti', 'progress', 'quiet small-button')}</div>${skillBars(p.events)}<small>Persentase dari jawaban objektif unik terbaru; speaking dan writing membutuhkan mentor.</small></article></div><div class="grid spaced"><article class="card"><h2>Temukan titik awal Anda</h2><p class="muted">Skrining vocabulary, grammar, reading, dan listening; sampel writing dan speaking untuk review mentor.</p>${link('Placement test · ± 15 menit', 'placement', 'secondary')}</article><article class="card"><h2>Upcoming English Day</h2><div id="upcoming">${empty('Belum ada sesi terhubung. Mentor dapat menerbitkan sesi melalui akun instansi.')}</div>${link('Buka kalender kegiatan', 'englishday', 'quiet')}</article></div><p class="notice-box spaced">Latihan anonim disimpan pada perangkat ini. Nilai resmi hanya berasal dari backend terautentikasi dan materi yang telah disetujui mentor.</p>`,
  );
  if (getSession()) loadUpcoming();
}
async function loadUpcoming() {
  try {
    const r = await request('sessions');
    sessions = r.rows;
    const s = sessions
      .filter((v) => v.date >= dayKey())
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if ($('upcoming'))
      $('upcoming').innerHTML = s
        ? `<h3>${esc(s.title)}</h3><p class="muted">${esc(s.date)}</p>`
        : empty('Belum ada sesi mendatang.');
  } catch (e) {
    if ($('upcoming')) $('upcoming').textContent = e.message;
  }
}
function worlds() {
  render(
    `${heading('A world of possibilities.', 'Enam dunia. Belajar, pahami, latih, bicara, ulas, lalu kuasai.')}<div class="grid three">${WORLDS.map(
      (w) => {
        const count = LESSONS.filter((l) => l.world === w.id && p.progress[l.id]?.mastered).length;
        return `<a class="card world-card" href="#world/${w.id}"><div class="world-number">WORLD ${String(w.id).padStart(2, '0')} · ${w.cefr}</div><h2>${w.name}</h2><p class="muted">${w.description}</p><div class="progress-track"><div class="progress-fill" style="width:${count * 10}%"></div></div><small>${count}/10 latihan selesai · 10 level preview</small></a>`;
      },
    ).join(
      '',
    )}</div><p class="notice-box spaced">Seluruh level memiliki aktivitas preview. Status preview berarti belum disahkan mentor untuk assessment resmi. Level lama dipertahankan sebagai arsip dengan ID aslinya.</p><div class="controls spaced">${link('Bank soal existing', 'bank', 'secondary')}${link('Placement test', 'placement', 'secondary')}</div>`,
  );
}
function world(id) {
  const w = WORLDS.find((w) => w.id === +id);
  if (!w) return notFound();
  render(
    `${heading(w.name, w.description, tag(w.cefr))}<div class="level-list">${LESSONS.filter(
      (l) => l.world === w.id,
    )
      .map(lessonLink)
      .join('')}</div>`,
  );
}
const STAGES = ['Learn', 'Understand', 'Practice', 'Speak', 'Review', 'Master'];
function lesson(id, stage) {
  const l = LESSONS.find((l) => l.id === id);
  if (!l) return notFound();
  const progress = p.progress[id] || { stage: 'Learn', learned: false };
  let step = stage || progress.stage || 'Learn';
  if (!progress.learned && step !== 'Learn') step = 'Learn';
  p.journey = { lessonId: id, stage: step };
  p.progress[id] = { ...progress, stage: step };
  save();
  let body = '';
  if (step === 'Learn')
    body = `<h2>Tujuan pembelajaran</h2><p>${esc(l.objective)}</p><h2>Pahami konsepnya</h2><p>${esc(l.concept)}</p><div class="example"><b>Pola / contoh</b><p lang="en">${esc(l.formula)}</p></div>${l.vocabulary.map((v) => `<div class="list-item"><div class="grow"><b>${esc(v.word)}</b> · ${esc(v.meaning)}<p class="muted">${esc(v.partOfSpeech)} · ${esc(v.difficulty)}</p></div><button class="button secondary" data-audio="${esc(v.example)}">Dengarkan</button></div>`).join('')}<div class="spaced"><h2>Contoh benar dan keliru</h2>${l.examples.map((e) => `<div class="example" lang="en">✓ ${esc(e.correct)}</div><div class="example wrong" lang="en">Perlu diperbaiki: ${esc(e.incorrect)}</div>`).join('')}</div><h2 class="spaced">Contoh percakapan</h2>${l.dialogue.map((d) => `<div class="dialogue"><b>${d.speaker}</b><span lang="en">${esc(d.text)}</span></div>`).join('')}<div class="controls spaced"><button class="button secondary" data-audio="${esc(l.audio)}">▶ Audio contoh</button><button class="button" data-learn="${l.id}">Saya sudah mempelajari materi →</button></div><details><summary>Sumber dan status validasi</summary><p>Contoh pembelajaran orisinal CEC; editorial preview. Sumber teknis dipakai sebagai rujukan terminologi, bukan sebagai terjemahan resmi atau penetapan hukum.</p>${l.sources
      .map((id) => SOURCES.find((s) => s.id === id))
      .filter(Boolean)
      .map(
        (s) =>
          `<p>${s.url ? `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)} · ${s.status}</p>`,
      )
      .join('')}</details>`;
  if (step === 'Understand')
    body = `<h2>Periksa pemahaman</h2><p>${esc(l.objective)}</p><div class="example">${esc(l.concept)}</div><p>Pilih kalimat yang sesuai dengan pola tersebut.</p><div id="understand-choices">${shuffle(
      l.examples.flatMap((e) => [e.correct, e.incorrect]),
    )
      .map(
        (a) =>
          `<button class="choice" data-understand="${esc(a)}" data-lesson="${l.id}">${esc(a)}</button>`,
      )
      .join('')}</div><div id="understand-feedback" aria-live="polite"></div>`;
  if (step === 'Practice') selectedTokens = [];
  if (step === 'Practice')
    body = `<h2>Build your sentence</h2><p>Susun kata berikut. Anda dapat membatalkan pilihan dan mencoba lagi.</p><div id="sentence-drop" class="example" aria-live="polite">Kalimat Anda akan muncul di sini.</div><div id="word-bank" class="word-bank">${shuffle(
      l.audio.replace(/[.!?]$/, '').split(' '),
    )
      .map((w, i) => `<button class="word" data-token="${i}">${esc(w)}</button>`)
      .join(
        '',
      )}</div><div class="controls spaced">${button('Urungkan kata terakhir', 'undo-word', 'secondary')}<button class="button" data-check-sentence="${l.id}">Cek susunan</button></div><div id="sentence-feedback" aria-live="polite"></div>`;
  if (step === 'Speak')
    body = `<h2>Put it into words.</h2><p>${esc(l.caseStudy.prompt)}</p><div class="example" lang="en">${esc(l.audio)}</div>${speakingControls()}<label for="speaking-notes">Catatan latihan atau respons teks</label><textarea id="speaking-notes" maxlength="6000" placeholder="Gunakan data fiktif. Jangan masukkan data pengguna jasa."></textarea>${rubric(l.caseStudy.rubric)}<p class="muted">Rekaman berada di memori perangkat. Dengarkan kejelasan pesan, lalu bandingkan dengan contoh. Transkripsi bukan penilaian pelafalan.</p><button class="button" data-stage="Review" data-lesson="${l.id}">Latihan mandiri selesai →</button>`;
  if (step === 'Review')
    body = `<h2>Review & assessment</h2><p>Empat soal objektif dan satu respons writing. Pembahasan muncul setelah jawaban. Speaking/writing tidak dinilai otomatis.</p><div class="controls"><button class="button" data-lesson-quiz="${l.id}">Mulai evaluasi</button><button class="button secondary" data-stage="Learn" data-lesson="${l.id}">Baca ulang materi</button></div>`;
  if (step === 'Master')
    body = `<h2>${progress.mastered ? 'Checkpoint completed.' : 'Practice, reflect, repeat.'}</h2><p>Skor objektif terbaik: ${progress.bestScore ?? 'Belum tersedia'}${progress.bestScore != null ? '%' : ''}.</p><p class="muted">Status selesai menunjukkan hasil latihan objektif. Penguasaan komunikasi terbuka tetap memerlukan bukti dan penilaian mentor.</p><div class="controls">${link('Level berikutnya', `lesson/${LESSONS[Math.min(LESSONS.indexOf(l) + 1, 59)].id}`)}<button class="button secondary" data-stage="Review" data-lesson="${l.id}">Latihan lagi</button>${link('Review kesalahan', 'review', 'secondary')}${progress.mastered ? `<button class="button quiet" data-certificate="${l.id}">Cetak catatan penyelesaian</button>` : ''}</div>`;
  render(
    `<div class="lesson-layout">${heading(l.title, l.objective, tag(`World ${l.world} · Level ${l.level} · ${l.cefr}`))}<div class="stepper" aria-label="Tahap belajar">${STAGES.map((s) => `<div class="step ${s === step ? 'active' : ''}" ${s === step ? 'aria-current="step"' : ''}>${s}</div>`).join('')}</div><article class="card stack">${body}</article><div class="controls spaced">${link('← Peta dunia', `world/${l.world}`, 'quiet')}<small>± ${l.minutes} menit · Editorial preview</small></div></div>`,
  );
}
function shuffle(a) {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function rubric(items) {
  return `<details><summary>Rubrik review mandiri / mentor</summary><ul class="rubric">${items.map((s) => `<li>${esc(s)}</li>`).join('')}</ul><p class="muted">Skala 0–4 per dimensi: 0 belum ada bukti; 1 memerlukan bantuan besar; 2 sebagian jelas; 3 jelas dengan kekurangan kecil; 4 jelas, tepat, dan konsisten. Nilai mentor harus disertai feedback.</p></details>`;
}
function audioControls() {
  return `<div class="controls"><label for="accent">Aksen model<select id="accent"><option value="en-GB" ${audio.accent === 'en-GB' ? 'selected' : ''}>British · jika tersedia</option><option value="en-US" ${audio.accent === 'en-US' ? 'selected' : ''}>American · jika tersedia</option></select></label><label for="audio-rate">Kecepatan<input id="audio-rate" type="range" min="0.5" max="1.3" step="0.05" value="${audio.rate}"></label><label for="audio-volume">Volume<input id="audio-volume" type="range" min="0" max="1" step="0.1" value="${audio.volume}"></label></div>`;
}
function speakingControls() {
  return `${audioControls()}<div class="controls spaced">${button('● Rekam · maks. 2 menit', 'record', 'secondary')}${button('■ Stop', 'stop-record', 'secondary')}${button('Transkripsi opsional', 'transcribe', 'secondary')}</div><div id="playback"></div><p id="speech-status" class="muted" role="status">Audio tidak diunggah otomatis. Transkripsi perangkat mungkin menggunakan layanan browser.</p>`;
}
function persistQuiz() {
  if (quiz)
    p.quizSession = {
      ...quiz,
      index: quiz.index + (quiz.answered ? 1 : 0),
      results: quiz.results.map((r) => ({
        ...r,
        value:
          r.result.correct === null ? '[Respons terbuka tidak disimpan setelah reload]' : r.value,
      })),
    };
  save();
}
function startQuiz(questions, { lessonId = null, mode = 'practice', title = 'Practice' } = {}) {
  quiz = {
    questions,
    index: 0,
    results: [],
    lessonId,
    mode,
    title,
    started: Date.now(),
    answered: false,
    requestIds: {},
  };
  persistQuiz();
  navigate('quiz');
  if (location.hash === '#quiz') renderQuiz();
}
function renderQuiz() {
  if (!quiz && p.quizSession) quiz = p.quizSession;
  if (!quiz) return navigate('worlds');
  const q = quiz.questions[quiz.index];
  if (!q) return finishQuiz();
  quiz.answered = false;
  quiz.questionStarted = Date.now();
  render(
    `<div class="lesson-layout">${heading(quiz.title, `${quiz.index + 1} dari ${quiz.questions.length} · Tidak ada batas waktu yang memaksa jawaban.`, tag(quiz.mode === 'placement' ? 'Placement' : 'Latihan mandiri'))}<div class="progress-track"><div class="progress-fill" style="width:${(quiz.index / quiz.questions.length) * 100}%"></div></div><article class="card spaced"><p class="eyebrow">${esc(q.skill)} · ${esc(q.cefr || 'existing')} · ${esc(q.source)}</p><h2>${esc(q.prompt)}</h2>${q.skill === 'listening' ? `${audioControls()}<button class="button secondary spaced" data-audio="${esc(q.audio || q.speak || q.answer)}">▶ Dengarkan / ulangi</button>` : ''}${
      q.options
        ? `<div>${shuffle(q.options)
            .map((a) => `<button class="choice" data-answer="${esc(a)}">${esc(a)}</button>`)
            .join('')}</div>`
        : `<form id="quiz-answer-form" class="spaced"><label for="quiz-answer">${['writing', 'speaking', 'roleplay', 'pronunciation'].includes(q.type) ? 'Respons terbuka · menunggu review mentor' : 'Jawaban Anda'}</label><textarea id="quiz-answer" maxlength="6000" required autocomplete="off" spellcheck="false"></textarea><button class="button" type="submit">Periksa / simpan jawaban</button></form>`
    }<div id="quiz-feedback" aria-live="polite"></div></article><div class="controls spaced">${button('Akhiri latihan', 'exit-quiz', 'quiet')}</div></div>`,
  );
}
function answer(value) {
  if (!quiz || quiz.answered) return;
  if (!String(value).trim()) return notice('Isi respons terlebih dahulu.');
  quiz.answered = true;
  const q = quiz.questions[quiz.index],
    result = grade(q, value),
    durationMs = Date.now() - quiz.questionStarted;
  const prior = p.events.some(
    (e) => e.questionId === q.id && e.correct === true && e.mode !== 'placement',
  );
  const event = {
    id: crypto.randomUUID(),
    questionId: q.id,
    lessonId: q.lessonId || quiz.lessonId,
    skill: q.skill,
    correct: result.correct,
    score: result.score,
    mode: quiz.mode,
    at: new Date().toISOString(),
    durationMs,
    xp: result.correct && !prior && quiz.mode !== 'placement' ? 10 : 0,
  };
  p.xp += event.xp;
  p.events.push(event);
  if (typeof result.correct === 'boolean')
    p.reviews[q.id] = reviewNext(p.reviews[q.id], result.correct);
  p.reviewItems ||= {};
  p.reviewItems[q.id] = q;
  quiz.results.push({ q, value, result, event });
  persistQuiz();
  document.querySelectorAll('[data-answer]').forEach((b) => {
    b.disabled = true;
    if (normalize(b.dataset.answer) === normalize(q.answer)) b.classList.add('correct');
    else if (b.dataset.answer === value) b.classList.add('wrong');
  });
  $('quiz-answer-form')
    ?.querySelectorAll('textarea,button')
    .forEach((e) => (e.disabled = true));
  $('quiz-feedback').innerHTML =
    `<div class="feedback"><h3>${result.correct === null ? 'Respons dicatat · belum dinilai' : result.correct ? '✓ Benar' : 'Mari perbaiki bersama'}</h3>${q.answer ? `<p lang="en">Jawaban: ${esc(q.answer)}</p>` : ''}<p>${esc(q.explanation)}</p>${result.correct === null ? rubric(q.rubric || ['Relevance', 'Clarity', 'Appropriate language', 'Task fulfilment']) : ''}<small>${event.xp ? `+${event.xp} XP latihan` : 'Tidak ada XP tambahan untuk pengulangan jawaban yang sudah benar.'}</small></div>${button(quiz.index === quiz.questions.length - 1 ? 'Lihat hasil' : 'Soal berikutnya →', 'next-question')}`;
}
function finishQuiz() {
  const done = quiz.results.filter((r) => typeof r.result.correct === 'boolean'),
    correct = done.filter((r) => r.result.correct).length,
    score = done.length ? Math.round((correct / done.length) * 100) : null,
    open = quiz.results.length - done.length;
  if (quiz.lessonId) {
    const prev = p.progress[quiz.lessonId] || {};
    p.progress[quiz.lessonId] = {
      ...prev,
      stage: 'Master',
      bestScore: Math.max(prev.bestScore || 0, score || 0),
      mastered: prev.mastered || score >= 80,
      completedAt: score >= 80 ? new Date().toISOString() : prev.completedAt,
    };
    p.journey = null;
  }
  if (quiz.mode === 'placement') {
    p.placement = estimatePlacement(quiz.results.map((r) => r.event));
    p.placement.at = new Date().toISOString();
  }
  if (quiz.mode === 'daily' && p.dailySession) p.dailySession.done = true;
  if (quiz.mode === 'daily-step' && p.dailySession) p.dailySession.step++;
  p.quizSession = null;
  save();
  const placement = quiz.mode === 'placement' ? placementResult() : '';
  render(
    `<div class="lesson-layout">${heading('Every attempt is progress.', 'Tinjau alasan jawaban dan ulangi bagian yang belum kuat.')}<article class="card"><h2>${score == null ? 'Review mentor diperlukan' : score + '% · hasil objektif'}</h2><p>${correct}/${done.length} benar · ${open} respons terbuka belum dinilai.</p>${placement}<details open><summary>Pembahasan dan review kesalahan</summary>${quiz.results.map((r) => `<div class="list-item"><div><b>${esc(r.q.prompt)}</b><p>Respons: ${esc(r.value)}</p><p>${r.result.correct === null ? 'Belum dinilai mentor' : r.result.correct ? 'Benar' : 'Perlu diulang'}</p><p class="muted">${esc(r.q.explanation)}</p></div></div>`).join('')}</details><div class="controls spaced">${quiz.lessonId ? link('Lanjutkan', `lesson/${quiz.lessonId}`) : link('Kembali ke beranda', 'home')}${link('Review due', 'review', 'secondary')}${quiz.mode.startsWith('daily') ? link('Lanjutkan daily journey', 'daily', 'secondary') : ''}${getSession() ? button('Kirim jawaban ke assessment resmi', 'official-submit', 'secondary') : ''}</div><div id="official-result" role="status"></div></article></div>`,
  );
  if (pendingOfficial)
    notice(
      'Masih ada pengiriman resmi yang belum dikonfirmasi. Gunakan tombol kirim untuk mencoba ulang.',
    );
}
function placementResult() {
  const e = p.placement,
    s = Object.entries(e.summary),
    measured = s.filter(([, v]) => v.score != null).sort((a, b) => b[1].score - a[1].score);
  return `<div class="feedback"><h3>Estimasi awal: ${e.level || 'Bukti belum cukup'}</h3><p>${esc(e.note || 'Selesaikan minimal dua soal pada setiap skill objektif.')}</p><p>Skill terkuat: ${esc(measured[0]?.[0] || 'Belum tersedia')} · prioritas: ${esc(measured.at(-1)?.[0] || 'Belum tersedia')}.</p><p>Target: 15 menit, 5 hari per minggu. Mulai dari ${e.level === 'B1' ? 'World 3' : e.level === 'A2' ? 'World 2' : 'World 1'} dan ulangi kesalahan setelah sesi.</p></div>`;
}
function placement() {
  render(
    `${heading('Start where you are.', 'Skrining singkat untuk memilih titik awal. Ini bukan sertifikasi CEFR.')}<article class="card lesson-layout"><h2>Enam skill, dua cara menilai</h2><p>Delapan soal objektif mengamati vocabulary, grammar, reading, dan listening. Respons speaking dan writing disimpan sebagai latihan; penilaian kemampuan memerlukan mentor.</p><p>Estimasi otomatis dibatasi A1–B1 karena jumlah dan cakupan soal terbatas. B2–C2 memerlukan assessment lanjutan. Pengguna berpengalaman dapat langsung memilih world yang relevan.</p>${button('Mulai skrining · ± 15 menit', 'start-placement')}${p.placement ? `<div class="spaced">${placementResult()}</div>` : ''}</article>`,
  );
}
function daily() {
  render(
    `${heading('Make room for a little English.', 'Pilih waktu yang realistis. Sesi dapat dilanjutkan dari perangkat ini.')}<div class="grid three">${[
      [5, 'Quick Learning', '3 kosakata · 1 grammar point · 3 soal · 1 speaking challenge'],
      [15, 'Standard Learning', 'Vocabulary · grammar · listening · speaking · daily quiz'],
      [
        30,
        'Intensive Learning',
        'Materi · conversation · writing · listening · speaking · evaluation',
      ],
    ]
      .map(
        ([n, title, description]) =>
          `<article class="card"><p class="eyebrow">${n} MENIT</p><h2>${title}</h2><p class="muted">${description}</p><button class="button" data-daily="${n}">${p.dailySession?.minutes === n && !p.dailySession?.done ? 'Lanjutkan sesi' : 'Mulai sesi'}</button></article>`,
      )
      .join(
        '',
      )}</div><article id="daily-host" class="card spaced">${p.dailySession ? dailyContent() : empty('Pilih durasi untuk membuka rencana belajar Anda.')}</article>`,
  );
}
function dailyContent() {
  const d = p.dailySession,
    l = LESSONS.find((v) => v.id === d.lessonId);
  if (d.done)
    return `<h2>Daily journey selesai.</h2><p>Terima kasih sudah meluangkan waktu untuk berlatih.</p>${link('Lihat perkembangan', 'progress')}`;
  const steps =
    d.minutes === 5
      ? ['3 kosakata', 'Grammar point', '3 soal', 'Speaking challenge']
      : d.minutes === 15
        ? ['Vocabulary', 'Grammar', 'Listening', 'Speaking', 'Daily quiz']
        : ['Materi lengkap', 'Conversation', 'Writing', 'Listening', 'Speaking', 'Evaluation'];
  const label = steps[d.step];
  let activity = '';
  if (label.includes('kosakata') || label === 'Vocabulary')
    activity = VOCABULARY.slice((LESSONS.indexOf(l) * 3) % 57, ((LESSONS.indexOf(l) * 3) % 57) + 3)
      .map(
        (v) =>
          `<div class="list-item"><div class="grow"><b>${v.word}</b> · ${v.meaning}<p class="muted">${v.example}</p></div><button class="button secondary" data-audio="${esc(v.example)}">Audio</button></div>`,
      )
      .join('');
  else if (label.includes('Grammar'))
    activity = `<p>${l.concept}</p><div class="example">${l.audio}</div><p>Bandingkan bentuk keliru: ${esc(l.examples[0].incorrect)}</p>`;
  else if (label === 'Materi lengkap')
    activity = `<p>${l.concept}</p><div class="example">${l.audio}</div>${l.dialogue.map((v) => `<p><b>${v.speaker}:</b> ${esc(v.text)}</p>`).join('')}`;
  else if (label === 'Listening')
    activity = `<p>Dengarkan model, ketik respons, dan periksa pembahasannya.</p><button class="button" data-daily-listening="${l.id}">Mulai listening</button>`;
  else if (label === '3 soal' || label === 'Daily quiz' || label === 'Evaluation')
    activity = `<button class="button" data-daily-quiz="${l.id}" data-interim="${d.step < steps.length - 1}">Kerjakan ${d.minutes === 5 ? '3' : '4'} soal</button>`;
  else if (label.includes('Speaking'))
    activity = `<p>${esc(l.caseStudy.prompt)}</p><div class="example">${l.audio}</div><button class="button secondary" data-audio="${esc(l.audio)}">Dengarkan model</button>${speakingControls()}<p class="muted">Bicara, putar ulang, lalu gunakan rubrik review mandiri. Tidak ada skor pronunciation otomatis.</p>`;
  else
    activity = `<p>${label === 'Conversation' ? SCENARIOS[0].prompt : esc(l.caseStudy.prompt)}</p><label for="daily-response">${label === 'Writing' ? 'Tulis 2–4 kalimat' : 'Respons percakapan Anda'}</label><textarea id="daily-response" maxlength="3000"></textarea><details><summary>Model dan rubrik</summary><p>${l.audio}</p>${rubric(l.caseStudy.rubric)}</details>`;
  const quizStep = ['Listening', '3 soal', 'Daily quiz', 'Evaluation'].includes(label);
  return `<div class="card-title"><h2>${d.minutes} minute journey</h2>${tag(`${d.step + 1}/${steps.length}`)}</div><h3>${label}</h3>${activity}${quizStep ? '' : button(d.step === steps.length - 1 ? 'Selesaikan sesi' : 'Aktivitas selesai →', 'daily-next', 'spaced')}<p class="muted spaced">Perkiraan durasi; Anda mengatur kecepatan belajar. Respons terbuka tidak disimpan setelah meninggalkan halaman.</p>`;
}
function vocabulary() {
  const v = VOCABULARY[flashIndex % VOCABULARY.length];
  render(
    `${heading('Words you can put to work.', 'Kosakata terkurasi untuk latihan. Koleksi awal ditampilkan apa adanya; target 1.000 menunggu kurasi.')}<div class="grid"><article class="card"><div class="card-title"><h2>Flashcards</h2>${tag(`${(flashIndex % VOCABULARY.length) + 1}/${VOCABULARY.length}`)}</div><div class="flashcard"><p class="eyebrow">${esc(v.category)} · ${v.difficulty}</p><h2 lang="en">${esc(v.word)}</h2>${flashBack ? `<p>${esc(v.meaning)}</p><p class="muted">${esc(v.partOfSpeech)}</p><p lang="en">${esc(v.example)}</p><small>IPA belum tersedia dari sumber tervalidasi.</small>` : '<p class="muted">Coba ingat artinya sebelum membuka kartu.</p>'}</div><div class="controls">${button('Balik kartu', 'flip-card', 'secondary')}<button class="button secondary" data-audio="${esc(v.example)}">Audio</button>${button('Kartu berikutnya →', 'next-card', 'secondary')}</div><div class="controls spaced">${button('Simpan ke notebook', 'save-word')}${button('Sulit · ulangi segera', 'word-hard', 'quiet')}${button('Ingat · jadwalkan review', 'word-easy', 'quiet')}</div></article><article class="card"><h2>Personal notebook</h2>${
      p.notebook.length
        ? p.notebook
            .map((id) => VOCABULARY.find((v) => v.id === id))
            .filter(Boolean)
            .map(
              (v) =>
                `<div class="list-item"><div><b>${esc(v.word)}</b> · ${esc(v.meaning)}<p class="muted">${esc(v.example)}</p><small>${p.reviews[v.id]?.mastered ? 'Mastered after review' : 'Dalam pengulangan'}</small></div></div>`,
            )
            .join('')
        : empty('Simpan kata yang ingin Anda gunakan dalam percakapan berikutnya.')
    }</article></div>`,
  );
}
function grammar() {
  render(
    `${heading('Grammar, one clear idea at a time.', '15 topik sistematis. Pilih konsep, bandingkan contoh, lalu latih di dalam konteks.')}<div class="grid three">${GRAMMAR.map((g) => `<article class="card"><p class="eyebrow">GRAMMAR IN ${g.minutes} MINUTES</p><h2>${g.title}</h2><p>${g.concept}</p><div class="example" lang="en">${g.example}</div><small>${g.formula}</small><div class="controls spaced"><button class="button secondary" data-audio="${esc(g.example)}">Audio</button><button class="button" data-grammar="${g.id}">Latihan</button></div></article>`).join('')}</div>`,
  );
}
function listening() {
  render(
    `${heading('Listen. Notice. Understand.', 'Model suara berasal dari perangkat. Pilihan aksen bergantung pada suara yang terpasang.')}<article class="card lesson-layout"><form id="listening-form"><label for="listening-level">World<select id="listening-level">${WORLDS.map((w) => `<option value="${w.id}">${w.id} · ${w.name}</option>`).join('')}</select></label><label for="listening-mode">Latihan<select id="listening-mode">${['Listen and choose', 'Listen and type', 'Fill in the blanks', 'Dictation', 'Conversation comprehension', 'Identify keywords', 'Office announcements', 'Customs announcements'].map((m) => `<option>${m}</option>`).join('')}</select></label>${audioControls()}<button class="button" type="submit">Mulai listening</button></form><p class="muted spaced">Transkrip dan pembahasan tampil setelah menjawab. Jika audio perangkat tidak tersedia, gunakan alternatif teks sebagai latihan membaca; hasilnya tidak dicatat sebagai listening.</p></article>`,
  );
}
function speaking() {
  render(
    `${heading('Find your voice.', 'Listen, repeat, record, and reflect. Latihan mengutamakan kejelasan komunikasi.')}<article class="card lesson-layout"><label for="speaking-mode">Jenis latihan<select id="speaking-mode">${['Listen and repeat', 'Shadowing', 'Read aloud', 'Sentence repetition', 'Tongue twisters', 'Self introduction', 'Picture description', 'Free conversation', 'Workplace roleplay'].map((m) => `<option>${m}</option>`).join('')}</select></label><div id="speaking-prompt" class="example" lang="en">${recommended().audio}</div>${button('Dengarkan model', 'speak-model', 'secondary')}${speakingControls()}<label for="speaking-notes">Transkrip / catatan refleksi</label><textarea id="speaking-notes" maxlength="6000" placeholder="Apa pesan utama Anda? Bagian mana yang ingin diulangi?"></textarea>${rubric(['Pesan sesuai tujuan', 'Kejelasan dan kelancaran menurut pendengar', 'Kosakata dan grammar sesuai konteks', 'Interaksi dan tindak lanjut'])}${button('Catat aktivitas latihan', 'log-speaking')}<p class="notice-box spaced">Tidak ada skor aksen, fonetik, intonasi, atau pronunciation otomatis. Review mentor memerlukan pendengar manusia. Rekaman tidak disimpan setelah Anda meninggalkan halaman.</p></article>`,
  );
}
function conversation(id) {
  const s = SCENARIOS.find((s) => s.id === id) || SCENARIOS[0];
  render(
    `${heading('Practice the conversation before it happens.', '12 skenario fiktif untuk layanan dan komunikasi kerja. Jangan masukkan data pengguna jasa.')}<div class="grid"><article class="card"><label for="scenario-select">Skenario<select id="scenario-select">${SCENARIOS.map((v) => `<option value="${v.id}" ${v.id === s.id ? 'selected' : ''}>${v.title}</option>`).join('')}</select></label><div class="dialogue"><b>Visitor / Counterpart</b><span lang="en">${s.prompt}</span></div><button class="button secondary spaced" data-audio="${esc(s.prompt)}">Dengarkan pertanyaan</button><form id="conversation-form" class="spaced" data-scenario="${s.id}"><label for="conversation-answer">Your response · teks atau transkripsi</label><textarea id="conversation-answer" maxlength="6000" required></textarea><button class="button" type="submit">Review respons saya</button></form>${button('Transkripsi respons', 'transcribe', 'secondary spaced')}<p id="speech-status" role="status" class="muted"></p></article><article class="card" id="conversation-feedback"><h2>Communication checklist</h2>${rubric(s.rubric)}<p class="muted">Mode offline menggunakan aturan terbatas dan perbandingan model. Tidak memberi nilai kompetensi untuk respons bebas.</p></article></div>`,
  );
}
function coach(text) {
  const rules = [
    [/\bi is\b/gi, 'I am', 'Subjek I memakai am.'],
    [/\bhe work\b/gi, 'he works', 'He memakai verb-s dalam present simple.'],
    [/\bshe work\b/gi, 'she works', 'She memakai verb-s dalam present simple.'],
    [/\bcan helps\b/gi, 'can help', 'Setelah can gunakan bentuk dasar.'],
    [/\bwill checks\b/gi, 'will check', 'Setelah will gunakan bentuk dasar.'],
    [
      /\bresponsible to preparing\b/gi,
      'responsible for preparing',
      'Responsible for + noun / -ing.',
    ],
  ];
  let revised = text,
    notes = [];
  for (const [pattern, replacement, why] of rules) {
    if (pattern.test(revised)) {
      revised = revised.replace(pattern, replacement);
      notes.push(why);
    }
  }
  return { revised, notes };
}
function tutor() {
  render(
    `${heading('A little guidance, whenever you need it.', 'Tutor berbasis materi dan aturan lokal. AI berbayar belum dikonfigurasi.')}<div class="grid"><article class="card"><form id="tutor-form"><label for="tutor-mode">Mode<select id="tutor-mode">${['Ask Anything', 'Grammar Coach', 'Vocabulary Coach', 'Speaking Partner', 'Writing Assistant', 'Conversation Partner', 'Customs English Tutor', 'Interview Practice'].map((m) => `<option>${m}</option>`).join('')}</select></label><label for="tutor-level">Level latihan<select id="tutor-level">${['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((m) => `<option>${m}</option>`).join('')}</select></label><label for="tutor-input">Pertanyaan atau kalimat Anda</label><textarea id="tutor-input" maxlength="6000" required placeholder="Contoh: I is a customs officer."></textarea><button class="button" type="submit">Bantu saya berlatih</button></form></article><article class="card" id="tutor-result"><h2>Your practice companion</h2><p>Ajukan pertanyaan tentang materi, pilih mode, atau tulis kalimat untuk pengecekan pola yang tersedia.</p><p class="muted">Jika pola belum tercakup, tutor akan menyatakan batasannya dan menawarkan materi atau rubrik, tanpa mengarang koreksi.</p></article></div>`,
  );
}
function review() {
  const items = due();
  render(
    `${heading('Remember it for longer.', 'Jadwal: hari yang sama, 1, 3, 7, 14, dan 30 hari. Salah mengingat mengembalikan interval awal.')}<div class="grid four">${[
      ['Due today', items.length],
      ['Difficult items', Object.values(p.reviews).filter((v) => v.lapses > 1).length],
      ['Mastered items', Object.values(p.reviews).filter((v) => v.mastered).length],
      ['Total scheduled', Object.keys(p.reviews).length],
    ]
      .map(
        ([label, n]) =>
          `<article class="card stat-card"><b>${n}</b><span>${label}</span></article>`,
      )
      .join('')}</div><article class="card spaced"><h2>Review mistakes & weak topics</h2>${
      items.length
        ? items
            .map(([id]) => {
              const q = QUESTIONS.find((q) => q.id === id) || p.reviewItems?.[id],
                v = VOCABULARY.find((v) => v.id === id);
              return `<div class="list-item"><div class="grow"><b>${esc(q?.skill || v?.word || 'Latihan existing')}</b><p class="muted">${esc(q?.prompt || v?.meaning || id)}</p></div>${q ? `<button class="button secondary" data-review-question="${id}">Ulangi</button>` : v ? `<button class="button secondary" data-review-word="${id}">Flashcard</button>` : link('Bank existing', 'bank', 'secondary')}</div>`;
            })
            .join('')
        : empty('Belum ada review jatuh tempo. Jadwal akan muncul setelah latihan pertama.')
    }</article>`,
  );
}
function progress() {
  const events = scoreEvents(),
    accuracy = events.length
      ? Math.round((events.filter((e) => e.correct).length / events.length) * 100)
      : null,
    seconds = p.events.reduce((s, e) => s + (e.durationMs || 0), 0) / 1000;
  const dates = [...new Set(events.map((e) => dayKey(new Date(e.at))))].slice(-14),
    daily = dates.map((date) => {
      const es = events.filter((e) => dayKey(new Date(e.at)) === date);
      return { date, accuracy: Math.round((es.filter((e) => e.correct).length / es.length) * 100) };
    });
  render(
    `${heading('See the evidence behind your progress.', 'XP mengukur aktivitas. Persentase skill mengukur hasil soal objektif unik terbaru.')} ${stats(
      [
        [accuracy == null ? '—' : accuracy + '%', 'Akurasi seluruh percobaan'],
        [Math.round(seconds / 60) + ' menit', 'Waktu menjawab terukur'],
        [events.length, 'Respons objektif'],
        [p.notebook.length, 'Kata dalam notebook'],
      ],
    )}<div class="grid spaced"><article class="card"><h2>Six skill radar</h2>${radar(p.events)}${skillBars(p.events)}</article><article class="card"><h2>Perkembangan per hari</h2>${daily.length ? `<div class="history-chart" role="img" aria-label="Akurasi harian; data rinci dalam tabel berikut.">${daily.map((d) => `<div style="height:${Math.max(d.accuracy, 2)}%" title="${d.date}: ${d.accuracy}%"></div>`).join('')}</div><table><thead><tr><th>Tanggal</th><th>Akurasi</th></tr></thead><tbody>${daily.map((d) => `<tr><td>${d.date}</td><td>${d.accuracy}%</td></tr>`).join('')}</tbody></table>` : empty('Belum ada bukti latihan.')}<p class="muted spaced">Perbandingan antarhari dapat mencakup soal berbeda; bukan bukti peningkatan CEFR. Nilai 0 berbeda dari belum dinilai.</p></article></div><article class="card spaced"><h2>Learning history</h2>${
      p.events.length
        ? `<div class="table-scroll"><table><thead><tr><th>Waktu Jakarta</th><th>Skill / kegiatan</th><th>Hasil</th><th>Durasi</th></tr></thead><tbody>${[
            ...p.events,
          ]
            .reverse()
            .slice(0, 40)
            .map(
              (e) =>
                `<tr><td>${new Date(e.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</td><td>${esc(e.skill || e.kind)}</td><td>${e.correct === true ? 'Benar' : e.correct === false ? 'Perlu diulang' : 'Belum dinilai'}</td><td>${Math.round((e.durationMs || 0) / 1000)} dtk</td></tr>`,
            )
            .join('')}</tbody></table></div>`
        : empty('Mulai satu latihan untuk melihat riwayat.')
    }</article><article class="card spaced"><h2>Recommended next step</h2>${lessonLink(recommended())}</article><div class="controls spaced">${link('Laporan & export', 'reports')}${getSession() ? button('Refresh nilai resmi', 'refresh-official', 'secondary') : ''}</div><article id="official-progress" class="card spaced"><h2>Kompetensi resmi</h2>${official ? officialProgress() : empty('Masuk melalui akun instansi untuk melihat data resmi dari backend.')}</article>`,
  );
}
function officialProgress() {
  return `<p>XP resmi: ${official.xp}. Backend merupakan sumber data otoritatif.</p>${Object.entries(
    official.skills || {},
  )
    .map(
      ([k, v]) =>
        `<p>${esc(k)}: ${v.score == null ? 'Belum dinilai' : v.score + '%'} · ${v.evidence} bukti</p>`,
    )
    .join(
      '',
    )}${official.legacy ? `<details><summary>Progres historis</summary><p>${esc(official.legacy.label)}. ${official.legacy.xp} XP historis; ${Object.keys(official.legacy.progress || {}).length} level lama.</p></details>` : ''}`;
}
function achievements() {
  const count = Object.values(p.progress).filter((v) => v.mastered).length,
    streak = dailyStreak(p.events),
    badges = [
      ['🌱', 'First step', p.events.length > 0, 'Satu aktivitas tercatat'],
      ['📚', 'Word collector', p.notebook.length >= 10, '10 kata dalam notebook'],
      ['🔥', 'One week of practice', streak >= 7, 'Streak 7 hari'],
      [
        '🧭',
        'Foundation explorer',
        LESSONS.filter((l) => l.world === 1).every((l) => p.progress[l.id]?.mastered),
        '10 checkpoint World 1',
      ],
      ['⭐', 'Learning milestone', count >= 20, '20 checkpoint selesai'],
      [
        '🏅',
        'Mastery review',
        Object.values(p.reviews).some((r) => r.mastered),
        'Satu item melewati 30 hari review',
      ],
    ];
  render(
    `${heading('Celebrate the habit you are building.', 'Badge latihan bersifat lokal. Badge kompetensi memerlukan bukti assessment resmi.')}<div class="grid three">${badges.map(([icon, name, earned, condition]) => `<article class="card badge-card"><div class="badge" aria-hidden="true">${earned ? icon : '◇'}</div><h2>${name}</h2><p class="muted">${condition}</p>${tag(earned ? 'Tercapai · latihan' : 'Belum tercapai')}</article>`).join('')}</div><article class="card spaced"><h2>Weekly & monthly challenge</h2><p>Target mingguan: berlatih pada 5 hari berbeda. Target bulanan: selesaikan 4 checkpoint dan tinjau kesalahan.</p><p class="muted">Team challenge dibuat mentor sebagai assignment dalam English Day. Personal best disimpan sebagai skor terbaik per lesson.</p>${link('Lihat checkpoint', 'worlds', 'secondary')}</article>`,
  );
}
async function leaderboard() {
  render(
    `${heading('Grow together.', 'Leaderboard resmi bersifat opt-in, memakai alias, dan hanya menampilkan XP aktivitas.')}<article class="card" id="rank-host">${getSession() ? '<div class="skeleton">Mengambil leaderboard…</div>' : empty('Masuk ke akun instansi untuk membaca leaderboard. Latihan anonim tidak dikirim ke leaderboard.')}</article>`,
  );
  if (!getSession()) return;
  try {
    const r = await request('leaderboard');
    if ($('rank-host'))
      $('rank-host').innerHTML = r.rows.length
        ? `<table><thead><tr><th>Posisi</th><th>Alias</th><th>XP</th></tr></thead><tbody>${r.rows.map((v, i) => `<tr><td>${i + 1}</td><td>${esc(v.alias)}</td><td>${v.xp}</td></tr>`).join('')}</tbody></table>`
        : empty('Belum ada peserta yang memilih tampil.');
  } catch (e) {
    if ($('rank-host')) $('rank-host').textContent = e.message;
  }
}
function bank() {
  const rows = window.DRIVE_QUESTION_BANK || [];
  render(
    `${heading('Question bank & provenance.', '200 soal existing dipertahankan sebagai latihan arsip. Metadata sumber yang belum terverifikasi tidak dianggap tervalidasi.')}<article class="card"><h2>Existing question bank</h2><p>${rows.length} soal arsip. Pilihan jawaban dideduplikasi saat pemuatan; duplikasi konsep dicatat dalam audit.</p><label for="bank-source">Sumber<select id="bank-source"><option value="">Semua sumber</option>${[...new Set(rows.map((q) => q.source))].map((s) => `<option>${esc(s)}</option>`).join('')}</select></label>${button('Latih 5 soal arsip', 'legacy-practice', 'secondary spaced')}<p class="muted">Soal terbuka dalam arsip tidak diberi poin berdasarkan panjang respons. Label CEFR lama tetap memerlukan peninjauan.</p></article><article class="card spaced"><h2>Import / export draft</h2><p>JSON harus memiliki metadata lengkap. Import lokal hanya untuk pemeriksaan; publikasi resmi memerlukan administrator dan review mentor.</p><label for="question-import">Pilih JSON soal<input id="question-import" type="file" accept="application/json,.json"></label><div id="import-preview"></div><div class="controls spaced">${button('Export soal baru · JSON', 'export-questions')}${button('Export soal baru · CSV', 'export-questions-csv', 'secondary')}${getSession()?.user.role === 'administrator' ? button('Kirim draft import ke backend', 'import-questions', 'secondary') : ''}</div></article><article class="card spaced"><h2>Content sources</h2>${SOURCES.map((s) => `<div class="list-item"><div><b>${s.url ? `<a href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.name)}</a>` : esc(s.name)}</b><p class="muted">${s.status}${s.accessedAt ? ' · ' + s.accessedAt : ''}</p></div></div>`).join('')}</article>`,
  );
}
function legacyQuestions() {
  return (window.DRIVE_QUESTION_BANK || []).map((q) => ({
    ...q,
    lessonId: `legacy-1-${q.level}`,
    cefr: 'A2',
    skill:
      {
        sentence: 'writing',
        conversation: 'reading',
        roleplay: 'speaking',
        pronunciation: 'speaking',
        fluency: 'speaking',
      }[q.skill] || q.skill,
    type: q.type === 'sentence' ? 'sentence' : q.type,
    options: q.options ? [...new Set(q.options)] : undefined,
    source: q.source + ' · provenance pending',
    contentVersion: '1-archive',
    reviewStatus: 'pending',
    explanation: q.explanation || 'Perlu review mentor.',
  }));
}
async function englishday() {
  render(
    `${heading('English Day, every week a new conversation.', 'Kalender, tema, materi, tugas, dan feedback ditentukan mentor. Lima program CEC tetap dipertahankan.')}<div class="controls"><label for="session-month">Periode<input id="session-month" type="month" value="${dayKey().slice(0, 7)}"></label>${getSession() ? button('Muat kegiatan', 'load-sessions', 'secondary') : link('Masuk akun instansi', 'account')}</div><article id="sessions-host" class="card spaced">${getSession() ? '<div class="skeleton">Memuat kegiatan…</div>' : empty('Belum terhubung ke backend. Tidak ada jadwal atau peserta contoh.')}</article><div class="grid three spaced">${Object.values(
      PROGRAMS,
    )
      .map(
        (name) =>
          `<article class="card"><h2>${name}</h2><p class="muted">Kegiatan dan dokumentasi tampil setelah diterbitkan mentor.</p></article>`,
      )
      .join('')}</div>`,
  );
  if (getSession()) await loadSessions();
}
async function loadSessions() {
  const r = await request('sessions');
  sessions = r.rows;
  renderSessions();
}
function renderSessions() {
  if (!$('sessions-host')) return;
  const period = $('session-month').value;
  const filtered = sessions
    .filter((s) => s.date.startsWith(period))
    .sort((a, b) => a.date.localeCompare(b.date));
  $('sessions-host').innerHTML = filtered.length
    ? filtered
        .map(
          (s) =>
            `<article class="stack"><div class="card-title"><h2>${esc(s.title)}</h2>${tag(s.date + ' · ' + s.status)}</div><p>${esc(s.description)}</p><p class="muted">${esc(PROGRAMS[s.program] || s.program)}</p>${safeUrl(s.videoUrl) ? `<a class="button secondary" href="${safeUrl(s.videoUrl)}" target="_blank" rel="noopener noreferrer">Buka materi / video</a>` : ''}<div class="example">Assignment: ${esc(s.prompt)}</div>${s.status === 'published' ? `<form class="session-answer-form" data-session="${s.id}"><label for="session-answer-${s.id}">Respons tugas · skenario fiktif</label><textarea id="session-answer-${s.id}" maxlength="6000" required></textarea><button class="button" type="submit">Kirim untuk review mentor</button></form>` : '<p class="muted">Sesi selesai.</p>'}</article>`,
        )
        .join('<hr>')
    : empty('Tidak ada kegiatan pada periode ini.');
}
function reportData() {
  const period = $('report-month')?.value || dayKey().slice(0, 7),
    source = $('report-source')?.value || 'practice',
    type = $('report-type')?.value || 'Individual Learning Report';
  const events = (source === 'official' ? official?.events || [] : p.events).filter((e) =>
    (e.at || '').startsWith(period),
  );
  const data = {
    schemaVersion: 2,
    type,
    period,
    timeZone: 'Asia/Jakarta',
    source: source === 'official' ? 'Authenticated backend' : 'Anonymous device practice',
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    xp: events.reduce((s, e) => s + (e.xp || 0), 0),
    skills: skillSummary(events),
    events,
    methodology:
      'Latest response per unique objective question, at most 30 per skill. Missing evidence = null. XP is activity, not proficiency. Speaking/writing require mentor rubric.',
  };
  if (source === 'mentor') {
    if (!mentorData) throw Error('Muat dashboard mentor terlebih dahulu.');
    const filter = (a) => a.filter((s) => (s.date || s.createdAt || '').startsWith(period)),
      ss = filter(mentorData.sessions),
      attendance = filter(mentorData.attendance || []),
      assessments = filter(mentorData.assessments || []),
      assignments = filter(mentorData.assignments || []),
      reports = filter(mentorData.reports || []);
    data.source = 'Authorised mentor cohort';
    data.sessions = ss;
    data.attendance = attendance;
    data.assessments = assessments;
    data.assignments = assignments;
    data.reports = reports;
    data.health = programHealth({
      sessions: ss,
      attendance,
      assessments,
      assignments,
      reports,
      planned: ss.length,
    });
    data.methodology =
      'Program Health Score V2: attendance 25%, activity 15%, assignments 15%, speaking 15%, completed/planned meetings 15%, documentation 10%, approved reports 5%. No evidence is reported explicitly. Planned dates alone never count as completion.';
  }
  return data;
}
function reports() {
  render(
    `${heading('Reports you can trace back to evidence.', 'Pilih periode dan sumber. Laporan kosong tetap kosong sampai ada data aktual.')}<article class="card no-print"><div class="grid three"><label for="report-type">Jenis laporan<select id="report-type">${['Individual Learning Report', 'Monthly CEC Report', 'English Day Report', 'Attendance Report', 'Competency Development Report', 'Program Performance Report', 'Mentor Assessment Report'].map((v) => `<option>${v}</option>`).join('')}</select></label><label for="report-month">Periode<input id="report-month" type="month" value="${dayKey().slice(0, 7)}"></label><label for="report-source">Sumber<select id="report-source"><option value="practice">Latihan perangkat</option>${official ? '<option value="official">Nilai resmi pribadi</option>' : ''}${mentorData ? '<option value="mentor">Data cohort mentor</option>' : ''}</select></label></div><div class="controls spaced">${button('Tampilkan laporan', 'render-report')}${button('CSV · Excel compatible', 'report-csv', 'secondary')}${button('JSON · audit data', 'report-json', 'secondary')}${button('Print / simpan PDF', 'report-print', 'secondary')}${button('Copy summary', 'report-copy', 'secondary')}</div></article><article id="report-output" class="card spaced"></article>`,
  );
  renderReport();
}
function reportText(d) {
  return [
    d.type,
    'CEC Quest · Bea Cukai Pangkalpinang',
    `Period: ${d.period} · ${d.timeZone}`,
    `Source: ${d.source}`,
    `Generated: ${d.generatedAt}`,
    `Events: ${d.eventCount}`,
    `Activity XP: ${d.xp}`,
    ...Object.entries(d.skills).map(
      ([k, v]) =>
        `${k}: ${v.score == null ? 'No evidence' : v.score + '%'} (${v.evidence} samples)`,
    ),
    d.health
      ? `Program Health Score: ${d.health.hasEvidence ? d.health.score : 'No evidence'}`
      : '',
    `Methodology: ${d.methodology}`,
  ].join('\n');
}
function renderReport() {
  const d = reportData();
  $('report-output').innerHTML =
    `<h2>${esc(d.type)}</h2><p>${esc(d.period)} · ${esc(d.source)}</p><pre style="white-space:pre-wrap;font:inherit">${esc(reportText(d))}</pre>${
      d.health
        ? `<details open><summary>Komponen Program Health Score</summary>${Object.entries(
            d.health.components,
          )
            .map(([k, v]) => `<p>${k}: ${Math.round(v)} · bobot ${d.health.weights[k] * 100}%</p>`)
            .join('')}</details>`
        : ''
    }<h3>Referensi data</h3><p class="muted">ID dan timestamp bukti disertakan pada export JSON. Jumlah data periode: ${d.events.length} events${d.sessions ? ', ' + d.sessions.length + ' sessions' : ''}. Tidak ada konversi XP menjadi competency.</p>${d.eventCount === 0 && !d.health ? empty('Belum ada data pada sumber dan periode ini.') : ''}`;
}
function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function account() {
  const session = getSession(),
    legacy = legacySummary();
  render(
    `${heading('Your learning, your choices.', 'Akun instansi menggunakan identitas yang diverifikasi backend. Latihan anonim tersedia tanpa akun.')}<div class="grid"><article class="card"><h2>${session ? esc(session.user.name) : 'Akun instansi'}</h2>${session ? `<p>${esc(session.user.email)}</p><p>${esc(session.user.role)} · ${esc(session.user.unit)}</p><p class="muted">Sesi berakhir ${new Date(session.expiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}. Token hanya berada di memori, tidak di Local Storage.</p><form id="preferences-form"><label for="leaderboard-alias">Alias leaderboard<input id="leaderboard-alias" maxlength="40" value="${esc(session.user.alias)}"></label><label class="inline-label"><input id="leaderboard-visible" type="checkbox" ${session.user.showLeaderboard ? 'checked' : ''}> Tampilkan posisi saya pada leaderboard</label><button class="button" type="submit">Simpan preferensi resmi</button></form>${button('Logout', 'logout', 'secondary spaced')}` : `<p>Konfigurasi Google Workspace memerlukan persetujuan instansi, OAuth client ID, domain, dan backend V2. Login NIP lokal dan password mentor bersama telah dihentikan pada preview ini.</p><div id="google-signin"></div><p id="auth-status" role="status" class="notice-box">${window.CEC_CONFIG?.institutionalAuthApproved ? 'Menyiapkan login instansi…' : 'Login instansi belum diaktifkan. Anda dapat memakai seluruh latihan preview.'}</p>${button('Siapkan login Google', 'prepare-login', 'secondary')}<p class="muted spaced">Registrasi, perubahan identitas, dan pemulihan akun ditangani administrator melalui akun Workspace terverifikasi. Tidak ada reset password dengan NIP/nama/unit.</p>`}</article><article class="card"><h2>Practice preferences</h2><label for="daily-goal">Target harian<select id="daily-goal">${[5, 15, 30].map((n) => `<option value="${n}" ${p.goal === n ? 'selected' : ''}>${n} menit</option>`).join('')}</select></label><h3 class="spaced">Avatar</h3><div class="controls">${['🧭', '🌱', '🦉', '🚀', '🎯', '🌏'].map((a) => `<button class="button secondary avatar-choice" data-avatar="${a}" aria-label="Pilih avatar ${a}" aria-pressed="${p.avatar === a}">${a}</button>`).join('')}</div><h3 class="spaced">Data lama tetap tersimpan</h3><p>${legacy.accounts} akun historis terdeteksi pada perangkat, ${legacy.completed} entri progres. Identitas, password, dan role historis tidak dimuat sebagai akun V2.</p>${legacy.accounts ? button('Export progres akun arsip pertama · tanpa identitas', 'export-legacy', 'secondary') : ''}<p class="muted">Untuk lebih dari satu akun historis, administrator dapat menautkan progres backend secara terverifikasi. Data sumber tidak dihapus.</p></article></div>`,
  );
}
async function prepareLogin() {
  const c = window.CEC_CONFIG;
  if (!c?.institutionalAuthApproved || !c.googleClientId || !c.apiUrl)
    return notice('Login instansi belum dikonfigurasi. Lihat panduan deployment untuk staging.');
  const r = await request('challenge');
  challenge = r.challenge;
  if (!window.google?.accounts?.id) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = resolve;
      s.onerror = () => reject(Error('Google sign-in tidak dapat dimuat.'));
      document.head.appendChild(s);
    });
  }
  if (!$('google-signin')) return;
  google.accounts.id.initialize({
    client_id: c.googleClientId,
    nonce: challenge,
    auto_select: false,
    callback: async (response) => {
      try {
        const result = await signIn(response.credential, challenge);
        official = result.state;
        notice('Login instansi berhasil.');
        renderNav();
        navigate('home');
      } catch (e) {
        notice(e.message);
      }
    },
  });
  google.accounts.id.renderButton($('google-signin'), {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
  });
  $('auth-status').textContent =
    'Pilih akun instansi yang telah didaftarkan administrator. Jika challenge kedaluwarsa, siapkan login kembali.';
}
function authorised(role) {
  return (
    getSession() &&
    (role === 'mentor'
      ? ['mentor', 'administrator'].includes(getSession().user.role)
      : getSession().user.role === 'administrator')
  );
}
async function mentor() {
  if (!authorised('mentor'))
    return render(
      `${heading('Mentor workspace', 'Akses memerlukan role dan cakupan peserta yang diverifikasi backend.')}<article class="card">${link('Masuk akun instansi', 'account')}</article>`,
    );
  const version = routeVersion;
  render(
    `${heading('Help every learner move forward.', 'Hanya peserta dalam cohort mentor yang ditampilkan.')}<div class="skeleton">Memuat data cohort…</div>`,
  );
  const r = await request('mentorOverview');
  if (version !== routeVersion) return;
  mentorData = r;
  const pending = r.submissions.filter((s) => s.status === 'pending_mentor');
  render(
    `${heading('Mentor workspace', 'Sesi, tugas, attendance, penilaian rubrik, dan feedback berbasis bukti.')} ${stats(
      [
        [r.users.length, 'Peserta dalam cakupan'],
        [r.users.filter((v) => v.state.events.length).length, 'Peserta dengan aktivitas'],
        [pending.length, 'Menunggu review'],
        [r.sessions.filter((s) => s.status === 'completed').length, 'Kegiatan selesai'],
      ],
    )}<div class="controls spaced">${button('Refresh data cohort', 'refresh-mentor')}${link('Laporan pimpinan / program', 'reports', 'secondary')}</div><article class="card spaced"><h2>Participant progress</h2><div class="table-scroll"><table><thead><tr><th>Peserta</th><th>XP aktivitas</th><th>Bukti dinilai</th><th>Prioritas pendampingan</th></tr></thead><tbody>${r.users
      .map((v) => {
        const vals = Object.entries(v.state.skills),
          weak = vals.filter(([, s]) => s.score != null).sort((a, b) => a[1].score - b[1].score)[0];
        return `<tr><td>${esc(v.user.name)} · ${esc(v.user.unit)}</td><td>${v.state.xp}</td><td>${vals.reduce((s, [, v]) => s + v.evidence, 0)}</td><td>${weak ? esc(weak[0]) + ': ' + weak[1].score + '%' : 'Belum ada assessment'}</td></tr>`;
      })
      .join(
        '',
      )}</tbody></table></div></article><div class="grid spaced"><article class="card"><h2>Buat sesi tanpa mengubah kode</h2><label for="mentor-plan-month">Monthly CEC Class<input id="mentor-plan-month" type="month" value="${dayKey().slice(0, 7)}"></label>${button('Buat draft jadwal Selasa', 'tuesday-plan', 'secondary')}<p class="muted">Jadwal adalah rencana; tidak dihitung sebagai pertemuan terlaksana.</p><form id="mentor-session-form"><label for="mentor-session-title">Judul<input id="mentor-session-title" required maxlength="150"></label><label for="mentor-session-date">Tanggal<input id="mentor-session-date" type="date" required></label><label for="mentor-session-program">Program<select id="mentor-session-program">${Object.entries(
      PROGRAMS,
    )
      .map(([id, n]) => `<option value="${id}">${n}</option>`)
      .join(
        '',
      )}</select></label><label for="mentor-session-description">Tema / daily expression / materi<textarea id="mentor-session-description" maxlength="4000"></textarea></label><label for="mentor-session-video">Link materi / video (HTTPS)<input id="mentor-session-video" type="url"></label><label for="mentor-session-prompt">Assignment / speaking challenge<textarea id="mentor-session-prompt" required maxlength="2000"></textarea></label><label for="mentor-session-status">Status<select id="mentor-session-status"><option value="draft">Draft</option><option value="published">Published</option></select></label><button class="button" type="submit">Simpan sesi</button></form></article><article class="card"><h2>Attendance, assessment & feedback</h2><form id="mentor-record-form"><label for="mentor-record-session">Sesi<select id="mentor-record-session" required>${r.sessions.map((s) => `<option value="${s.id}">${esc(s.title)} · ${s.date}</option>`).join('')}</select></label><label for="mentor-record-user">Peserta<select id="mentor-record-user" required>${r.users.map((v) => `<option value="${v.user.id}">${esc(v.user.name)}</option>`).join('')}</select></label><label for="mentor-record-type">Jenis pencatatan<select id="mentor-record-type"><option value="saveAttendance">Attendance</option><option value="saveAssessment">Speaking/writing assessment</option><option value="saveAssignment">Assignment completion</option><option value="saveMentorNote">Mentor note / recommendation</option></select></label><label class="inline-label"><input id="mentor-present" type="checkbox"> Hadir</label><label class="inline-label"><input id="mentor-active" type="checkbox"> Aktif</label><label for="mentor-speaking">Speaking (0–100, hasil review manusia)<input id="mentor-speaking" type="number" min="0" max="100"></label><label for="mentor-writing">Writing (0–100, hasil review manusia)<input id="mentor-writing" type="number" min="0" max="100"></label><label for="mentor-feedback">Feedback / assignment title / note<textarea id="mentor-feedback" maxlength="3000" required></textarea></label><label class="inline-label"><input id="mentor-task-completed" type="checkbox"> Tugas selesai</label><button class="button" type="submit">Simpan catatan resmi</button></form></article></div><article class="card spaced"><h2>Session history & documentation</h2>${r.sessions.map((s) => `<div class="list-item"><div class="grow"><b>${esc(s.title)}</b><p class="muted">${s.date} · ${s.status} · ${esc(PROGRAMS[s.program])}</p></div>${s.status === 'draft' ? `<button class="button secondary" data-publish-session="${s.id}">Terbitkan</button>` : ''}${s.status !== 'completed' ? `<button class="button secondary" data-complete-session="${s.id}">Catat selesai</button>` : ''}<button class="button secondary" data-session-doc="${s.id}">Dokumentasi</button></div>`).join('') || empty('Belum ada sesi.')}</article><article class="card spaced"><h2>Review jawaban terbuka</h2>${pending.length ? pending.map((s) => `<form class="rubric-form card spaced" data-submission="${s.id}"><h3>${esc(r.users.find((v) => v.user.id === s.ownerId)?.user.name || 'Participant')}</h3><p class="muted">${esc(s.questionId || s.sessionId)}</p><div class="example">${esc(s.answer)}</div>${['Relevance', 'Clarity', 'Language', 'Interaction / task fulfilment'].map((name, i) => `<label>${name} · 0–4<select name="rubric-${i}" required><option value="">Belum dinilai</option>${[0, 1, 2, 3, 4].map((n) => `<option value="${n}">${n}</option>`).join('')}</select></label>`).join('')}${s.skill === 'speaking' ? '<label class="inline-label"><input type="checkbox" name="observed-live" required> Saya menilai sampel lisan secara langsung, bukan hanya transkrip.</label>' : ''}<label>Feedback<textarea name="feedback" required maxlength="3000"></textarea></label><button class="button" type="submit">Simpan review rubrik</button></form>`).join('') : empty('Tidak ada jawaban menunggu review.')}</article>`,
  );
}
async function admin() {
  if (!authorised('administrator'))
    return render(
      `${heading('Administration', 'Perubahan role, pengguna, dan konten divalidasi backend.')}<article class="card">${link('Masuk administrator', 'account')}</article>`,
    );
  const version = routeVersion;
  render(
    `${heading('Admin workspace', 'Kelola identitas terverifikasi dan audit perubahan.')}<div class="skeleton">Memuat konfigurasi…</div>`,
  );
  const r = await request('adminOverview');
  if (version !== routeVersion) return;
  adminData = r;
  render(
    `${heading('Admin workspace', 'Akun baru memakai email Workspace yang disetujui. Jangan menautkan identitas hanya berdasarkan kemiripan NIP.')}<div class="controls">${button('Refresh administration', 'refresh-admin')}${button('Download backup V2 · private', 'backup', 'secondary')}${link('Question bank import/export', 'bank', 'secondary')}</div><div class="grid spaced"><article class="card"><h2>Pengguna & role</h2><form id="admin-user-form"><label for="admin-user-select">Buat / edit<select id="admin-user-select"><option value="">Pengguna baru</option>${r.users.map((u) => `<option value="${u.id}">${esc(u.name)} · ${u.role}</option>`).join('')}</select></label><label for="admin-email">Email Workspace<input id="admin-email" type="email" required></label><label for="admin-name">Nama<input id="admin-name" required maxlength="100"></label><label for="admin-unit">Unit kerja<input id="admin-unit" required maxlength="100"></label><label for="admin-cohort">Cohort / cakupan mentor<input id="admin-cohort" maxlength="100"></label><label for="admin-role">Role<select id="admin-role"><option>learner</option><option>mentor</option><option>administrator</option></select></label><label class="inline-label"><input id="admin-disabled" type="checkbox"> Nonaktifkan akun</label><button class="button" type="submit">Simpan pengguna</button></form></article><article class="card"><h2>Content publication queue</h2><p class="muted">Konten preview tidak otomatis menjadi assessment resmi. Review bahasa, tingkat kesulitan, sumber, dan rubrik sebelum menyetujui.</p><label for="content-approval-id">Materi<select id="content-approval-id">${[
      ...r.lessons,
      ...r.questions,
    ]
      .filter((q) => q.reviewStatus !== 'approved')
      .map(
        (q) => `<option value="${q.id}">${esc(q.id)} · ${esc(q.title || q.prompt || '')}</option>`,
      )
      .join(
        '',
      )}</select></label><label for="content-approval-note">Catatan validasi<textarea id="content-approval-note" maxlength="2000"></textarea></label>${button('Setujui konten terpilih', 'approve-content')}<p class="muted spaced">${r.lessons.length} lessons · ${r.questions.length} questions tersimpan di backend. Materi awal dimuat melalui skrip editor staging.</p></article></div><article class="card spaced"><h2>Audit log · 100 terakhir</h2><div class="table-scroll"><table><thead><tr><th>Waktu</th><th>Actor ID</th><th>Aksi</th><th>Target</th></tr></thead><tbody>${r.audit
      .reverse()
      .map(
        (e) =>
          `<tr><td>${esc(e.at)}</td><td>${esc(e.actorId)}</td><td>${esc(e.action)}</td><td>${esc(e.target)}</td></tr>`,
      )
      .join('')}</tbody></table></div></article>`,
  );
}
function notFound() {
  render(
    `${heading('Materi tidak ditemukan.', 'Pilih materi yang tersedia pada peta dunia.')} ${link('Kembali ke beranda', 'home')}`,
  );
}
function renderNav() {
  const items = [...NAV];
  if (authorised('mentor')) items.push(['mentor', '▣', 'Mentor']);
  if (authorised('administrator')) items.push(['admin', '⚙', 'Administration']);
  $('navigation').innerHTML = items
    .map(
      ([id, icon, name]) =>
        `<a class="nav-link" href="#${id}"><span aria-hidden="true">${icon}</span>${name}</a>`,
    )
    .join('');
  $('connection').textContent = getSession() ? 'Akun instansi · online' : 'Latihan mandiri';
}
async function route() {
  routeVersion++;
  speech.cleanup();
  recording = false;
  const [routeName, id] = location.hash.slice(1).split('/'),
    page = routeName || 'home';
  document
    .querySelectorAll('.nav-link')
    .forEach((a) => a.classList.toggle('active', a.hash === '#' + page));
  $('context-label').textContent = NAV.find((v) => v[0] === page)?.[2] || 'Your learning journey';
  try {
    const routes = {
      home,
      worlds,
      world: () => world(id),
      lesson: () => lesson(id),
      daily,
      vocabulary,
      grammar,
      listening,
      speaking,
      conversation: () => conversation(id),
      tutor,
      review,
      progress,
      placement,
      achievements,
      leaderboard,
      englishday,
      reports,
      account,
      mentor,
      admin,
      bank,
      quiz: renderQuiz,
    };
    await (routes[page] || notFound)();
  } catch (e) {
    render(
      `${heading('Belum dapat dimuat.', 'Data tidak diubah ketika permintaan gagal.')}<article class="card"><p>${esc(e.message)}</p>${button('Coba lagi', 'retry-route', 'secondary')}</article>`,
    );
  }
  window.scrollTo({ top: 0, behavior: 'instant' });
}
let selectedTokens = [];
async function clickAction(action) {
  if (action === 'retry-route') return route();
  if (action === 'next-question') {
    quiz.index++;
    quiz.answered = false;
    persistQuiz();
    return renderQuiz();
  }
  if (action === 'exit-quiz') {
    quiz = null;
    return navigate('worlds');
  }
  if (action === 'start-placement') {
    const qs = ['vocabulary', 'grammar', 'reading', 'listening'].flatMap((skill) => [
      QUESTIONS.find((q) => q.world === 1 && q.skill === skill),
      QUESTIONS.find((q) => q.world === 3 && q.skill === skill),
    ]);
    qs.push(
      {
        ...QUESTIONS.find((q) => q.world === 3 && q.type === 'writing'),
        id: 'placement-writing',
        prompt: 'Write a short email asking a colleague to confirm a meeting date.',
      },
      {
        id: 'placement-speaking',
        source: 'cec-original',
        cefr: 'B1',
        skill: 'speaking',
        type: 'speaking',
        prompt:
          'Introduce your role and explain one workplace responsibility. Speak first, then type a summary for mentor review.',
        explanation:
          'A mentor needs an actual speaking sample for a speaking assessment. A typed summary alone is not evidence of pronunciation.',
        rubric: ['Relevance', 'Clarity', 'Language', 'Interaction'],
      },
    );
    return startQuiz(qs, { mode: 'placement', title: 'Placement · internal screening' });
  }
  if (action === 'undo-word') {
    const id = selectedTokens.pop();
    if (id !== undefined) document.querySelector(`[data-token="${id}"]`).disabled = false;
    updateSentence();
    return;
  }
  if (action === 'daily-next') {
    const d = p.dailySession,
      last = d.minutes === 5 ? 3 : d.minutes === 15 ? 4 : 5;
    if (d.step >= last) d.done = true;
    else d.step++;
    speech.cleanup();
    save();
    $('daily-host').innerHTML = dailyContent();
    return;
  }
  if (action === 'flip-card') {
    flashBack = !flashBack;
    return vocabulary();
  }
  if (action === 'next-card') {
    flashIndex++;
    flashBack = false;
    return vocabulary();
  }
  if (action === 'save-word') {
    const v = VOCABULARY[flashIndex % VOCABULARY.length];
    if (!p.notebook.includes(v.id)) p.notebook.push(v.id);
    p.reviews[v.id] ||= reviewNext(null, true);
    save();
    return vocabulary();
  }
  if (action === 'word-hard' || action === 'word-easy') {
    const v = VOCABULARY[flashIndex % VOCABULARY.length];
    p.reviews[v.id] = reviewNext(p.reviews[v.id], action === 'word-easy');
    p.events.push({
      id: crypto.randomUUID(),
      kind: 'flashcard',
      wordId: v.id,
      at: new Date().toISOString(),
      durationMs: 0,
      xp: 0,
    });
    save();
    notice('Jadwal review diperbarui.');
    flashIndex++;
    flashBack = false;
    return vocabulary();
  }
  if (action === 'record') {
    if (recording) return notice('Rekaman sedang berjalan. Gunakan Stop untuk memutar ulang.');
    const version = routeVersion;
    await speech.record((url) => {
      recording = false;
      if (version === routeVersion && $('playback')) {
        $('playback').innerHTML = `<audio controls src="${url}"></audio>`;
        $('speech-status').textContent =
          'Rekaman siap diputar ulang. Tidak ada audio yang diunggah.';
      }
    });
    if (version !== routeVersion) {
      speech.cleanup();
      return;
    }
    recording = true;
    $('speech-status').textContent = 'Merekam… maksimal 2 menit. Tekan Stop setelah selesai.';
    return;
  }
  if (action === 'stop-record') {
    speech.stopRecording();
    recording = false;
    return;
  }
  if (action === 'transcribe') {
    const version = routeVersion;
    speech.transcribe(
      (text) => {
        if (version !== routeVersion) return;
        const target = $('speaking-notes') || $('conversation-answer');
        if (target) target.value = text;
      },
      (status) => {
        if (version === routeVersion && $('speech-status')) $('speech-status').textContent = status;
      },
      audio.accent,
    );
    return;
  }
  if (action === 'speak-model') {
    play($('speaking-prompt').textContent);
    return;
  }
  if (action === 'log-speaking') {
    p.events.push({
      id: crypto.randomUUID(),
      kind: 'speaking-practice',
      skill: 'speaking',
      correct: null,
      score: null,
      at: new Date().toISOString(),
      durationMs: 0,
      xp: 0,
    });
    save();
    notice('Aktivitas dicatat tanpa nilai pronunciation atau kompetensi.');
    return;
  }
  if (action === 'legacy-practice') {
    const src = $('bank-source').value,
      qs = legacyQuestions().filter((q) => !src || q.source.startsWith(src));
    return startQuiz(shuffle(qs).slice(0, 5), { title: 'Existing question practice · archive' });
  }
  if (action === 'export-questions')
    return download('cec-questions-v2-preview.json', JSON.stringify(QUESTIONS, null, 2));
  if (action === 'export-questions-csv')
    return download(
      'cec-questions-v2-preview.csv',
      csv([
        [
          'id',
          'world',
          'level',
          'cefr',
          'skill',
          'type',
          'prompt',
          'answer',
          'explanation',
          'source',
          'reviewStatus',
          'contentVersion',
        ],
        ...QUESTIONS.map((q) => [
          q.id,
          q.world,
          q.level,
          q.cefr,
          q.skill,
          q.type,
          q.prompt,
          q.answer,
          q.explanation,
          q.source,
          q.reviewStatus,
          q.contentVersion,
        ]),
      ]),
      'text/csv;charset=utf-8',
    );
  if (action === 'export-legacy') {
    const data = importLegacyPractice();
    download('cec-legacy-progress-private.json', JSON.stringify(data, null, 2));
    return;
  }
  if (action === 'prepare-login') return prepareLogin();
  if (action === 'logout') {
    const result = await signOut();
    official = null;
    mentorData = null;
    adminData = null;
    sessions = [];
    pendingOfficial = null;
    renderNav();
    notice(
      result.revoked
        ? 'Anda telah logout.'
        : 'Anda telah keluar dari perangkat. Pencabutan sesi server belum dikonfirmasi karena koneksi gagal.',
    );
    return route();
  }
  if (action === 'refresh-official') {
    const r = await request('me');
    official = r.state;
    getSession().user = r.user;
    return progress();
  }
  if (action === 'refresh-mentor') return mentor();
  if (action === 'refresh-admin') return admin();
  if (action === 'load-sessions') return loadSessions();
  if (action === 'tuesday-plan') {
    const month = $('mentor-plan-month').value,
      dates = tuesdayDates(month),
      themes = [
        'Self introduction and office duties',
        'Professional email and telephone',
        'Presentation and product explanation',
        'Discussion and review',
        'Reflective practice',
      ];
    for (let i = 0; i < dates.length; i++)
      await request(
        'saveSession',
        {
          session: {
            title: themes[i],
            date: dates[i],
            description:
              'Monthly CEC Class · draft plan, not evidence of attendance or completion.',
            videoUrl: '',
            prompt: 'Practise the theme in pairs and prepare one reflection for mentor feedback.',
            program: 'workplace_communication',
            status: 'draft',
          },
        },
        { requestId: 'tuesday-' + dates[i] },
      );
    notice(`${dates.length} draft sesi Selasa disiapkan. Tinjau dan terbitkan sesi untuk peserta.`);
    return mentor();
  }
  if (action === 'render-report') return renderReport();
  if (action === 'certificate-print') {
    window.print();
    return;
  }
  if (action.startsWith('report-')) {
    const d = reportData();
    if (action === 'report-json')
      return download(`cec-${d.period}.json`, JSON.stringify(d, null, 2));
    if (action === 'report-csv')
      return download(
        `cec-${d.period}.csv`,
        csv([
          ['Period', 'Source', 'Skill', 'Score', 'Evidence'],
          ...Object.entries(d.skills).map(([k, v]) => [
            d.period,
            d.source,
            k,
            v.score ?? '',
            v.evidence,
          ]),
          ...(d.health
            ? Object.entries(d.health.components).map(([k, v]) => [
                d.period,
                d.source,
                'program:' + k,
                v,
                'weight:' + d.health.weights[k],
              ])
            : []),
        ]),
        'text/csv;charset=utf-8',
      );
    if (action === 'report-print') {
      renderReport();
      window.print();
      return;
    }
    if (action === 'report-copy') {
      await navigator.clipboard.writeText(reportText(d));
      notice('Ringkasan disalin.');
      return;
    }
  }
  if (action === 'official-submit') return submitOfficial();
  if (action === 'import-questions') {
    if (!imported.length) throw Error('Pilih dan validasi JSON terlebih dahulu.');
    const r = await request('importContent', { questions: imported });
    notice(`${r.count} soal draft disimpan di backend; belum dipublikasikan.`);
    return;
  }
  if (action === 'backup') {
    const r = await request('backup');
    download(`cec-v2-private-backup-${dayKey()}.json`, JSON.stringify(r, null, 2));
    notice('Backup privat diunduh. Simpan pada lokasi yang aksesnya terbatas.');
    return;
  }
  if (action === 'approve-content') {
    const id = $('content-approval-id').value,
      q = [...adminData.questions, ...adminData.lessons].find((q) => q.id === id);
    if (!q) throw Error('Pilih konten untuk review.');
    await request('approveContent', {
      id,
      revision: q.revision,
      note: $('content-approval-note').value,
    });
    notice('Review konten tercatat.');
    return admin();
  }
}
function updateSentence() {
  const host = $('sentence-drop');
  if (host)
    host.textContent =
      selectedTokens
        .map((id) => document.querySelector(`[data-token="${id}"]`).textContent)
        .join(' ') || 'Kalimat Anda akan muncul di sini.';
}
function play(text) {
  const found = speech.listen(text, audio);
  if (!found) notice('Suara aksen yang dipilih tidak terpasang; perangkat memakai suara default.');
}
async function submitOfficial() {
  if (!quiz?.results.length) throw Error('Tidak ada jawaban untuk dikirim.');
  if (quiz.results.some((r) => r.value === '[Respons terbuka tidak disimpan setelah reload]'))
    throw Error(
      'Respons terbuka tidak disimpan setelah reload demi privasi. Ulangi assessment sebelum pengiriman resmi.',
    );
  if (!pendingOfficial)
    pendingOfficial = {
      results: [...quiz.results],
      lessonId: quiz.lessonId,
      mode: quiz.mode,
      index: 0,
      learned: false,
    };
  const batch = pendingOfficial;
  if (batch.lessonId && !batch.learned) {
    await request('learn', { lessonId: batch.lessonId });
    batch.learned = true;
  }
  for (; batch.index < batch.results.length; batch.index++) {
    const r = batch.results[batch.index];
    const result = await request(
      'submit',
      { questionId: r.q.id, answer: r.value, mode: batch.mode, durationMs: r.event.durationMs },
      { requestId: r.event.id },
    );
    official = result.state;
  }
  pendingOfficial = null;
  if ($('official-result'))
    $('official-result').textContent =
      'Backend mengonfirmasi seluruh jawaban. Nilai terbuka tetap menunggu review mentor.';
  notice('Sinkronisasi resmi dikonfirmasi backend.');
}
document.addEventListener('click', async (e) => {
  const el = e.target.closest('button');
  if (!el || el.disabled) return;
  try {
    if (el.dataset.action) {
      if (
        [
          'official-submit',
          'backup',
          'approve-content',
          'import-questions',
          'prepare-login',
          'tuesday-plan',
          'load-sessions',
          'refresh-mentor',
          'refresh-admin',
        ].includes(el.dataset.action)
      ) {
        el.disabled = true;
        try {
          await clickAction(el.dataset.action);
        } finally {
          el.disabled = false;
        }
      } else await clickAction(el.dataset.action);
    }
    if (el.dataset.audio) play(el.dataset.audio);
    if (el.dataset.learn) {
      const id = el.dataset.learn;
      p.progress[id] = { ...p.progress[id], learned: true, stage: 'Understand' };
      save();
      lesson(id, 'Understand');
    }
    if (el.dataset.stage) lesson(el.dataset.lesson, el.dataset.stage);
    if (el.dataset.understand) {
      const l = LESSONS.find((l) => l.id === el.dataset.lesson),
        ok = el.dataset.understand === l.audio;
      $('understand-feedback').innerHTML =
        `<div class="feedback">${ok ? '✓ Benar.' : 'Belum tepat. Baca alasan dan coba lagi.'} ${esc(l.concept)}</div>${ok ? `<button class="button" data-stage="Practice" data-lesson="${l.id}">Mulai latihan →</button>` : ''}`;
    }
    if (el.dataset.token) {
      el.disabled = true;
      selectedTokens.push(el.dataset.token);
      updateSentence();
    }
    if (el.dataset.checkSentence) {
      const l = LESSONS.find((l) => l.id === el.dataset.checkSentence),
        value = $('sentence-drop').textContent,
        ok = normalize(value) === normalize(l.audio);
      $('sentence-feedback').innerHTML =
        `<div class="feedback">${ok ? '✓ Tepat.' : `Susunan belum tepat. Contoh: ${esc(l.audio)}`}</div>${ok ? `<button class="button" data-stage="Speak" data-lesson="${l.id}">Lanjut speaking →</button>` : ''}`;
    }
    if (el.dataset.lessonQuiz) {
      const l = LESSONS.find((l) => l.id === el.dataset.lessonQuiz);
      startQuiz(l.questions, { lessonId: l.id, title: l.title + ' · Review' });
    }
    if (el.dataset.answer) answer(el.dataset.answer);
    if (el.dataset.daily) {
      const n = +el.dataset.daily;
      if (!p.dailySession || p.dailySession.minutes !== n || p.dailySession.done)
        p.dailySession = {
          minutes: n,
          step: 0,
          lessonId: recommended().id,
          createdAt: new Date().toISOString(),
          done: false,
        };
      p.goal = n;
      save();
      daily();
    }
    if (el.dataset.dailyListening) {
      const l = LESSONS.find((l) => l.id === el.dataset.dailyListening);
      startQuiz([l.questions[2]], { mode: 'daily-step', title: 'Daily listening' });
    }
    if (el.dataset.dailyQuiz) {
      const l = LESSONS.find((l) => l.id === el.dataset.dailyQuiz);
      startQuiz(
        l.questions
          .filter((q) => q.type !== 'writing')
          .slice(0, p.dailySession.minutes === 5 ? 3 : 4),
        { mode: el.dataset.interim === 'true' ? 'daily-step' : 'daily', title: 'Daily evaluation' },
      );
    }
    if (el.dataset.grammar) {
      const i = GRAMMAR.findIndex((g) => g.id === el.dataset.grammar);
      startQuiz([GRAMMAR[i].question], { title: GRAMMAR[i].title + ' · Practice' });
    }
    if (el.dataset.reviewQuestion) {
      const q =
        QUESTIONS.find((q) => q.id === el.dataset.reviewQuestion) ||
        p.reviewItems?.[el.dataset.reviewQuestion];
      startQuiz([q], { mode: 'review', title: 'Spaced review' });
    }
    if (el.dataset.reviewWord) {
      flashIndex = VOCABULARY.findIndex((v) => v.id === el.dataset.reviewWord);
      flashBack = false;
      navigate('vocabulary');
    }
    if (el.dataset.avatar) {
      p.avatar = el.dataset.avatar;
      save();
      account();
    }
    if (el.dataset.certificate) {
      const l = LESSONS.find((l) => l.id === el.dataset.certificate);
      render(
        `${heading('Catatan penyelesaian internal', 'CEC Quest · Bea Cukai Pangkalpinang')}<article class="card"><h2>${esc(l.title)}</h2><p>Latihan anonim pada perangkat · ${p.progress[l.id].bestScore}% objektif.</p><p>${esc(p.progress[l.id].completedAt || '')}</p><p>Bukan sertifikasi CEFR atau bukti penguasaan speaking/writing.</p>${button('Print / PDF', 'certificate-print', 'no-print')}</article>`,
      );
    }
    if (el.dataset.publishSession) {
      const s = mentorData.sessions.find((v) => v.id === el.dataset.publishSession);
      await request('saveSession', { session: { ...s, status: 'published' } });
      notice('Sesi diterbitkan.');
      await mentor();
    }
    if (el.dataset.completeSession) {
      const s = mentorData.sessions.find((v) => v.id === el.dataset.completeSession);
      await request('saveSession', { session: { ...s, status: 'completed' } });
      notice('Kegiatan dicatat selesai.');
      await mentor();
    }
    if (el.dataset.sessionDoc) {
      const s = mentorData.sessions.find((v) => v.id === el.dataset.sessionDoc);
      render(
        `${heading('Dokumentasi kegiatan', esc(s.title))}<article class="card"><form id="session-document-form" data-session="${s.id}"><label for="documentation-url">Link dokumentasi HTTPS<input id="documentation-url" type="url" required value="${esc(s.documentationUrl || '')}"></label><button class="button" type="submit">Simpan dokumentasi</button></form></article>`,
      );
    }
  } catch (err) {
    notice(err.message);
  }
});
document.addEventListener('submit', async (e) => {
  const form = e.target;
  e.preventDefault();
  const submit = e.submitter;
  if (submit) submit.disabled = true;
  try {
    if (form.id === 'quiz-answer-form') answer($('quiz-answer').value);
    if (form.id === 'conversation-form') {
      const s = SCENARIOS.find((s) => s.id === form.dataset.scenario),
        text = $('conversation-answer').value,
        r = coach(text);
      $('conversation-feedback').innerHTML =
        `<h2>Review respons</h2><p class="muted">Pemeriksaan pola lokal; tidak mencakup seluruh grammar atau kecocokan komunikasi.</p><p>${r.notes.length ? r.notes.map(esc).join(' ') : 'Tidak ada pola yang dikenali. Ini bukan pernyataan bahwa kalimat sudah benar.'}</p>${r.notes.length ? `<div class="example">${esc(r.revised)}</div>` : ''}<h3>Model natural</h3><p lang="en">${esc(s.model)}</p><h3>Formal</h3><p lang="en">${esc(s.formal)}</p><h3>Sederhana</h3><p lang="en">${esc(s.simple)}</p>${rubric(s.rubric)}<p class="muted">Skor komunikasi: belum dinilai. Gunakan review mentor dengan rubrik 0–4 per dimensi.</p>`;
    }
    if (form.id === 'tutor-form') {
      const text = $('tutor-input').value,
        mode = $('tutor-mode').value,
        level = $('tutor-level').value,
        r = coach(text),
        match =
          GRAMMAR.find((g) => normalize(text).includes(g.title.toLowerCase().split(' ')[0])) ||
          GRAMMAR[5];
      const word = VOCABULARY.find((v) => normalize(text).includes(normalize(v.word)));
      $('tutor-result').innerHTML =
        `<h2>${esc(mode)} · ${level}</h2><p class="muted">Mode materi & aturan offline. Pilihan level mengarahkan saran latihan, bukan mengukur kemampuan.</p>${r.notes.length ? `<div class="example">${esc(r.revised)}</div><p>${r.notes.map(esc).join(' ')}</p>` : '<p>Belum ada koreksi yang dapat dipastikan oleh aturan lokal.</p>'}${mode === 'Vocabulary Coach' && word ? `<h3>${word.word}</h3><p>${word.meaning}</p><p>${word.example}</p>` : mode === 'Interview Practice' ? '<h3>Interview prompt</h3><p>Tell me about a time you explained a difficult procedure. What did you do to make it clear?</p>' : mode.includes('Partner') || mode === 'Customs English Tutor' ? `<h3>Try this conversation</h3><p>${SCENARIOS[mode === 'Customs English Tutor' ? 2 : 0].prompt}</p>${link('Buka simulator', 'conversation', 'secondary')}` : `<h3>${match.title}</h3><p>${match.concept}</p><div class="example">${match.example}</div>`}<p class="spaced">Latihan berikutnya: ${esc(LESSONS.find((l) => l.cefr === level)?.objective || 'Tuliskan ringkasan, jelaskan keterbatasan bukti, dan minta mentor menilai respons Anda.')}</p><p class="muted">Jawaban di luar materi memerlukan mentor atau integrasi AI backend yang belum diaktifkan.</p>`;
    }
    if (form.id === 'listening-form') {
      const world = +$('listening-level').value,
        mode = $('listening-mode').value;
      if (!window.speechSynthesis)
        throw Error(
          'Audio perangkat tidak tersedia. Gunakan materi teks sebagai reading; listening tidak dinilai.',
        );
      const qs = LESSONS.filter(
        (l) =>
          l.world ===
          (mode === 'Customs announcements' ? 4 : mode === 'Office announcements' ? 3 : world),
      )
        .slice(0, 4)
        .map((l) => {
          const q = {
            ...l.questions[2],
            id: l.questions[2].id + '-' + mode.replace(/\W/g, ''),
            audio: l.audio,
          };
          if (
            mode === 'Listen and choose' ||
            mode === 'Conversation comprehension' ||
            mode.endsWith('announcements')
          ) {
            q.type = 'mcq';
            q.options = [l.audio, l.examples[0].incorrect];
            q.prompt =
              mode === 'Conversation comprehension'
                ? 'Which response did the speaker use?'
                : 'Listen and choose the message.';
          }
          if (mode === 'Fill in the blanks') {
            const words = l.audio.split(' '),
              i = Math.floor(words.length / 2);
            q.answer = words[i].replace(/[.!?]$/, '');
            q.prompt = words.map((w, j) => (i === j ? '___' : w)).join(' ');
          }
          if (mode === 'Identify keywords') {
            q.answer =
              l.audio
                .split(' ')
                .find((w) => w.length > 6)
                ?.replace(/[.!?]$/, '') || l.audio.split(' ')[1];
            q.prompt = `Dengarkan. Ketik kata kunci: ${q.answer.length} huruf. Contoh model tersedia setelah jawaban.`;
            q.alternatives = [q.answer];
          }
          return q;
        });
      startQuiz(qs, { title: mode + ' · Listening' });
    }
    if (form.classList.contains('session-answer-form')) {
      await request('submitSession', {
        sessionId: form.dataset.session,
        answer: form.querySelector('textarea').value,
      });
      notice('Tugas diterima backend; menunggu review mentor.');
    }
    if (form.id === 'preferences-form') {
      const r = await request('setPreferences', {
        revision: getSession().user.revision,
        alias: $('leaderboard-alias').value,
        showLeaderboard: $('leaderboard-visible').checked,
      });
      getSession().user = r.user;
      notice('Preferensi resmi disimpan.');
    }
    if (form.id === 'mentor-session-form') {
      await request(
        'saveSession',
        {
          session: {
            title: $('mentor-session-title').value,
            date: $('mentor-session-date').value,
            program: $('mentor-session-program').value,
            description: $('mentor-session-description').value,
            videoUrl: $('mentor-session-video').value,
            prompt: $('mentor-session-prompt').value,
            status: $('mentor-session-status').value,
          },
        },
        { requestId: (form.dataset.requestId ||= crypto.randomUUID()) },
      );
      notice('Sesi baru disimpan.');
      await mentor();
    }
    if (form.id === 'mentor-record-form') {
      const action = $('mentor-record-type').value,
        ownerId = $('mentor-record-user').value,
        sessionId = $('mentor-record-session').value,
        key = {
          saveAttendance: 'attendance',
          saveAssessment: 'assessments',
          saveAssignment: 'assignments',
          saveMentorNote: 'mentornotes',
        }[action],
        old = mentorData[key]?.find((v) => v.ownerId === ownerId && v.sessionId === sessionId);
      const data = {
        ownerId,
        sessionId,
        revision: old?.revision,
        present: $('mentor-present').checked,
        active: $('mentor-active').checked,
        speaking: Number($('mentor-speaking').value),
        writing: Number($('mentor-writing').value),
        feedback: $('mentor-feedback').value,
        note: $('mentor-feedback').value,
        title: $('mentor-feedback').value.slice(0, 200),
        completed: $('mentor-task-completed').checked,
      };
      if (
        action === 'saveAssessment' &&
        (!$('mentor-speaking').value || !$('mentor-writing').value)
      )
        throw Error(
          'Isi speaking dan writing berdasarkan assessment nyata. Jangan menganggap kolom kosong sebagai nol.',
        );
      await request(action, data);
      notice('Catatan disimpan oleh backend.');
      await mentor();
    }
    if (form.classList.contains('rubric-form')) {
      const s = mentorData.submissions.find((s) => s.id === form.dataset.submission);
      await request('reviewSubmission', {
        id: s.id,
        revision: s.revision,
        rubric: [0, 1, 2, 3].map((i) => +form.elements['rubric-' + i].value),
        feedback: form.elements.feedback.value,
        observedLive: form.elements['observed-live']?.checked === true,
      });
      notice('Review mentor disimpan.');
      await mentor();
    }
    if (form.id === 'admin-user-form') {
      const old = adminData.users.find((v) => v.id === $('admin-user-select').value);
      await request('saveUser', {
        user: {
          id: old?.id,
          revision: old?.revision,
          email: $('admin-email').value,
          name: $('admin-name').value,
          unit: $('admin-unit').value,
          cohort: $('admin-cohort').value,
          role: $('admin-role').value,
          disabled: $('admin-disabled').checked,
        },
      });
      notice('Pengguna disimpan oleh backend.');
      await admin();
    }
    if (form.id === 'session-document-form') {
      const s = mentorData.sessions.find((v) => v.id === form.dataset.session);
      await request('saveSession', {
        session: { ...s, documentationUrl: $('documentation-url').value },
      });
      notice('Dokumentasi disimpan.');
      await mentor();
    }
  } catch (err) {
    notice(err.message);
  } finally {
    if (submit && form.id !== 'quiz-answer-form') submit.disabled = false;
  }
});
document.addEventListener('change', async (e) => {
  try {
    const el = e.target;
    if (el.id === 'accent') audio.accent = el.value;
    if (el.id === 'audio-rate') audio.rate = +el.value;
    if (el.id === 'audio-volume') audio.volume = +el.value;
    if (el.id === 'daily-goal') {
      p.goal = +el.value;
      save();
    }
    if (el.id === 'scenario-select') navigate('conversation/' + el.value);
    if (el.id === 'speaking-mode') {
      const prompts = {
        'Listen and repeat': recommended().audio,
        Shadowing: 'Listen once, then speak along with the model: ' + recommended().audio,
        'Read aloud': 'Our office provides clear information and professional assistance.',
        'Sentence repetition': 'Could you please confirm the meeting date?',
        'Tongue twisters': 'Fresh fried fish.',
        'Self introduction':
          'Introduce yourself, your role, and one responsibility. Use a fictional name.',
        'Picture description':
          'Describe the logo shown in the navigation: its colours, shapes, and position.',
        'Free conversation': 'What makes communication clear and helpful? Give an example.',
        'Workplace roleplay': SCENARIOS[9].prompt,
      };
      $('speaking-prompt').textContent = prompts[el.value];
    }
    if (el.id === 'admin-user-select') {
      const u = adminData.users.find((v) => v.id === el.value);
      for (const k of ['email', 'name', 'unit', 'cohort', 'role'])
        $('admin-' + k).value = u?.[k] || (k === 'role' ? 'learner' : '');
      $('admin-disabled').checked = u?.disabled || false;
    }
    if (el.id === 'question-import') {
      const file = el.files[0];
      if (!file) return;
      if (file.size > 500000) throw Error('File maksimal 500 KB.');
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data) || data.length > 200)
        throw Error('Gunakan array JSON, maksimal 200 soal per batch.');
      const ids = new Set(),
        errors = [];
      data.forEach((q, i) => {
        const es = validateQuestion(q);
        if (ids.has(q.id)) es.push('duplicate ID');
        ids.add(q.id);
        if (es.length) errors.push(`Baris ${i + 1}: ${es.join(', ')}`);
      });
      imported = errors.length ? [] : data;
      $('import-preview').textContent = errors.length
        ? errors.slice(0, 20).join('\n')
        : `${data.length} draft valid secara struktur. Review isi tetap diperlukan.`;
    }
  } catch (err) {
    imported = [];
    notice(err.message);
  }
});
$('theme').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem('cecQuestTheme', next);
  } catch {}
});
try {
  document.documentElement.dataset.theme =
    localStorage.getItem('cecQuestTheme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch {}
window.addEventListener('hashchange', () => {
  selectedTokens = [];
  route();
});
window.addEventListener('online', () =>
  notice(
    'Koneksi kembali tersedia. Pengiriman resmi yang belum dikonfirmasi dapat dicoba ulang dengan ID yang sama.',
  ),
);
window.addEventListener('offline', () =>
  notice('Anda sedang offline. Latihan mandiri tetap disimpan pada perangkat.'),
);
window.addEventListener('pagehide', () => speech.cleanup());
renderNav();
route();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('./sw.js', { scope: './' })
    .then((reg) => {
      const show = () => {
        if (reg.waiting) {
          $('update-banner').hidden = false;
          $('update-app').onclick = () => {
            save();
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          };
        }
      };
      show();
      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) show();
        });
      });
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          location.reload();
        }
      });
    })
    .catch(() => {
      if (!$('notice').textContent)
        notice('Offline cache belum tersedia. Latihan tetap dapat digunakan saat online.');
    });
}
