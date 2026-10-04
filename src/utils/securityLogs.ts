import { fetchWithAuth } from './api';
import { hasCoordinates } from './loginSecurity';

export interface SecurityLoginLog {
  id: string | number;
  user_name: string | null;
  email: string | null;
  role: string | null;
  event_type: string | null;
  login_status: string | null;
  timestamp: string | null;
  ip_address: string | null;
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_permission_status: string | null;
  location: string | null;
  user_agent: string | null;
  platform: string | null;
  language: string | null;
  security_status: string | null;
  security_reason: string | null;
}

export interface SecurityLogsPage {
  logs: SecurityLoginLog[];
  pagination: { page: number; total_pages: number; total: number };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === '' ||
      (typeof value !== 'number' && typeof value !== 'string') ||
      (typeof value === 'string' && !value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Whitelist audit fields so tokens and unrelated response data never enter UI state. */
export function parseSecurityLogs(payload: unknown, requestedPage = 1): SecurityLogsPage {
  const envelope = record(payload);
  const rows = Array.isArray(payload) ? payload : envelope.data ?? envelope.logs;
  if (!Array.isArray(rows)) throw new Error('Security logs could not be read. Please try again later.');

  const logs = rows.map(value => {
    const row = record(value);
    if (typeof row.id !== 'string' && typeof row.id !== 'number') {
      throw new Error('Security logs could not be read. Please try again later.');
    }
    const user = record(row.user);
    const context = record(row.security_context);
    const latitude = number(row.latitude ?? context.latitude);
    const longitude = number(row.longitude ?? context.longitude);
    const validCoordinates = hasCoordinates(latitude, longitude);
    const accuracy = number(row.location_accuracy ?? context.location_accuracy);
    return {
      id: row.id,
      user_name: string(row.user_name ?? user.name),
      email: string(row.email ?? user.email),
      role: string(row.role ?? user.role),
      event_type: string(row.event_type),
      login_status: string(row.login_status),
      timestamp: string(row.timestamp ?? row.created_at),
      ip_address: string(row.ip_address),
      latitude: validCoordinates ? latitude : null,
      longitude: validCoordinates ? longitude : null,
      location_accuracy: accuracy !== null && accuracy >= 0 ? accuracy : null,
      location_permission_status: string(row.location_permission_status ?? context.location_permission_status),
      location: string(row.location),
      user_agent: string(row.user_agent ?? context.user_agent),
      platform: string(row.platform ?? context.platform),
      language: string(row.language ?? context.language),
      security_status: string(row.security_status),
      security_reason: string(row.security_reason),
    };
  });

  const pagination = record(envelope.pagination);
  const totalPages = number(pagination.total_pages);
  const page = number(pagination.page);
  const total = number(pagination.total);
  // Unpaginated arrays are displayed in full, without inventing additional pages.
  return {
    logs,
    pagination: {
      page: page !== null && Number.isInteger(page) && page >= 1 ? page : requestedPage,
      total_pages: totalPages !== null && Number.isInteger(totalPages) && totalPages >= 1 ? totalPages : requestedPage,
      total: total !== null && Number.isInteger(total) && total >= 0 ? total : logs.length,
    },
  };
}

export async function fetchSecurityLogs(page: number, signal?: AbortSignal): Promise<SecurityLogsPage> {
  let response: Response;
  try {
    response = await fetchWithAuth(`/security/login-logs?page=${page}&limit=25`, {
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Unable to load security logs. Check your connection or sign in again.');
  }
  if (response.status === 403) throw new Error('You do not have permission to view security logs.');
  if (response.status === 404) throw new Error('Security logs are not available on this server yet.');
  if (!response.ok) throw new Error('Security logs are temporarily unavailable. Please try again later.');
  const payload: unknown = await response.json().catch(() => null);
  return parseSecurityLogs(payload, page);
}

export function locationUrl(log: Pick<SecurityLoginLog, 'latitude' | 'longitude'>): string | null {
  if (!hasCoordinates(log.latitude, log.longitude)) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${log.latitude},${log.longitude}`)}`;
}
