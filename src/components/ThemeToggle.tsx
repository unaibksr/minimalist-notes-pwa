import React from 'react';
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react';
import type { ThemeMode } from '../lib/useTheme';

interface ThemeToggleProps {
  mode: ThemeMode;
  onChange: (mode: ThemeMode) => void;
}

const OPTIONS: Array<{ key: ThemeMode; label: string; Icon: LucideIcon }> = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
  { key: 'system', label: 'System', Icon: Monitor },
];

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ mode, onChange }) => (
  <div
    role="radiogroup"
    aria-label="Theme"
    className="inline-flex items-center gap-0.5 rounded-lg border border-cream-300 dark:border-navy-600 bg-cream-100 dark:bg-navy-900 p-0.5"
  >
    {OPTIONS.map(({ key, label, Icon }) => {
      const active = mode === key;
      return (
        <button
          key={key}
          role="radio"
          aria-checked={active}
          aria-label={`${label} theme`}
          title={`${label} theme`}
          onClick={() => onChange(key)}
          className={`flex items-center justify-center min-w-[44px] min-h-[36px] rounded-md transition-colors active:scale-95 ${
            active
              ? 'bg-white dark:bg-navy-700 text-primary-600 dark:text-primary-400 shadow-sm'
              : 'text-cream-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400'
          }`}
        >
          <Icon size={16} aria-hidden />
        </button>
      );
    })}
  </div>
);
