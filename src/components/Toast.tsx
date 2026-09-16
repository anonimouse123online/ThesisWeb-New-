import React, { useEffect, useState } from 'react';
import './Toast.css';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return <CheckCircle2 size={18} />;
    case 'error':
      return <AlertCircle size={18} />;
    case 'warning':
      return <AlertTriangle size={18} />;
    case 'info':
    default:
      return <Info size={18} />;
  }
};

const Toast: React.FC<ToastProps> = ({ message, type = 'info', duration = 3500, onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 300); // wait for fade-out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`toast toast--${type} ${visible ? 'toast--visible' : 'toast--hidden'}`}>
      <span className="toast-icon" style={{ display: 'flex', alignItems: 'center' }}>{getToastIcon(type)}</span>
      <span className="toast-msg">{message}</span>
      <button className="toast-close" onClick={() => { setVisible(false); setTimeout(onClose, 300); }} aria-label="Close">
        <X size={14} />
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
let addToastFn: ((message: string, type?: ToastType) => void) | null = null;

/** Call this from anywhere to show a toast */
export function showToast(message: string, type: ToastType = 'info') {
  if (addToastFn) addToastFn(message, type);
}

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    addToastFn = (message: string, type: ToastType = 'info') => {
      const id = ++toastId;
      setToasts(prev => [...prev, { id, message, type }]);
    };
    return () => { addToastFn = null; };
  }, []);

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast
          key={t.id}
          message={t.message}
          type={t.type}
          onClose={() => removeToast(t.id)}
        />
      ))}
    </div>
  );
};

export default Toast;
