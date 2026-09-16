import React, { useEffect, useState } from 'react';
import './Toast.css';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3500,
  onClose,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);

      setTimeout(onClose, 300); // wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`toast toast--${type} ${
        visible ? 'toast--visible' : 'toast--hidden'
      }`}
    >
      <span className="toast-icon">{ICONS[type]}</span>

      <span className="toast-msg">{message}</span>

      <button
        className="toast-close"
        onClick={() => {
          setVisible(false);
          setTimeout(onClose, 300);
        }}
      >
        ×
      </button>
    </div>
  );
};

// ─── Toast Container (manages multiple toasts) ──────────────────────────────

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;

let addToastFn:
  | ((message: string, type?: ToastType) => void)
  | null = null;

/** Call this from anywhere to show a toast */
export function showToast(
  message: string,
  type: ToastType = 'info'
) {
  if (addToastFn) {
    addToastFn(message, type);
  }
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (
      message: string,
      type: ToastType = 'info'
    ) => {
      const id = ++toastId;

      setToasts((prev) => [
        ...prev,
        {
          id,
          message,
          type,
        },
      ]);
    };

    return () => {
      addToastFn = null;
    };
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) =>
      prev.filter((toast) => toast.id !== id)
    );
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
};

export default Toast;