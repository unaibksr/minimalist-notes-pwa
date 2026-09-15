import React, { useState, useRef, useEffect } from 'react';
import { FolderPlus, Pencil, Trash2, X, Check, Inbox } from 'lucide-react';
import type { Folder, FolderFilter } from '../types';
import {
  FOLDER_COLOR_KEYS,
  folderColorClasses,
  normalizeFolderColor,
  pickFolderColor,
} from '../lib/folderColors';

interface FolderGridProps {
  folders: Folder[];
  activeFolder: FolderFilter;
  totalCount: number;
  unfiledCount: number;
  countsByFolder: Record<string, number>;
  onSelect: (folder: FolderFilter) => void;
  onCreate: (name: string, color: string) => void;
  onRename: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
}

type Editing = { mode: 'create' } | { mode: 'rename'; id: string } | null;

const baseCard =
  'group relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all cursor-pointer';
const idleCard =
  'bg-white dark:bg-navy-900/60 border-cream-200 dark:border-navy-800 hover:-translate-y-0.5 hover:shadow-md hover:border-cream-300 dark:hover:border-navy-700';
const activeCard =
  'bg-white dark:bg-navy-800 border-amber-500 ring-2 ring-amber-500/40 shadow-sm';

export const FolderGrid: React.FC<FolderGridProps> = ({
  folders,
  activeFolder,
  totalCount,
  unfiledCount,
  countsByFolder,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) => {
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState('');
  const [draftColor, setDraftColor] = useState<string>('amber');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startCreate = () => {
    setDraft('');
    setDraftColor(pickFolderColor(folders.map((f) => f.color)));
    setEditing({ mode: 'create' });
  };

  const startRename = (folder: Folder) => {
    setDraft(folder.name);
    setDraftColor(normalizeFolderColor(folder.color));
    setEditing({ mode: 'rename', id: folder.id });
  };

  const commit = () => {
    const name = draft.trim();
    if (!name) {
      setEditing(null);
      return;
    }
    if (editing?.mode === 'create') {
      onCreate(name, draftColor);
    } else if (editing?.mode === 'rename') {
      onRename(editing.id, name, draftColor);
    }
    setEditing(null);
  };

  const cancel = () => setEditing(null);

  const handleDelete = (folder: Folder) => {
    const ok = window.confirm(
      `Delete folder "${folder.name}"? Notes inside will be kept and moved to Unfiled.`
    );
    if (ok) onDelete(folder.id);
  };

  if (editing) {
    return (
      <div className="rounded-xl border border-cream-300 dark:border-navy-600 bg-cream-50 dark:bg-navy-900 p-3 flex flex-col gap-3">
        <div className="flex items-center gap-1">
          <span
            className={`w-3 h-3 rounded-full shrink-0 ml-0.5 ${folderColorClasses(draftColor).dot}`}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') cancel();
            }}
            placeholder="Folder name"
            aria-label="Folder name"
            className="flex-1 px-2 py-1.5 text-xs rounded-md bg-white dark:bg-navy-950 border border-cream-300 dark:border-navy-600 text-cream-800 dark:text-white placeholder-cream-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
          />
          <button
            onClick={commit}
            className="p-1.5 rounded-md text-green-600 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
            title="Save"
            aria-label="Save folder"
          >
            <Check size={14} aria-hidden="true" />
          </button>
          <button
            onClick={cancel}
            className="p-1.5 rounded-md text-cream-500 dark:text-gray-400 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
            title="Cancel"
            aria-label="Cancel"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap pl-0.5">
          {FOLDER_COLOR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setDraftColor(key)}
              className={`w-5 h-5 rounded-full ${folderColorClasses(key).dot} transition-transform ${
                draftColor === key
                  ? 'ring-2 ring-offset-2 ring-offset-cream-50 dark:ring-offset-navy-950 ring-cream-500 dark:ring-gray-300 scale-110'
                  : 'hover:scale-110'
              }`}
              title={key}
              aria-label={`Colour ${key}`}
              aria-pressed={draftColor === key}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
      <button
        onClick={() => onSelect('all')}
        className={`${baseCard} ${activeFolder === 'all' ? activeCard : idleCard}`}
      >
        <div className="flex items-center gap-1.5 w-full">
          <Inbox size={14} className="text-cream-500 dark:text-gray-400" aria-hidden="true" />
          <span className="font-medium text-sm text-cream-800 dark:text-white truncate">All Notes</span>
        </div>
        <span className="text-xs text-cream-500 dark:text-gray-400">{totalCount}</span>
      </button>

      <button
        onClick={() => onSelect('unfiled')}
        className={`${baseCard} ${activeFolder === 'unfiled' ? activeCard : idleCard}`}
      >
        <div className="flex items-center gap-1.5 w-full">
          <span className="w-2.5 h-2.5 rounded-full bg-cream-400 dark:bg-gray-500" aria-hidden="true" />
          <span className="font-medium text-sm text-cream-800 dark:text-white truncate">Unfiled</span>
        </div>
        <span className="text-xs text-cream-500 dark:text-gray-400">{unfiledCount}</span>
      </button>

      {folders.map((folder) => {
        const active = activeFolder === folder.id;
        const colors = folderColorClasses(folder.color);
        return (
          <div
            key={folder.id}
            className={`${baseCard} ${active ? activeCard : idleCard}`}
            onClick={() => onSelect(folder.id)}
            onDoubleClick={() => startRename(folder)}
          >
            <div className="flex items-center gap-1.5 w-full">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors.dot}`}
                aria-hidden="true"
              />
              <span className="font-medium text-sm text-cream-800 dark:text-white truncate flex-1">
                {folder.name}
              </span>
            </div>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-cream-500 dark:text-gray-400">
                {countsByFolder[folder.id] || 0}
              </span>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    startRename(folder);
                  }}
                  className="p-1 rounded text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
                  title="Rename folder"
                  aria-label={`Rename ${folder.name}`}
                >
                  <Pencil size={12} aria-hidden="true" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(folder);
                  }}
                  className="p-1 rounded text-cream-500 dark:text-gray-400 hover:text-red-500 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
                  title="Delete folder"
                  aria-label={`Delete ${folder.name}`}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {folders.length === 0 ? (
        <button
          onClick={startCreate}
          className={`col-span-full ${baseCard} ${idleCard} border-dashed items-center justify-center text-cream-500 dark:text-gray-400 hover:bg-cream-100 dark:hover:bg-navy-800/60`}
        >
          <FolderPlus size={16} aria-hidden="true" />
          <span className="text-xs font-medium">Create your first folder</span>
        </button>
      ) : (
        <button
          onClick={startCreate}
          className={`${baseCard} ${idleCard} border-dashed items-center justify-center text-cream-500 dark:text-gray-400 hover:bg-cream-100 dark:hover:bg-navy-800/60`}
          title="New folder"
          aria-label="New folder"
        >
          <FolderPlus size={16} aria-hidden="true" />
          <span className="text-xs font-medium">New</span>
        </button>
      )}
    </div>
  );
};
