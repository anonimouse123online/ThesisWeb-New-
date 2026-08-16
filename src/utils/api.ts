/**
 * Wrapper around fetch() that automatically includes the JWT token
 * from localStorage in the Authorization header.
 *
 * Usage: import { fetchWithAuth } from '../utils/api';
 *        const res = await fetchWithAuth('/tasks');
 *        const data = await res.json();
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Default to JSON content type for POST/PATCH/PUT requests (unless uploading FormData)
  if (options.body && !headers['Content-Type'] && !(typeof FormData !== 'undefined' && options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If 401 (or 404 on auth check), session/user is invalid — redirect to login
  if (response.status === 401 || (response.status === 404 && url.includes('/auth/me'))) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Session expired or user not found. Please log in again.');
  }

  return response;
}
