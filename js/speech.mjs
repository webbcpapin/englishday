let recorder,
  stream,
  chunks = [],
  url,
  recognition,
  recordingTimer,
  generation = 0;
export function listen(text, { accent = 'en-GB', rate = 0.85, volume = 1 } = {}) {
  if (!('speechSynthesis' in window))
    throw Error('Audio perangkat tidak didukung. Gunakan transkrip yang tersedia.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent;
  u.rate = rate;
  u.volume = volume;
  const voice = speechSynthesis.getVoices().find((v) => v.lang === accent);
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
  return !!voice;
}
export async function record(onDone) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
    throw Error('Perekaman tidak didukung. Gunakan teks dan review mandiri/mentor.');
  cleanup();
  const current = ++generation;
  try {
    const acquired = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (current !== generation) {
      acquired.getTracks().forEach((t) => t.stop());
      throw Error('Permintaan rekaman dibatalkan setelah meninggalkan halaman.');
    }
    stream = acquired;
    recorder = new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    recorder.onstop = () => {
      clearTimeout(recordingTimer);
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
      stream?.getTracks().forEach((t) => t.stop());
      onDone(url);
    };
    recorder.start();
    recordingTimer = setTimeout(stopRecording, 120000);
  } catch (e) {
    if (current === generation) stream?.getTracks().forEach((t) => t.stop());
    throw e;
  }
}
export function stopRecording() {
  clearTimeout(recordingTimer);
  if (recorder?.state === 'recording') recorder.stop();
}
export function transcribe(onText, onEnd, accent = 'en-GB') {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR)
    throw Error('Transkripsi belum didukung browser ini. Rekaman dan teks tetap bisa digunakan.');
  recognition?.stop();
  recognition = new SR();
  recognition.lang = accent;
  recognition.interimResults = false;
  recognition.onresult = (e) => onText([...e.results].map((r) => r[0].transcript).join(' '));
  recognition.onerror = (e) => onEnd(`Transkripsi berhenti: ${e.error}`);
  recognition.onend = () => onEnd('Transkripsi selesai. Ini bukan skor pelafalan.');
  recognition.start();
}
export function cleanup() {
  generation++;
  clearTimeout(recordingTimer);
  if (recorder) {
    recorder.onstop = null;
    if (recorder.state === 'recording') recorder.stop();
  }
  stream?.getTracks().forEach((t) => t.stop());
  recognition?.stop();
  if (url) {
    URL.revokeObjectURL(url);
    url = null;
  }
  window.speechSynthesis?.cancel();
}
