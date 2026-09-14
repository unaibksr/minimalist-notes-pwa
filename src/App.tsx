import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Note, Folder, Theme, FolderFilter } from './types';
import {
  getNotesFromIDBForUI,
  saveNoteToIDB,
  deleteNoteFromIDB,
  saveFolderToIDB,
  deleteFolderFromIDB,
  getFoldersFromIDBForUI,
} from './lib/db';
import {
  supabase,
  syncWithSupabase,
  subscribeToRealtime,
  detectSupabaseCapabilities,
} from './lib/supabase';
import { RichEditor } from './components/RichEditor';
import { FolderBar } from './components/FolderBar';
import {
  Search,
  Plus,
  Trash2,
  Moon,
  Sun,
  Check,
  RefreshCw,
  Copy,
  Download,
  Share2,
  Folder as FolderIcon,
  X,
  FilePlus2,
  Inbox,
} from 'lucide-react';

const isMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const filterNotes = (list: Note[], activeFolder: FolderFilter, query: string) => {
  const q = query.trim().toLowerCase();
  return list.filter((n) => {
    const inFolder =
      activeFolder === 'all'
        ? true
        : activeFolder === 'unfiled'
        ? !n.folderId
        : n.folderId === activeFolder;
    if (!inFolder) return false;
    if (!q) return true;
    return (
      n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  });
};

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(isMobileViewport());

  const touchStartX = useRef<number>(0);
  const mainTouchStartX = useRef<number>(0);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const localNotes = await getNotesFromIDBForUI();
      const localFolders = await getFoldersFromIDBForUI();
      if (cancelled) return;
      setNotes(localNotes);
      setFolders(localFolders);
      const mobile = isMobileViewport();
      if (!mobile && localNotes.length > 0) setActiveNoteId(localNotes[0].id);

      const result = await syncWithSupabase();
      if (cancelled) return;
      setNotes(result.notes);
      setFolders(result.folders);
      if (!mobile && result.notes.length > 0) {
        setActiveNoteId((prev) => prev ?? result.notes[0].id);
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNoteChange = useCallback(
    (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new?: Record<string, any>;
      old?: Record<string, any>;
    }) => {
      const { eventType, new: newData, old: oldData } = payload;
      if (eventType === 'INSERT' && newData) {
        const note: Note = {
          id: newData.id,
          title: newData.title,
          content: newData.content,
          updatedAt: newData.updated_at,
          synced: true,
          folderId: newData.folder_id ?? null,
        };
        setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [note, ...prev]));
      } else if (eventType === 'UPDATE' && newData) {
        const updated: Note = {
          id: newData.id,
          title: newData.title,
          content: newData.content,
          updatedAt: newData.updated_at,
          synced: true,
          folderId: newData.folder_id ?? null,
        };
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      } else if (eventType === 'DELETE' && oldData) {
        setNotes((prev) => prev.filter((n) => n.id !== oldData.id));
      }
    },
    []
  );

  const handleFolderChange = useCallback(
    (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new?: Record<string, any>;
      old?: Record<string, any>;
    }) => {
      const { eventType, new: newData, old: oldData } = payload;
      if (eventType === 'INSERT' && newData) {
        const folder: Folder = {
          id: newData.id,
          name: newData.name,
          updatedAt: newData.updated_at,
          synced: true,
        };
        setFolders((prev) =>
          prev.some((f) => f.id === folder.id) ? prev : [folder, ...prev]
        );
      } else if (eventType === 'UPDATE' && newData) {
        const updated: Folder = {
          id: newData.id,
          name: newData.name,
          updatedAt: newData.updated_at,
          synced: true,
        };
        setFolders((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
      } else if (eventType === 'DELETE' && oldData) {
        setFolders((prev) => prev.filter((f) => f.id !== oldData.id));
        setActiveFolder((prev) => (prev === oldData.id ? 'all' : prev));
      }
    },
    []
  );

  useEffect(() => {
    let unsubscribe = () => {};
    (async () => {
      if (!supabase) return;
      const caps = await detectSupabaseCapabilities();
      unsubscribe = subscribeToRealtime(
        supabase,
        { onNote: handleNoteChange, onFolder: handleFolderChange },
        { folders: caps.foldersTable }
      );
    })();
    return () => unsubscribe();
  }, [handleNoteChange, handleFolderChange]);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  const countsByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of notes) {
      const key = n.folderId || 'unfiled';
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [notes]);

  const visibleNotes = useMemo(
    () => filterNotes(notes, activeFolder, searchQuery),
    [notes, activeFolder, searchQuery]
  );

  const folderNameOf = useCallback(
    (note: Note) => folders.find((f) => f.id === note.folderId)?.name ?? null,
    [folders]
  );

  useEffect(() => {
    if (!activeNoteId) return;
    if (!visibleNotes.some((n) => n.id === activeNoteId)) {
      const next = !isMobile && visibleNotes.length > 0 ? visibleNotes[0].id : null;
      setActiveNoteId(next);
    }
  }, [visibleNotes, activeNoteId, isMobile]);

  const runSync = useCallback(async () => {
    const result = await syncWithSupabase();
    setNotes(result.notes);
    setFolders(result.folders);
  }, []);

  const handleBackToList = () => {
    setActiveNoteId(null);
    runSync();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Share link copied');
    } catch {
      showToast('Could not copy link');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
    showToast('Synced');
  };

  const handleSelectFolder = (folder: FolderFilter) => {
    setActiveFolder(folder);
    if (folder !== 'all') setSearchQuery('');
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(
      regex,
      '<mark class="bg-amber-200 dark:bg-amber-900/40 text-cream-800 dark:text-amber-200 rounded px-0.5">$1</mark>'
    );
  };

  const getPreviewText = (note: Note) => {
    const text = note.content.replace(/<[^>]*>/g, '').trim();
    return text || 'No additional text';
  };

  const handleUpdateNote = (field: 'title' | 'content', value: string) => {
    if (!activeNoteId) return;
    setSaveStatus('saving');

    setNotes((prev) =>
      prev.map((note) =>
        note.id === activeNoteId
          ? { ...note, [field]: value, updatedAt: Date.now(), synced: false }
          : note
      )
    );

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      const currentNotes = await getNotesFromIDBForUI();
      const updated = currentNotes.find((n) => n.id === activeNoteId);
      if (updated) {
        await saveNoteToIDB({
          ...updated,
          [field]: value,
          updatedAt: Date.now(),
          synced: false,
        });
        setSaveStatus('saved');
        runSync();
      }
    }, 900);
  };

  const createNewNote = async () => {
    const folderId =
      activeFolder !== 'all' && activeFolder !== 'unfiled' ? activeFolder : null;
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '<p></p>',
      updatedAt: Date.now(),
      synced: false,
      folderId,
    };
    await saveNoteToIDB(newNote);
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    runSync();
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNoteFromIDB(id);
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (activeNoteId === id) {
      const visible = filterNotes(remaining, activeFolder, searchQuery);
      setActiveNoteId(visible.length > 0 ? visible[0].id : null);
    }
    runSync();
  };

  const handleMoveNote = async (folderId: string | null) => {
    if (!activeNoteId) return;
    const now = Date.now();
    setSaveStatus('saving');
    setNotes((prev) =>
      prev.map((n) =>
        n.id === activeNoteId ? { ...n, folderId, updatedAt: now, synced: false } : n
      )
    );
    const currentNotes = await getNotesFromIDBForUI();
    const note = currentNotes.find((n) => n.id === activeNoteId);
    if (note) {
      await saveNoteToIDB({ ...note, folderId, updatedAt: now, synced: false });
    }
    setSaveStatus('saved');
    showToast(folderId ? 'Note moved' : 'Note moved to Unfiled');
    runSync();
  };

  const handleCreateFolder = async (name: string) => {
    const folder: Folder = {
      id: crypto.randomUUID(),
      name,
      updatedAt: Date.now(),
      synced: false,
    };
    await saveFolderToIDB(folder);
    setFolders((prev) => [folder, ...prev]);
    setActiveFolder(folder.id);
    setSearchQuery('');
    showToast(`Folder "${name}" created`);
    runSync();
  };

  const handleRenameFolder = async (id: string, name: string) => {
    const folder = folders.find((f) => f.id === id);
    if (!folder) return;
    const updated = { ...folder, name, updatedAt: Date.now(), synced: false };
    setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
    await saveFolderToIDB(updated);
    showToast('Folder renamed');
    runSync();
  };

  const handleDeleteFolder = async (id: string) => {
    const name = folders.find((f) => f.id === id)?.name ?? 'Folder';
    await deleteFolderFromIDB(id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.folderId === id ? { ...n, folderId: null } : n))
    );
    setActiveFolder('all');
    showToast(`Folder "${name}" deleted`);
    runSync();
  };

  const handleCopyNote = async () => {
    if (!activeNote) return;
    const text = activeNote.content.replace(/<[^>]*>/g, '');
    try {
      await navigator.clipboard.writeText(text);
      showToast('Note copied');
    } catch {
      showToast('Could not copy note');
    }
  };

  const handleExportMarkdown = () => {
    if (!activeNote) return;
    const title = activeNote.title || 'Untitled Note';
    const text = activeNote.content.replace(/<[^>]*>/g, '');
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported as Markdown');
  };

  const totalCount = notes.length;
  const unfiledCount = countsByFolder['unfiled'] || 0;
  const activeFolderLabel =
    activeFolder === 'all'
      ? 'All Notes'
      : activeFolder === 'unfiled'
      ? 'Unfiled'
      : folders.find((f) => f.id === activeFolder)?.name ?? 'Folder';

  const iconBtn =
    'p-2 rounded-lg text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors';

  return (
    <div className="h-screen overflow-hidden bg-cream-50 dark:bg-navy-950 text-cream-800 dark:text-white flex flex-col md:flex-row">
      <aside
        className={`w-full md:w-80 shrink-0 min-h-0 border-r border-cream-300 dark:border-navy-600 flex flex-col h-screen ${
          activeNoteId ? 'hidden md:flex' : ''
        }`}
      >
        <header className="px-4 py-3 border-b border-cream-300 dark:border-navy-600 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-amber-700 dark:text-amber-400">
            Notes
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={iconBtn}
              title="Toggle theme"
            >
              {theme === 'light' ? (
                <Moon size={18} className="text-amber-600 dark:text-amber-400" />
              ) : (
                <Sun size={18} className="text-amber-600 dark:text-amber-400" />
              )}
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`${iconBtn} disabled:opacity-50`}
              title="Refresh / sync"
            >
              <RefreshCw
                size={18}
                className={`text-amber-600 dark:text-amber-400 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={createNewNote}
              className="p-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-600 transition-colors"
              title="New note"
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        <div className="px-3 py-2.5">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-400 dark:text-gray-500"
              size={15}
            />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-cream-100 dark:bg-navy-900 rounded-lg border border-transparent focus:border-amber-400 focus:bg-cream-50 dark:focus:bg-navy-950 focus:outline-none text-cream-800 dark:text-white placeholder-cream-500 dark:placeholder-gray-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-cream-400 dark:text-gray-500 hover:text-cream-700 dark:hover:text-gray-200"
                title="Clear search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <FolderBar
          folders={folders}
          activeFolder={activeFolder}
          totalCount={totalCount}
          unfiledCount={unfiledCount}
          countsByFolder={countsByFolder}
          onSelect={handleSelectFolder}
          onCreate={handleCreateFolder}
          onRename={handleRenameFolder}
          onDelete={handleDeleteFolder}
        />

        <div className="flex-1 min-h-0 overflow-y-auto py-1">
          {visibleNotes.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Inbox size={26} className="mx-auto mb-3 text-cream-300 dark:text-navy-600" />
              <p className="text-sm font-medium text-cream-600 dark:text-gray-300">
                {searchQuery
                  ? 'No matching notes'
                  : activeFolder === 'unfiled'
                  ? 'Nothing unfiled'
                  : 'No notes here yet'}
              </p>
              <p className="text-xs text-cream-400 dark:text-gray-500 mt-1">
                {searchQuery
                  ? 'Try a different search term.'
                  : `Create a note in ${activeFolderLabel}.`}
              </p>
              {!searchQuery && (
                <button
                  onClick={createNewNote}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-600 transition-colors"
                >
                  <FilePlus2 size={13} />
                  New note
                </button>
              )}
            </div>
          ) : (
            visibleNotes.map((note) => {
              const folderName = folderNameOf(note);
              const active = activeNoteId === note.id;
              return (
                <div
                  key={note.id}
                  onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
                  onTouchEnd={(e) => {
                    const diffX = touchStartX.current - e.changedTouches[0].clientX;
                    if (diffX > 80) handleDeleteNote(note.id);
                  }}
                  onClick={() => setActiveNoteId(note.id)}
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
                        dangerouslySetInnerHTML={{
                          __html: highlightText(note.title || 'Untitled Note', searchQuery),
                        }}
                      />
                      <p
                        className="text-xs text-cream-500 dark:text-gray-400 truncate mt-0.5"
                        dangerouslySetInnerHTML={{
                          __html: highlightText(getPreviewText(note), searchQuery),
                        }}
                      />
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-cream-400 dark:text-gray-500">
                          {formatDate(note.updatedAt)}
                        </span>
                        {activeFolder === 'all' && folderName && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 dark:bg-navy-700 text-cream-600 dark:text-gray-300 max-w-[8rem]">
                            <FolderIcon size={9} className="shrink-0" />
                            <span className="truncate">{folderName}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-cream-400 dark:text-gray-500 hover:text-red-500 transition-opacity"
                      title="Delete note"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 border-t border-cream-300 dark:border-navy-600">
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-cream-100 dark:bg-navy-900 border border-cream-300 dark:border-navy-700 text-cream-600 dark:text-gray-300 px-2 py-2 rounded-lg hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
          >
            <Share2 size={13} />
            Copy share link
          </button>
        </div>
      </aside>

      <main
        className={`flex-1 min-h-0 flex flex-col h-screen overflow-hidden ${
          !activeNoteId ? 'hidden md:flex' : ''
        }`}
      >
        {activeNote ? (
          <div
            className="flex-1 min-h-0 flex flex-col max-w-full"
            onTouchStart={(e) => {
              mainTouchStartX.current = e.touches[0].clientX;
            }}
            onTouchEnd={(e) => {
              const diffX = mainTouchStartX.current - e.changedTouches[0].clientX;
              if (diffX > 80 && isMobile) handleBackToList();
            }}
          >
            <div className="px-4 md:px-12 pt-4 md:pt-8 shrink-0">
            <div
              className={`flex flex-wrap items-center gap-2 justify-between pb-3 mb-4 border-b border-cream-300 dark:border-navy-600 ${
                isFullscreen ? 'hidden' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToList}
                  className="md:hidden text-sm text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                >
                  ← Back
                </button>
                {!isMobile && (
                  <button
                    onClick={() => setIsFullscreen(true)}
                    className="text-sm text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    title="Enter fullscreen reading"
                  >
                    📖 Reading Mode
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {folders.length > 0 && (
                  <div className="relative">
                    <FolderIcon
                      size={13}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-cream-400 dark:text-gray-500 pointer-events-none"
                    />
                    <select
                      value={activeNote.folderId || ''}
                      onChange={(e) => handleMoveNote(e.target.value || null)}
                      className="appearance-none pl-7 pr-6 py-1 text-xs rounded-md bg-cream-200 dark:bg-navy-800 text-cream-700 dark:text-gray-200 border border-cream-300 dark:border-navy-600 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                      title="Move note to folder"
                    >
                      <option value="">Unfiled</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={handleShare}
                  className="hidden md:flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                  title="Copy share link"
                >
                  <Share2 size={14} />
                  Share
                </button>
                <button
                  onClick={handleCopyNote}
                  className="hidden md:flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                  title="Copy note text"
                >
                  <Copy size={14} />
                  Copy
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="hidden md:flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                  title="Export as Markdown"
                >
                  <Download size={14} />
                  Export
                </button>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1 rounded-md text-cream-500 dark:text-gray-400 hover:bg-cream-200 dark:hover:bg-navy-800 disabled:opacity-50 transition-colors"
                  title="Refresh / sync"
                >
                  <RefreshCw
                    size={14}
                    className={`text-cream-500 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
                  />
                </button>
                <div className="flex items-center gap-1 text-xs text-cream-400 dark:text-gray-500">
                  {saveStatus === 'saving' ? (
                    <>
                      <RefreshCw className="animate-spin" size={12} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="text-green-500" size={12} />
                      <span>Saved</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {!isFullscreen && (
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleUpdateNote('title', e.target.value)}
                placeholder="Note Title"
                className="text-2xl md:text-3xl font-bold bg-transparent border-none outline-none mb-3 w-full text-cream-800 dark:text-white placeholder-cream-400 dark:placeholder-gray-600"
              />
            )}

            </div>

            <RichEditor
              content={activeNote.content}
              onChange={(val) => handleUpdateNote('content', val)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
              onExportMarkdown={handleExportMarkdown}
              onCopyNote={handleCopyNote}
            />
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-4">
              <div className="text-6xl mb-4">📝</div>
              <h2 className="text-xl font-semibold text-cream-700 dark:text-white mb-2">
                {totalCount === 0 ? 'Start your first note' : 'No note selected'}
              </h2>
              <p className="text-sm text-cream-500 dark:text-gray-400 mb-6">
                {totalCount === 0
                  ? 'Create a note, organise it into folders, and everything is saved automatically and synced in real time.'
                  : 'Pick a note from the list, or create a new one to start writing.'}
              </p>
              <button
                onClick={createNewNote}
                className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:text-amber-950 dark:hover:bg-amber-600 transition-colors"
              >
                <FilePlus2 size={16} />
                New note
              </button>
              <div className="flex flex-col gap-2 text-xs text-cream-400 dark:text-gray-500 mt-8">
                <p>
                  <kbd className="px-1.5 py-0.5 bg-cream-200 dark:bg-navy-800 rounded text-cream-600 dark:text-gray-300">
                    Ctrl
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 bg-cream-200 dark:bg-navy-800 rounded text-cream-600 dark:text-gray-300">
                    B
                  </kbd>{' '}
                  Bold
                </p>
                <p>
                  <kbd className="px-1.5 py-0.5 bg-cream-200 dark:bg-navy-800 rounded text-cream-600 dark:text-gray-300">
                    Ctrl
                  </kbd>{' '}
                  +{' '}
                  <kbd className="px-1.5 py-0.5 bg-cream-200 dark:bg-navy-800 rounded text-cream-600 dark:text-gray-300">
                    I
                  </kbd>{' '}
                  Italic
                </p>
                <p>
                  <kbd className="px-1.5 py-0.5 bg-cream-200 dark:bg-navy-800 rounded text-cream-600 dark:text-gray-300">
                    Esc
                  </kbd>{' '}
                  Exit fullscreen
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full text-sm font-medium bg-cream-800 text-cream-50 dark:bg-cream-100 dark:text-cream-900 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;
