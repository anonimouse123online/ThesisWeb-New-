import React, { useState, useRef, useEffect } from 'react';
import './Dropdown.css';

export interface DropdownOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}

interface DropdownProps {
  label?: string;
  options: (string | DropdownOption)[];
  value?: string;
  onChange: (value: string) => void;
  prefix?: string;
  className?: string;
  align?: 'left' | 'right';
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  prefix,
  className = '',
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: DropdownOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt
  );

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);
  const displayLabel = selectedOption
    ? `${prefix ? prefix + ': ' : ''}${selectedOption.label}`
    : label || (prefix ? `${prefix} ▾` : 'Select');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
  };

  return (
    <div className={`sp-dropdown ${className}`} ref={dropdownRef}>
      <button
        type="button"
        className={`sp-dropdown-trigger ${isOpen ? 'sp-dropdown-trigger--active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <span>{displayLabel}</span>
        <span className={`sp-dropdown-chevron ${isOpen ? 'sp-dropdown-chevron--open' : ''}`}>▾</span>
      </button>

      {isOpen && (
        <div className={`sp-dropdown-menu ${align === 'right' ? 'sp-dropdown-menu--right' : ''}`}>
          {normalizedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                className={`sp-dropdown-item ${isSelected ? 'sp-dropdown-item--selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {opt.icon && <span>{opt.icon}</span>}
                  <span>{opt.label}</span>
                </div>
                {opt.badge && <span className="sp-dropdown-badge">{opt.badge}</span>}
                {isSelected && <span className="sp-dropdown-check">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Dropdown;
