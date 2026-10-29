// Session boundaries discard all account data while retaining login preferences.
export function clearSession(): void {
  const remember = localStorage.getItem('remember_me');
  const email = localStorage.getItem('remembered_email');
  localStorage.clear();
  sessionStorage.clear();
  if (remember) localStorage.setItem('remember_me', remember);
  if (email) localStorage.setItem('remembered_email', email);
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
