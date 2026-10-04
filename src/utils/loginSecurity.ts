export type LocationPermissionStatus = 'GRANTED' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT';

export interface LoginSecurityContext {
  latitude: number | null;
  longitude: number | null;
  location_accuracy: number | null;
  location_permission_status: LocationPermissionStatus;
  user_agent: string;
  platform: string | null;
  language: string | null;
}

export function hasCoordinates(latitude: number | null, longitude: number | null): boolean {
  return latitude !== null && longitude !== null &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

export function createLoginSecurityContext(status: LocationPermissionStatus = 'UNAVAILABLE'): LoginSecurityContext {
  return {
    latitude: null,
    longitude: null,
    location_accuracy: null,
    location_permission_status: status,
    user_agent: typeof navigator === 'undefined' ? '' : navigator.userAgent,
    platform: typeof navigator === 'undefined' ? null : navigator.platform || null,
    language: typeof navigator === 'undefined' ? null : navigator.language || null,
  };
}

/** A single, bounded location request. Nothing is persisted or continuously tracked. */
export async function collectLoginSecurityContext(): Promise<LoginSecurityContext> {
  const context = createLoginSecurityContext();

  if (typeof navigator === 'undefined' || !navigator.geolocation ||
      (typeof window !== 'undefined' && !window.isSecureContext)) return context;

  return new Promise(resolve => {
    let settled = false;
    const finish = (result: LoginSecurityContext) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      resolve(result);
    };
    // Also bounds browsers that leave their permission prompt unanswered.
    const deadline = setTimeout(() => finish({
      ...context, location_permission_status: 'TIMEOUT',
    }), 15_000);

    try {
      navigator.geolocation.getCurrentPosition(position => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!hasCoordinates(latitude, longitude) || !Number.isFinite(accuracy) || accuracy < 0) {
          finish(context);
          return;
        }
        finish({
          ...context, latitude, longitude, location_accuracy: accuracy,
          location_permission_status: 'GRANTED',
        });
      }, error => {
        const status: LocationPermissionStatus = error.code === 1 ? 'DENIED'
          : error.code === 3 ? 'TIMEOUT' : 'UNAVAILABLE';
        finish({ ...context, location_permission_status: status });
      }, { enableHighAccuracy: false, timeout: 10_000, maximumAge: 0 });
    } catch {
      finish(context);
    }
  });
}
