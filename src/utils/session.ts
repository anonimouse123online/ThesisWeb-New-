// Session boundaries discard all account data while retaining login preferences.
export function clearSession(): void {
  const storage = typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null;
  const remember = typeof storage?.getItem === 'function' ? storage.getItem('remember_me') : null;
  const email = typeof storage?.getItem === 'function' ? storage.getItem('remembered_email') : null;
  if (typeof storage?.clear === 'function') {
    storage.clear();
  } else if (storage) {
    storage.removeItem?.('token');
    storage.removeItem?.('authToken');
    storage.removeItem?.('accessToken');
    storage.removeItem?.('user');
  }
  if (typeof globalThis.sessionStorage !== 'undefined' && typeof globalThis.sessionStorage?.clear === 'function') {
    globalThis.sessionStorage.clear();
  }
  if (remember && typeof storage?.setItem === 'function') storage.setItem('remember_me', remember);
  if (email && typeof storage?.setItem === 'function') storage.setItem('remembered_email', email);
}

export function logoutSession(): void {
  clearSession();
  // A document navigation tears down React state, requests and socket clients.
  window.location.replace('/login');
}

export function startSession(token: string, user: unknown): void {
  clearSession();
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('token', token);
}

export function installSessionIsolation(): void {
  window.addEventListener('storage', event => {
    if (event.key === 'token' || event.key === null) window.location.reload();
  });
  window.addEventListener('pageshow', event => {
    if (event.persisted) window.location.reload();
  });
}
