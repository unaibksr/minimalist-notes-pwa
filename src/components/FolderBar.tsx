import React, { useState, useRef, useEffect } from 'react';
import { FolderPlus, Pencil, Trash2, X, Check } from 'lucide-react';
import type { Folder, FolderFilter } from '../types';
import {
  FOLDER_COLOR_KEYS,
  folderColorClasses,
  normalizeFolderColor,
  pickFolderColor,
} from '../lib/folderColors';

interface FolderBarProps {
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

const chipBase =
  'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap';
const neutralChip =
  'border-cream-300 dark:border-navy-600 text-cream-600 dark:text-gray-300 hover:bg-cream-200 dark:hover:bg-navy-800';
const neutralActive =
  'bg-amber-600 border-amber-600 text-white dark:bg-amber-500 dark:border-amber-500 dark:text-amber-950';

export const FolderBar: React.FC<FolderBarProps> = ({
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

  const activeFolderObj = folders.find((f) => f.id === activeFolder);

  const startCreate = () => {
    setDraft('');
    setDraftColor(pickFolderColor(folders.map((f) => f.color)));
    setEditing({ mode: 'create' });
  };

  const startRename = () => {
    if (!activeFolderObj) return;
    setDraft(activeFolderObj.name);
    setDraftColor(normalizeFolderColor(activeFolderObj.color));
    setEditing({ mode: 'rename', id: activeFolderObj.id });
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

  const handleDelete = () => {
    if (!activeFolderObj) return;
    const ok = window.confirm(
      `Delete folder "${activeFolderObj.name}"? Notes inside will be kept and moved to Unfiled.`
    );
    if (ok) onDelete(activeFolderObj.id);
  };

  return (
    <div className="px-3 pt-3 pb-2.5 border-b border-cream-300 dark:border-navy-600">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-cream-500 dark:text-gray-400">
          Folders
        </span>
        <div className="flex items-center gap-0.5">
          {activeFolderObj && (
            <>
              <button
                onClick={startRename}
                className="p-1.5 rounded-md text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
                title="Rename folder"
                aria-label="Rename folder"
              >
                <Pencil size={13} aria-hidden="true" />
              </button>
              <button
                onClick={handleDelete}
                className="p-1.5 rounded-md text-cream-500 dark:text-gray-400 hover:text-red-500 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
                title="Delete folder"
                aria-label="Delete folder"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </>
          )}
          <button
            onClick={startCreate}
            className="p-1.5 rounded-md text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
            title="New folder"
            aria-label="New folder"
          >
            <FolderPlus size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
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
              className="flex-1 px-2 py-1.5 text-xs rounded-md bg-cream-100 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 text-cream-800 dark:text-white placeholder-cream-500 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
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
      ) : (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mb-1 folder-scroll">
          <button
            onClick={() => onSelect('all')}
            className={`${chipBase} ${activeFolder === 'all' ? neutralActive : neutralChip}`}
          >
            All
            <span className="opacity-70">{totalCount}</span>
          </button>

          <button
            onClick={() => onSelect('unfiled')}
            className={`${chipBase} ${activeFolder === 'unfiled' ? neutralActive : neutralChip}`}
          >
            Unfiled
            <span className="opacity-70">{unfiledCount}</span>
          </button>

          {folders.map((folder) => {
            const active = activeFolder === folder.id;
            const colors = folderColorClasses(folder.color);
            return (
              <button
                key={folder.id}
                onClick={() => onSelect(folder.id)}
                onDoubleClick={() => {
                  setDraft(folder.name);
                  setDraftColor(folder.color ?? 'amber');
                  setEditing({ mode: 'rename', id: folder.id });
                }}
                className={`${chipBase} max-w-[11rem] ${active ? colors.active : neutralChip}`}
                title={`${folder.name} — double-click to rename`}
              >
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    active ? 'bg-white/80' : colors.dot
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{folder.name}</span>
                <span className="opacity-70">{countsByFolder[folder.id] || 0}</span>
              </button>
            );
          })}

          {folders.length === 0 && (
            <button
              onClick={startCreate}
              className={`${chipBase} border-dashed border-cream-400 dark:border-navy-600 text-cream-500 dark:text-gray-400 hover:bg-cream-200 dark:hover:bg-navy-800`}
            >
              <FolderPlus size={12} aria-hidden="true" />
              New folder
            </button>
          )}
        </div>
      )}
    </div>
  );
};
