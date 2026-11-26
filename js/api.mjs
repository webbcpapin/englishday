let session = null;
export const getSession = () => {
  if (session && Date.now() > session.expiresAt) session = null;
  return session;
};
export function clearSession() {
  session = null;
}
export async function request(action, payload = {}, options = {}) {
  const config = window.CEC_CONFIG;
  if (!config?.institutionalAuthApproved || !config.apiUrl)
    throw Error('Layanan akun instansi belum dikonfigurasi. Latihan mandiri tetap tersedia.');
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      signal: controller.signal,
      body: JSON.stringify({
        action,
        payload,
        token: getSession()?.token || '',
        requestId: options.requestId || crypto.randomUUID(),
        schemaVersion: 2,
      }),
    });
    const result = await response.json();
    if (!result.ok) {
      if (result.code === 'UNAUTHORIZED') session = null;
      throw Error(result.error || 'Permintaan gagal.');
    }
    return result;
  } catch (e) {
    if (e.name === 'AbortError')
      throw Error(
        'Server belum merespons. Coba ulangi; ID pengiriman dipertahankan untuk mencegah duplikasi.',
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
export async function signIn(credential, challenge) {
  const result = await request('login', { credential, challenge });
  session = { token: result.token, user: result.user, expiresAt: result.expiresAt };
  return result;
}
export async function signOut() {
  try {
    if (session) await request('logout');
    return { revoked: true };
  } catch (e) {
    return { revoked: false, error: e.message };
  } finally {
    clearSession();
  }
}
