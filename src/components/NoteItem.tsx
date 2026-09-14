import React, { useMemo, useRef } from 'react';
import { Trash2, Folder as FolderIcon } from 'lucide-react';
import type { Note } from '../types';
import { highlightText } from '../lib/highlight';
import { htmlToPlainText } from '../lib/markdown';

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
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export const NoteItem = React.memo(function NoteItem({
  note,
  active,
  searchQuery,
  showFolderBadge,
  folderName,
  onSelect,
  onDelete,
}: NoteItemProps) {
  const touchStartX = useRef(0);

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
      onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchStartX.current - e.changedTouches[0].clientX > 80) onDelete(note.id);
      }}
      onClick={() => onSelect(note.id)}
      className={`mx-2 my-1 px-3 py-2.5 rounded-xl cursor-pointer group relative transition-colors ${
        active
          ? 'bg-cream-200 dark:bg-navy-800 ring-1 ring-amber-500/40'
          : 'hover:bg-cream-100 dark:hover:bg-navy-800/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3
            className="font-semibold text-sm truncate text-cream-800 dark:text-white"
            dangerouslySetInnerHTML={{ __html: titleHtml }}
          />
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
                <FolderIcon size={9} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{folderName}</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded text-cream-400 dark:text-gray-500 hover:text-red-500 transition-opacity"
          title="Delete note"
          aria-label={`Delete note ${note.title || 'Untitled Note'}`}
        >
          <Trash2 size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});
