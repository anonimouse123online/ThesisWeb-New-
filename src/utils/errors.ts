/** Preserve messages from Error instances and API-style thrown objects. */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred.'): string {
  if (error !== null && typeof error === 'object' && 'message' in error &&
      typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
}
