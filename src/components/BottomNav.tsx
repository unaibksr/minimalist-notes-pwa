import React from 'react';
import { NotebookPen, Plus, Sun, Moon, Monitor } from 'lucide-react';
import type { ThemeMode } from '../lib/useTheme';

interface BottomNavProps {
  onNotes: () => void;
  onNewNote: () => void;
  themeMode: ThemeMode;
  onCycleTheme: () => void;
}

const ThemeIcon: React.FC<{ mode: ThemeMode }> = ({ mode }) =>
  mode === 'light' ? <Sun size={20} aria-hidden /> : mode === 'dark' ? <Moon size={20} aria-hidden /> : <Monitor size={20} aria-hidden />;

export const BottomNav: React.FC<BottomNavProps> = ({
  onNotes,
  onNewNote,
  themeMode,
  onCycleTheme,
}) => (
  <nav
    aria-label="Primary"
    className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-cream-300 dark:border-navy-700 bg-cream-50/95 dark:bg-navy-900/95 backdrop-blur"
  >
    <div className="flex items-stretch justify-around">
      <button
        onClick={onNotes}
        className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[52px] py-2 px-3 text-[10px] font-medium text-cream-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 transition-transform"
        aria-label="Go to notes list"
      >
        <NotebookPen size={20} aria-hidden />
        <span>Notes</span>
      </button>
      <button
        onClick={onNewNote}
        className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[52px] py-2 px-3 text-[10px] font-medium text-cream-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 transition-transform"
        aria-label="New note"
      >
        <Plus size={22} aria-hidden />
        <span>New</span>
      </button>
      <button
        onClick={onCycleTheme}
        className="flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[52px] py-2 px-3 text-[10px] font-medium text-cream-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 active:scale-95 transition-transform"
        aria-label={`Theme: ${themeMode}. Tap to change`}
      >
        <ThemeIcon mode={themeMode} />
        <span className="capitalize">{themeMode}</span>
      </button>
    </div>
  </nav>
);
