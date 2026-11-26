const KEY = 'cecQuestV2Practice';
export function blank() {
  return {
    schemaVersion: 2,
    xp: 0,
    avatar: '🧭',
    progress: {},
    events: [],
    reviews: {},
    notebook: [],
    journey: null,
    placement: null,
    goal: 5,
  };
}
export function readPractice() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    return p?.schemaVersion === 2 &&
      Array.isArray(p.events) &&
      Array.isArray(p.notebook) &&
      p.progress &&
      typeof p.progress === 'object' &&
      p.reviews &&
      typeof p.reviews === 'object'
      ? { ...blank(), ...p }
      : blank();
  } catch {
    return blank();
  }
}
export function savePractice(p) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    return true;
  } catch {
    return false;
  }
}
export function legacySummary() {
  // Never hydrate credentials, names, NIP, roles or XP into official state.
  try {
    const data = JSON.parse(localStorage.getItem('cecQuestUsers') || '{}');
    return {
      accounts: Object.keys(data).length,
      completed: Object.values(data).reduce((n, u) => n + Object.keys(u?.progress || {}).length, 0),
    };
  } catch {
    return { accounts: 0, completed: 0 };
  }
}
export function importLegacyPractice(index = 0) {
  const data = JSON.parse(localStorage.getItem('cecQuestUsers') || '{}');
  const old = Object.values(data)[index];
  if (!old) throw Error('Arsip lokal tidak ditemukan.');
  // Original key remains intact. Archive IDs deliberately differ from new curriculum IDs.
  return {
    schemaVersion: 2,
    importedAt: new Date().toISOString(),
    official: false,
    progress: Object.entries(old.progress || {}).map(([legacyId, v]) => ({
      legacyId,
      score: Number(v?.score) || 0,
      stars: Number(v?.stars) || 0,
      date: v?.date || null,
    })),
    xp: Number(old.xp) || 0,
  };
}
