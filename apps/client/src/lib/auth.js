const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const storageKey = (address) => `mintora:session:${address.toLowerCase()}`;

function storedToken(address) {
  try {
    const session = JSON.parse(localStorage.getItem(storageKey(address)));
    return session && new Date(session.expiresAt).getTime() > Date.now() + 5 * 60_000 ? session.token : null;
  } catch {
    return null;
  }
}

function forget(address) {
  try { localStorage.removeItem(storageKey(address)); } catch { }
}

async function readJson(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.message || `Request failed (${res.status})`);
  return body;
}

export const hasSession = (address) => !!address && !!storedToken(address);

// Asks the wallet to sign in and stores the session
export async function signIn(address, signMessageAsync) {
  const { message } = await readJson(await fetch(`${BASE_URL}/api/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  }));
  const signature = await signMessageAsync({ account: address, message });
  const session = await readJson(await fetch(`${BASE_URL}/api/auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, signature }),
  }));
  try { localStorage.setItem(storageKey(address), JSON.stringify(session)); } catch { }
  return session.token;
}

// fetch() as `address`, signing in first if needed, and again if the API dropped the session
export async function authFetch(address, signMessageAsync, url, init = {}) {
  const send = (token) => fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
  let res = await send(storedToken(address) ?? await signIn(address, signMessageAsync));
  if (res.status === 401) {
    forget(address);
    res = await send(await signIn(address, signMessageAsync));
  }
  return res;
}

// Ends the session on this device and on the API
export async function signOut(address) {
  const token = address && storedToken(address);
  forget(address ?? "");
  if (token) {
    await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  }
}
