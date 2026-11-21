import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, FilePlus2, FileText, SunMoon, Download, X } from 'lucide-react';
import type { Note } from '../types';
import { htmlToPlainText } from '../lib/markdown';

interface CommandPaletteProps {
  open: boolean;
  notes: Note[];
  onClose: () => void;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onCycleTheme: () => void;
  onExportBackup: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  notes,
  onClose,
  onSelectNote,
  onCreateNote,
  onCycleTheme,
  onExportBackup,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const noteItems = notes
      .filter((n) => {
        if (!q) return true;
        return (
          (n.title || 'Untitled Note').toLowerCase().includes(q) ||
          htmlToPlainText(n.content).toLowerCase().includes(q)
        );
      })
      .slice(0, 12)
      .map((n) => ({
        id: `note-${n.id}`,
        label: n.title || 'Untitled Note',
        sub: htmlToPlainText(n.content).slice(0, 70) || 'Empty note',
        kind: 'note' as const,
        run: () => {
          onSelectNote(n.id);
          onClose();
        },
      }));

    const actions = [
      {
        id: 'act-new',
        label: 'New note',
        sub: 'Create a blank note',
        kind: 'action' as const,
        Icon: FilePlus2,
        run: () => {
          onCreateNote();
          onClose();
        },
      },
      {
        id: 'act-theme',
        label: 'Cycle theme (Light / Dark / System)',
        sub: 'Switch appearance',
        kind: 'action' as const,
        Icon: SunMoon,
        run: () => {
          onCycleTheme();
          onClose();
        },
      },
      {
        id: 'act-backup',
        label: 'Export full JSON backup',
        sub: 'Download all notes and folders',
        kind: 'action' as const,
        Icon: Download,
        run: () => {
          onExportBackup();
          onClose();
        },
      },
    ].filter((a) => !q || a.label.toLowerCase().includes(q));

    return [...actions, ...noteItems];
  }, [notes, query, onSelectNote, onCreateNote, onCycleTheme, onExportBackup, onClose]);

  useEffect(() => {
    if (selectedIndex >= results.length) {
      setSelectedIndex(Math.max(0, results.length - 1));
    }
  }, [results.length, selectedIndex]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].run();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        onKeyDown={handleKeyDown}
        className="w-full max-w-lg rounded-2xl border border-cream-300 dark:border-navy-600 bg-cream-50 dark:bg-navy-900 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cream-300 dark:border-navy-600">
          <Search size={16} className="text-cream-400 dark:text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to note or run a command..."
            className="flex-1 bg-transparent text-sm text-cream-800 dark:text-white placeholder-cream-400 dark:placeholder-gray-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-md text-cream-400 dark:text-gray-500 hover:text-cream-700 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="py-8 text-center text-xs text-cream-500 dark:text-gray-400">
              No matching notes or commands
            </div>
          ) : (
            results.map((item, idx) => {
              const active = idx === selectedIndex;
              const Icon = item.kind === 'action' ? item.Icon : FileText;
              return (
                <button
                  key={item.id}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={item.run}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                    active
                      ? 'bg-cream-200 dark:bg-navy-800 text-cream-900 dark:text-white'
                      : 'text-cream-700 dark:text-gray-200 hover:bg-cream-100 dark:hover:bg-navy-800/60'
                  }`}
                >
                  <Icon
                    size={15}
                    className={`shrink-0 ${
                      item.kind === 'action'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-cream-400 dark:text-gray-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    <div className="text-[11px] text-cream-500 dark:text-gray-400 truncate">
                      {item.sub}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-cream-300 dark:border-navy-600 flex items-center justify-between text-[11px] text-cream-500 dark:text-gray-400">
          <span>↑↓ navigate · ↵ select · Esc close</span>
          <span>Ctrl+K</span>
        </div>
      </div>
    </div>
  );
};
