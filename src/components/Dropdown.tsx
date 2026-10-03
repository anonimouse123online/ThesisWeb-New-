import React, { useState, useRef, useEffect, useMemo } from 'react';
import './Dropdown.css';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: 'orange' | 'blue' | 'green' | 'purple' | 'gray' | 'red';
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface DropdownProps {
  label?: string;
  options: (string | DropdownOption)[];
  value?: string;
  onChange: (value: string) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
  align?: 'left' | 'right';
  fullWidth?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  error?: boolean | string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  label,
  options,
  value,
  onChange,
  prefix,
  placeholder = 'Select an option',
  className = '',
  align = 'left',
  fullWidth = false,
  disabled = false,
  searchable,
  size = 'md',
  id,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options
  const normalizedOptions: DropdownOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
  }, [options]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value);
  }, [normalizedOptions, value]);

  // Should show search input? Auto-enable if >= 8 items unless explicitly set
  const showSearch = searchable !== undefined ? searchable : normalizedOptions.length >= 8;

  // Filter options by search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  // Display text for the button
  const displayLabel = selectedOption
    ? selectedOption.label
    : label || placeholder;

  // Click outside and escape key listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      if (showSearch) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, showSearch]);

  const handleSelect = (opt: DropdownOption) => {
    if (opt.disabled) return;
    onChange(opt.value);
    setIsOpen(false);
    setSearchQuery('');
  };

  const toggleDropdown = () => {
    if (disabled) return;
    setIsOpen((prev) => !prev);
    if (!isOpen) setSearchQuery('');
  };

  return (
    <div
      id={id}
      className={`sp-dropdown ${fullWidth ? 'sp-dropdown--full' : ''} ${isOpen ? 'sp-dropdown--open' : ''} ${className}`}
      ref={dropdownRef}
    >
      <button
        type="button"
        className={`sp-dropdown-trigger sp-dropdown-trigger--${size} ${
          isOpen ? 'sp-dropdown-trigger--active' : ''
        } ${disabled ? 'sp-dropdown-trigger--disabled' : ''} ${
          error ? 'sp-dropdown-trigger--error' : ''
        } ${fullWidth ? 'sp-dropdown-trigger--full' : ''}`}
        onClick={toggleDropdown}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <div className="sp-dropdown-trigger-content">
          {selectedOption?.icon && (
            <span className="sp-dropdown-trigger-icon">{selectedOption.icon}</span>
          )}

          {prefix && <span className="sp-dropdown-prefix">{prefix}:</span>}

          <span
            className={`sp-dropdown-label ${
              !selectedOption ? 'sp-dropdown-label--placeholder' : ''
            }`}
          >
            {displayLabel}
          </span>

          {selectedOption?.badge && (
            <span
              className={`sp-dropdown-badge ${
                selectedOption.badgeColor ? `sp-dropdown-badge--${selectedOption.badgeColor}` : ''
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <span
          className={`sp-dropdown-chevron ${
            isOpen ? 'sp-dropdown-chevron--open' : ''
          }`}
        >
          <ChevronDown size={size === 'sm' ? 13 : size === 'lg' ? 18 : 15} />
        </span>
      </button>

      {isOpen && (
        <div
          className={`sp-dropdown-menu ${
            align === 'right' ? 'sp-dropdown-menu--right' : ''
          } ${fullWidth ? 'sp-dropdown-menu--full' : ''}`}
          role="listbox"
        >
          {showSearch && (
            <div className="sp-dropdown-search-wrap">
              <Search size={14} className="sp-dropdown-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="sp-dropdown-search-input"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sp-dropdown-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          <div className="sp-dropdown-list">
            {filteredOptions.length === 0 ? (
              <div className="sp-dropdown-empty">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`sp-dropdown-item ${
                      isSelected ? 'sp-dropdown-item--selected' : ''
                    } ${opt.disabled ? 'sp-dropdown-item--disabled' : ''}`}
                    onClick={() => handleSelect(opt)}
                    disabled={opt.disabled}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <div className="sp-dropdown-item-left">
                      {opt.icon && (
                        <span className="sp-dropdown-item-icon">{opt.icon}</span>
                      )}
                      <div className="sp-dropdown-item-texts">
                        <span className="sp-dropdown-item-label">{opt.label}</span>
                        {opt.sublabel && (
                          <span className="sp-dropdown-item-sublabel">
                            {opt.sublabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="sp-dropdown-item-right">
                      {opt.badge && (
                        <span
                          className={`sp-dropdown-badge ${
                            opt.badgeColor ? `sp-dropdown-badge--${opt.badgeColor}` : ''
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <span className="sp-dropdown-check">
                          <Check size={14} strokeWidth={2.5} />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {typeof error === 'string' && error && (
        <span className="sp-dropdown-error-text">{error}</span>
      )}
    </div>
  );
};

export default Dropdown;
