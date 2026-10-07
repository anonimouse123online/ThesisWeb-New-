import { apiUrl } from './api';
import { collectLoginSecurityContext, type LoginSecurityContext } from './loginSecurity';

export interface AuthUser {
  id: string | number;
  name?: string;
  email: string;
  role: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

type LoginStage = 'verifying' | 'location' | 'finalizing';
type LoginFlow = 'legacy' | 'two-step';

const restrictedMessage = 'Access Restricted: Only Administrators can log in to the web management portal. Site Engineers and field personnel must use the SitePulse mobile app.';

function requireAdmin(user: unknown): asserts user is AuthUser {
  if (!user || typeof user !== 'object' || !('role' in user) || typeof user.role !== 'string' ||
      !('id' in user) || (typeof user.id !== 'string' && typeof user.id !== 'number') ||
      !('email' in user) || typeof user.email !== 'string' || !user.email) {
    throw new Error('Invalid login response from server. Please try again.');
  }
  if (user.role.trim().toLowerCase() !== 'admin') throw new Error(restrictedMessage);
}

async function postLogin(path: string, body: unknown): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Cannot connect to server. Check your connection and try again.');
  }
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new Error('Invalid credentials or expired login attempt. Please sign in again.');
    }
    if (response.status === 403) throw new Error('Access denied. Contact your administrator.');
    if (response.status === 429) throw new Error('Too many login attempts. Please wait before trying again.');
    throw new Error('Sign-in is temporarily unavailable. Please try again later.');
  }
  const data: unknown = await response.json().catch(() => null);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid login response from server. Please try again.');
  }
  return data as Record<string, unknown>;
}

/** Attach context to an existing login where the backend supports authenticated logging. */
async function recordLegacyLoginSecurity(token: string, security_context: LoginSecurityContext): Promise<void> {
  try {
    await fetch(apiUrl('/auth/login/security-context'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ security_context }),
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    });
  } catch {
    // The old backend has no logging endpoint. Keep its successful session usable.
    // Strict server logging before issuing a JWT requires the opt-in two-step flow.
  }
}

/** Returns only the final session; callers retain the existing storage method. */
export async function loginAdmin(
  email: string,
  password: string,
  onStage?: (stage: LoginStage) => void,
  flow: LoginFlow = import.meta.env.VITE_LOGIN_SECURITY_FLOW === 'two-step' ? 'two-step' : 'legacy',
  requestLocation: () => Promise<LoginSecurityContext> = collectLoginSecurityContext,
): Promise<AuthSession> {
  onStage?.('verifying');
  const credentials = { email: email.trim().toLowerCase(), password };
  let data: Record<string, unknown>;

  if (flow === 'two-step') {
    const verified = await postLogin('/auth/login/verify', credentials);
    requireAdmin(verified.user);
    if (typeof verified.login_attempt_token !== 'string' || !verified.login_attempt_token) {
      throw new Error('Invalid login verification response. Please sign in again.');
    }
    onStage?.('location');
    const security_context = await requestLocation();
    onStage?.('finalizing');
    data = await postLogin('/auth/login/security-context', {
      login_attempt_token: verified.login_attempt_token,
      security_context,
    });
  } else {
    // The existing login endpoint validates credentials before location is requested.
    data = await postLogin('/auth/login', credentials);
  }

  requireAdmin(data.user);
  if (typeof data.token !== 'string' || !data.token) {
    throw new Error('Invalid login response from server. Please try again.');
  }
  if (flow === 'legacy') {
    onStage?.('location');
    const security_context = await requestLocation();
    onStage?.('finalizing');
    await recordLegacyLoginSecurity(data.token, security_context);
  }
  // Keep only profile fields so an accidental credential/token field from the
  // backend cannot be copied into the stored user object.
  return {
    token: data.token,
    user: {
      id: data.user.id,
      email: data.user.email,
      role: data.user.role,
      ...(typeof data.user.name === 'string' ? { name: data.user.name } : {}),
    },
  };
}
