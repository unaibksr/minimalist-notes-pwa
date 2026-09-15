import React, { useCallback, useMemo } from 'react';
import { Trash2, Pin, PinOff } from 'lucide-react';
import type { Note } from '../types';
import { highlightText } from '../lib/highlight';
import { htmlToPlainText } from '../lib/markdown';
import { folderColorClasses } from '../lib/folderColors';
import { useSwipe } from '../lib/useSwipe';

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

interface NoteItemProps {
  note: Note;
  active: boolean;
  searchQuery: string;
  showFolderBadge: boolean;
  folderName: string | null;
  folderColor?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onTogglePin?: (id: string) => void;
}

export const NoteItem = React.memo(function NoteItem({
  note,
  active,
  searchQuery,
  showFolderBadge,
  folderName,
  folderColor,
  onSelect,
  onDelete,
  onTogglePin,
}: NoteItemProps) {
  // Mobile gesture: a deliberate swipe left on a note deletes it (undoable).
  const swipeHandlers = useSwipe({
    threshold: 80,
    onSwipe: useCallback(
      (direction) => {
        if (direction === 'left') onDelete(note.id);
      },
      [onDelete, note.id]
    ),
  });

  const preview = useMemo(() => {
    const text = htmlToPlainText(note.content).slice(0, 160);
    return text || 'No additional text';
  }, [note.content]);

  const titleHtml = useMemo(
    () => highlightText(note.title || 'Untitled Note', searchQuery),
    [note.title, searchQuery]
  );
  const previewHtml = useMemo(
    () => highlightText(preview, searchQuery),
    [preview, searchQuery]
  );

  return (
    <div
      {...swipeHandlers}
      onClick={() => onSelect(note.id)}
      className={`mx-2 my-1.5 px-3 py-2.5 rounded-xl cursor-pointer group relative border transition-all duration-150 ${
        active
          ? 'bg-white dark:bg-navy-800 border-primary-500/50 ring-1 ring-primary-500/30 shadow-sm'
          : 'bg-white dark:bg-navy-900/60 border-cream-200 dark:border-navy-800 hover:-translate-y-0.5 hover:shadow-md hover:border-cream-300 dark:hover:border-navy-700'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {note.pinned && (
              <Pin
                size={11}
                aria-label="Pinned"
                className="text-primary-600 dark:text-primary-400 fill-primary-600 dark:fill-primary-400 shrink-0"
              />
            )}
            <h3
              className="font-semibold text-sm truncate text-cream-800 dark:text-white"
              dangerouslySetInnerHTML={{ __html: titleHtml }}
            />
          </div>
          <p
            className="text-xs text-cream-500 dark:text-gray-400 truncate mt-0.5"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] text-cream-400 dark:text-gray-500">
              {formatDate(note.updatedAt)}
            </span>
            {showFolderBadge && folderName && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 dark:bg-navy-700 text-cream-600 dark:text-gray-300 max-w-[8rem]">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${folderColorClasses(folderColor).dot}`}
                  aria-hidden="true"
                />
                <span className="truncate">{folderName}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {onTogglePin && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(note.id);
              }}
              className="p-1 rounded text-cream-400 dark:text-gray-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              title={note.pinned ? 'Unpin' : 'Pin'}
              aria-label={note.pinned ? `Unpin ${note.title || 'Untitled Note'}` : `Pin ${note.title || 'Untitled Note'}`}
              aria-pressed={!!note.pinned}
            >
              {note.pinned ? <PinOff size={15} aria-hidden="true" /> : <Pin size={15} aria-hidden="true" />}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(note.id);
            }}
            className="p-1 rounded text-cream-400 dark:text-gray-500 hover:text-red-500 transition-colors"
            title="Delete note"
            aria-label={`Delete note ${note.title || 'Untitled Note'}`}
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
});
