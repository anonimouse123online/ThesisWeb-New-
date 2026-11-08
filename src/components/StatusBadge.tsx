import React from 'react';
import { Lock, Clock } from 'lucide-react';
import './StatusBadge.css';

import { getStatusVariant, type StatusVariant } from '../utils/status';

export type { StatusVariant } from '../utils/status';

export interface StatusBadgeProps {
  status: string;
  variant?: StatusVariant;
  className?: string;
  showDot?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export default function StatusBadge({
  status,
  variant,
  className = '',
  showDot = true,
  style,
  title,
}: StatusBadgeProps) {
  const finalVariant = variant || getStatusVariant(status);

  return (
    <span
      className={`sp-status-badge sp-status-badge--${finalVariant} ${className}`}
      style={style}
      title={title}
    >
      {finalVariant === 'locked' ? (
        <Lock size={11} strokeWidth={2.4} className="sp-status-badge__icon" />
      ) : finalVariant === 'extended' ? (
        <Clock size={11} strokeWidth={2.4} className="sp-status-badge__icon" />
      ) : (
        showDot && <span className="sp-status-badge__dot" />
      )}
      <span className="sp-status-badge__label">{status}</span>
    </span>
  );
}
