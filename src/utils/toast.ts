export type ToastType = 'success' | 'error' | 'warning' | 'info';

type ToastHandler = (message: string, type?: ToastType) => void;
let addToastFn: ToastHandler | null = null;

export function registerToastHandler(handler: ToastHandler): () => void {
  addToastFn = handler;
  return () => { addToastFn = null; };
}

/** Call this from anywhere to show a toast. */
export function showToast(message: string, type: ToastType = 'info') {
  if (addToastFn) addToastFn(message, type);
}
