import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Note, Folder, FolderFilter } from './types';
import {
  getNotesFromIDBForUI,
  saveNoteToIDB,
  deleteNoteFromIDB,
  saveFolderToIDB,
  saveFoldersToIDB,
  deleteFolderFromIDB,
  getFoldersFromIDBForUI,
} from './lib/db';
import {
  supabase,
  syncWithSupabase,
  subscribeToRealtime,
  detectSupabaseCapabilities,
} from './lib/supabase';
import { htmlToMarkdown, htmlToPlainText } from './lib/markdown';
import { folderColorClasses, pickFolderColor } from './lib/folderColors';
import { useTheme } from './lib/useTheme';
import { useSwipe } from './lib/useSwipe';
import { RichEditor } from './components/RichEditor';
import { FolderGrid } from './components/FolderGrid';
import { NoteItem } from './components/NoteItem';
import { ThemeToggle } from './components/ThemeToggle';
import { BottomNav } from './components/BottomNav';
import {
  Search,
  Plus,
  RefreshCw,
  Copy,
  CopyPlus,
  Download,
  Share2,
  Folder as FolderIcon,
  X,
  FilePlus2,
  Inbox,
  WifiOff,
  NotebookPen,
  Folders,
  ChevronRight,
} from 'lucide-react';

const isMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;

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
    if (n.title.toLowerCase().includes(q)) return true;
    // Content is HTML; compare against the visible text only.
    return htmlToPlainText(n.content).toLowerCase().includes(q);
  });
};

interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Assigns a distinct palette colour to any folder that does not have one yet. */
const ensureFolderColors = (list: Folder[]): { next: Folder[]; changed: Folder[] } => {
  const used: Array<string | undefined> = list.map((f) => f.color);
  const changed: Folder[] = [];
  const next = list.map((f) => {
    if (f.color) return f;
    const color = pickFolderColor(used);
    used.push(color);
    const updated: Folder = { ...f, color, synced: false, updatedAt: Date.now() };
    changed.push(updated);
    return updated;
  });
  return { next, changed };
};

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderFilter>('all');
  const [sidebarTab, setSidebarTab] = useState<'notes' | 'folders'>('notes');
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const { mode: themeMode, setMode: setThemeMode, cycleMode: cycleThemeMode } = useTheme();
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMobile, setIsMobile] = useState(isMobileViewport());

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyMenuRef = useRef<HTMLDivElement>(null);
  const [copyMenuOpen, setCopyMenuOpen] = useState(false);
  const notesRef = useRef<Note[]>([]);
  const activeNoteIdRef = useRef<string | null>(null);
  const syncRunning = useRef(false);
  const syncPending = useRef(false);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  useEffect(() => {
    activeNoteIdRef.current = activeNoteId;
  }, [activeNoteId]);

  const showToast = useCallback(
    (message: string, opts?: { actionLabel?: string; onAction?: () => void; duration?: number }) => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
      const duration = opts?.duration ?? 1800;
      setToast({ message, actionLabel: opts?.actionLabel, onAction: opts?.onAction });
      toastTimer.current = window.setTimeout(() => setToast(null), duration);
    },
    []
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!copyMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (copyMenuRef.current && !copyMenuRef.current.contains(e.target as Node)) {
        setCopyMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCopyMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [copyMenuOpen]);

  /**
   * Serialised sync: only one sync runs at a time. If more syncs are requested
   * while one is in flight, they are coalesced into a single trailing sync so we
   * can never interleave pulls/writes or clobber newer state.
   */
  const runSync = useCallback(async () => {
    if (!supabase) {
      const localNotes = await getNotesFromIDBForUI();
      const localFolders = await getFoldersFromIDBForUI();
      const { next, changed } = ensureFolderColors(localFolders);
      if (changed.length) await saveFoldersToIDB(changed);
      setNotes(localNotes);
      setFolders(next);
      return;
    }
    if (syncRunning.current) {
      syncPending.current = true;
      return;
    }
    syncRunning.current = true;
    try {
      do {
        syncPending.current = false;
        const result = await syncWithSupabase();
        const { next, changed } = ensureFolderColors(result.folders);
        if (changed.length) {
          saveFoldersToIDB(changed);
          syncPending.current = true;
        }
        setNotes(result.notes);
        setFolders(next);
      } while (syncPending.current);
    } catch (err) {
      console.warn('Sync failed', err);
    } finally {
      syncRunning.current = false;
    }
  }, []);

  // Sync when the tab regains focus or becomes visible again, and every 30 s.
  // This is the primary mechanism that keeps the app in sync across devices —
  // the realtime channel is best-effort, but a fresh pull on focus guarantees
  // we pick up anything we missed (closed tab, flaky network, etc.).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') runSync();
    };
    const onFocus = () => runSync();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => runSync(), 30_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [runSync]);

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

      await runSync();
      if (cancelled) return;
      setActiveNoteId((prev) => {
        if (prev && notesRef.current.some((n) => n.id === prev)) return prev;
        return !mobile && notesRef.current.length > 0 ? notesRef.current[0].id : prev;
      });
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [runSync]);

  const handleNoteChange = useCallback(
    (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE';
      new?: Record<string, any>;
      old?: Record<string, any>;
    }) => {
      const { eventType, new: newData, old: oldData } = payload;

      if (eventType === 'DELETE' && oldData) {
        setNotes((prev) => prev.filter((n) => n.id !== oldData.id));
        return;
      }
      if (!newData) return;

      const incoming: Note = {
        id: newData.id,
        title: newData.title,
        content: newData.content,
        updatedAt: newData.updated_at,
        synced: true,
        folderId: newData.folder_id ?? null,
      };

      if (eventType === 'INSERT') {
        setNotes((prev) => (prev.some((n) => n.id === incoming.id) ? prev : [incoming, ...prev]));
        return;
      }

      setNotes((prev) =>
        prev.map((n) => {
          if (n.id !== incoming.id) return n;
          // Local unsaved edits (or newer edits) win over a remote echo so we
          // never overwrite content the user is currently typing.
          if (!n.synced || n.updatedAt > incoming.updatedAt) return n;
          return incoming;
        })
      );
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
      if (eventType === 'DELETE' && oldData) {
        setFolders((prev) => prev.filter((f) => f.id !== oldData.id));
        setActiveFolder((prev) => (prev === oldData.id ? 'all' : prev));
        return;
      }
      if (!newData) return;
      const incoming: Folder = {
        id: newData.id,
        name: newData.name,
        updatedAt: newData.updated_at,
        synced: true,
      };
      if (eventType === 'INSERT') {
        setFolders((prev) =>
          prev.some((f) => f.id === incoming.id) ? prev : [incoming, ...prev]
        );
      } else {
        setFolders((prev) =>
          prev.map((f) => {
            if (f.id !== incoming.id) return f;
            if (!f.synced || f.updatedAt > incoming.updatedAt) return f;
            return incoming;
          })
        );
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
    () => {
      const filtered = filterNotes(notes, activeFolder, searchQuery);
      // Pinned notes float to the top, otherwise keep updatedAt-desc order.
      return [...filtered].sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (ap !== bp) return bp - ap;
        return b.updatedAt - a.updatedAt;
      });
    },
    [notes, activeFolder, searchQuery]
  );

  const foldersById = useMemo(() => {
    const map: Record<string, Folder> = {};
    for (const f of folders) map[f.id] = f;
    return map;
  }, [folders]);

  useEffect(() => {
    if (!activeNoteId) return;
    if (!visibleNotes.some((n) => n.id === activeNoteId)) {
      const next = !isMobile && visibleNotes.length > 0 ? visibleNotes[0].id : null;
      setActiveNoteId(next);
    }
  }, [visibleNotes, activeNoteId, isMobile]);

  const handleSelectNote = useCallback((id: string) => setActiveNoteId(id), []);

  const handleBackToList = useCallback(() => {
    setActiveNoteId(null);
    runSync();
  }, [runSync]);

  // Mobile gesture: swiping left on the open note returns to the previous
  // screen (the notes list). Vertical scrolls and text selection are ignored.
  const editorSwipe = useSwipe({
    enabled: isMobile,
    ignoreWhenTextSelected: true,
    onSwipe: (direction) => {
      if (direction === 'left') handleBackToList();
    },
  });

  const handleShare = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Share link copied');
    } catch {
      showToast('Could not copy link');
    }
  }, [showToast]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await runSync();
    setRefreshing(false);
    showToast('Synced');
  }, [runSync, showToast]);

  const handleSelectFolder = useCallback((folder: FolderFilter) => {
    setActiveFolder(folder);
    if (folder !== 'all') setSearchQuery('');
  }, []);

  const handleUpdateNote = useCallback(
    (field: 'title' | 'content', value: string) => {
      const id = activeNoteIdRef.current;
      if (!id) return;
      setSaveStatus('saving');

      setNotes((prev) =>
        prev.map((note) =>
          note.id === id ? { ...note, [field]: value, updatedAt: Date.now(), synced: false } : note
        )
      );

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        // Persist the in-memory note directly instead of re-reading the store.
        const latest = notesRef.current.find((n) => n.id === id);
        if (latest) {
          await saveNoteToIDB(latest);
        }
        setSaveStatus('saved');
        runSync();
      }, 800);
    },
    [runSync]
  );

  const createNewNote = useCallback(async () => {
    const folder = activeFolder;
    const folderId = folder !== 'all' && folder !== 'unfiled' ? folder : null;
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
    if (isMobileViewport()) setActiveFolder('all');
    runSync();
  }, [activeFolder, runSync]);

  const handleTogglePin = useCallback(
    async (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      const updated = { ...note, pinned: !note.pinned, updatedAt: Date.now(), synced: false };
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      await saveNoteToIDB(updated);
      runSync();
    },
    [runSync]
  );

  const handleDeleteNote = useCallback(
    async (id: string) => {
      const note = notesRef.current.find((n) => n.id === id);
      if (!note) return;
      await deleteNoteFromIDB(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveNoteId((prev) => (prev === id ? null : prev));
      runSync();
      showToast('Note deleted', {
        actionLabel: 'Undo',
        duration: 6000,
        onAction: async () => {
          const restored: Note = { ...note, deleted: false, synced: false, updatedAt: Date.now() };
          await saveNoteToIDB(restored);
          setNotes((prev) => [restored, ...prev.filter((n) => n.id !== restored.id)]);
          runSync();
          showToast('Note restored');
        },
      });
    },
    [runSync, showToast]
  );

  const handleMoveNote = useCallback(
    async (folderId: string | null) => {
      const id = activeNoteIdRef.current;
      if (!id) return;
      const now = Date.now();
      setSaveStatus('saving');
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, folderId, updatedAt: now, synced: false } : n))
      );
      const note = notesRef.current.find((n) => n.id === id);
      if (note) {
        await saveNoteToIDB({ ...note, folderId, updatedAt: now, synced: false });
      }
      setSaveStatus('saved');
      showToast(folderId ? 'Note moved' : 'Note moved to Unfiled');
      runSync();
    },
    [runSync, showToast]
  );

  const handleCopyNoteToFolder = useCallback(
    async (folderId: string | null) => {
      const id = activeNoteIdRef.current;
      const original = notesRef.current.find((n) => n.id === id);
      if (!original) return;
      const duplicate: Note = {
        id: crypto.randomUUID(),
        title: original.title,
        content: original.content,
        updatedAt: Date.now(),
        synced: false,
        folderId,
      };
      await saveNoteToIDB(duplicate);
      setNotes((prev) => [duplicate, ...prev]);
      setCopyMenuOpen(false);
      const targetLabel = folderId
        ? foldersById[folderId]?.name ?? 'folder'
        : 'Unfiled';
      showToast(`Copied to ${targetLabel}`);
      runSync();
    },
    [foldersById, runSync, showToast]
  );

  const handleCreateFolder = useCallback(
    async (name: string, color: string) => {
      const folder: Folder = {
        id: crypto.randomUUID(),
        name,
        color,
        updatedAt: Date.now(),
        synced: false,
      };
      await saveFolderToIDB(folder);
      setFolders((prev) => [folder, ...prev]);
      setActiveFolder(folder.id);
      setSearchQuery('');
      showToast(`Folder "${name}" created`);
      runSync();
    },
    [runSync, showToast]
  );

  const handleRenameFolder = useCallback(
    async (id: string, name: string, color: string) => {
      const folder = folders.find((f) => f.id === id);
      if (!folder) return;
      const updated = { ...folder, name, color, updatedAt: Date.now(), synced: false };
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
      await saveFolderToIDB(updated);
      showToast('Folder renamed');
      runSync();
    },
    [folders, runSync, showToast]
  );

  const handleDeleteFolder = useCallback(
    async (id: string) => {
      const name = folders.find((f) => f.id === id)?.name ?? 'Folder';
      await deleteFolderFromIDB(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setNotes((prev) => prev.map((n) => (n.folderId === id ? { ...n, folderId: null } : n)));
      setActiveFolder('all');
      showToast(`Folder "${name}" deleted`);
      runSync();
    },
    [folders, runSync, showToast]
  );

  const handleCopyNote = useCallback(async () => {
    const note = notesRef.current.find((n) => n.id === activeNoteIdRef.current);
    if (!note) return;
    try {
      await navigator.clipboard.writeText(htmlToMarkdown(note.content));
      showToast('Note copied as Markdown');
    } catch {
      showToast('Could not copy note');
    }
  }, [showToast]);

  const handleExportMarkdown = useCallback(() => {
    const note = notesRef.current.find((n) => n.id === activeNoteIdRef.current);
    if (!note) return;
    const title = (note.title || 'Untitled Note').replace(/[\\/:*?"<>|]/g, '-');
    const markdown = htmlToMarkdown(note.content);
    const blob = new Blob([`# ${note.title}\n\n${markdown}\n`], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported as Markdown');
  }, [showToast]);

  const totalCount = notes.length;
  const unfiledCount = countsByFolder['unfiled'] || 0;
  const activeFolderLabel =
    activeFolder === 'all'
      ? 'All Notes'
      : activeFolder === 'unfiled'
      ? 'Unfiled'
      : folders.find((f) => f.id === activeFolder)?.name ?? 'Folder';

  const iconBtn =
    'p-2 rounded-lg text-cream-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors';

  const statusPill = !online
    ? {
        dot: 'bg-amber-500',
        label: 'Offline',
        cls: 'text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/30',
      }
    : saveStatus === 'saving'
    ? {
        dot: 'bg-primary-500 animate-pulse',
        label: 'Saving...',
        cls: 'text-primary-700 dark:text-primary-300 bg-primary-500/10 border-primary-500/30',
      }
    : {
        dot: 'bg-emerald-500',
        label: 'Saved',
        cls: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
      };

  const showFolderBadge = activeFolder === 'all';

  return (
    <div className="h-screen overflow-hidden bg-cream-50 dark:bg-navy-950 text-cream-800 dark:text-white flex flex-col md:flex-row">
      {!online && (
        <div className="fixed top-0 inset-x-0 z-[70] flex items-center justify-center gap-2 py-1.5 text-xs font-medium bg-amber-600 text-white">
          <WifiOff size={12} aria-hidden="true" />
          Offline — changes are saved locally and will sync when you reconnect
        </div>
      )}

      <aside
        className={`w-full md:w-80 shrink-0 min-h-0 border-r border-cream-300 dark:border-navy-600 flex flex-col h-screen ${
          activeNoteId ? 'hidden md:flex' : ''
        }`}
      >
        <header className="px-4 py-3 border-b border-cream-300 dark:border-navy-600 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-primary-700 dark:text-primary-400">
            Notes
          </h1>
          <div className="flex items-center gap-1.5">
            <ThemeToggle mode={themeMode} onChange={setThemeMode} />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`${iconBtn} disabled:opacity-50`}
              title="Refresh / sync"
              aria-label="Refresh and sync"
            >
              <RefreshCw
                size={18}
                aria-hidden="true"
                className={`text-primary-600 dark:text-primary-400 ${refreshing ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={createNewNote}
              className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 dark:bg-primary-500 dark:text-primary-950 dark:hover:bg-primary-600 transition-colors"
              title="New note"
              aria-label="New note"
            >
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="px-3 py-2.5">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-cream-400 dark:text-gray-500"
              size={15}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search notes..."
              aria-label="Search notes"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-cream-100 dark:bg-navy-900 rounded-lg border border-transparent focus:border-amber-400 focus:bg-cream-50 dark:focus:bg-navy-950 focus:outline-none text-cream-800 dark:text-white placeholder-cream-500 dark:placeholder-gray-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-cream-400 dark:text-gray-500 hover:text-cream-700 dark:hover:text-gray-200"
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div className="px-3 pt-2 pb-1.5 flex items-center gap-1 border-b border-cream-300 dark:border-navy-600">
          <button
            role="tab"
            aria-selected={sidebarTab === 'notes'}
            onClick={() => setSidebarTab('notes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sidebarTab === 'notes'
                ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-primary-950'
                : 'text-cream-500 dark:text-gray-400 hover:bg-cream-200 dark:hover:bg-navy-800'
            }`}
          >
            <NotebookPen size={13} aria-hidden="true" />
            Notes
            <span className={`text-[10px] ${sidebarTab === 'notes' ? 'opacity-80' : 'opacity-60'}`}>
              {totalCount}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={sidebarTab === 'folders'}
            onClick={() => setSidebarTab('folders')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sidebarTab === 'folders'
                ? 'bg-primary-600 text-white dark:bg-primary-500 dark:text-primary-950'
                : 'text-cream-500 dark:text-gray-400 hover:bg-cream-200 dark:hover:bg-navy-800'
            }`}
          >
            <Folders size={13} aria-hidden="true" />
            Folders
            <span className={`text-[10px] ${sidebarTab === 'folders' ? 'opacity-80' : 'opacity-60'}`}>
              {folders.length}
            </span>
          </button>
          <div className="ml-auto">
            <button
              onClick={() => setSidebarTab('folders')}
              className="text-xs text-cream-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-0.5"
              title="Manage folders"
            >
              <span className="hidden md:inline">Manage</span>
              <ChevronRight size={13} aria-hidden="true" />
            </button>
          </div>
        </div>

        {sidebarTab === 'folders' ? (
          <div className="flex-1 min-h-0 overflow-y-auto pt-3 pb-20 md:pb-3 px-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-cream-500 dark:text-gray-400">
                All Folders
              </span>
            </div>
            <FolderGrid
              folders={folders}
              activeFolder={activeFolder}
              totalCount={totalCount}
              unfiledCount={unfiledCount}
              countsByFolder={countsByFolder}
              onSelect={(f) => {
                handleSelectFolder(f);
                setSidebarTab('notes');
              }}
              onCreate={handleCreateFolder}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
            />
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-cream-300 dark:border-navy-600 flex items-center gap-2">
              <FolderIcon size={13} aria-hidden="true" className="text-cream-400 dark:text-gray-500" />
              <span className="text-xs font-medium text-cream-700 dark:text-gray-200 truncate">
                {activeFolderLabel}
              </span>
              <span className="text-[10px] text-cream-400 dark:text-gray-500">
                {visibleNotes.length}
              </span>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pt-1 pb-20 md:pb-1">
              {visibleNotes.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <Inbox size={26} className="mx-auto mb-3 text-cream-300 dark:text-navy-600" aria-hidden="true" />
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
                      <FilePlus2 size={13} aria-hidden="true" />
                      New note
                    </button>
                  )}
                </div>
              ) : (
                visibleNotes.map((note) => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    active={activeNoteId === note.id}
                    searchQuery={searchQuery}
                    showFolderBadge={showFolderBadge}
                    folderName={note.folderId ? foldersById[note.folderId]?.name ?? null : null}
                    folderColor={note.folderId ? foldersById[note.folderId]?.color ?? null : null}
                    onSelect={handleSelectNote}
                    onDelete={handleDeleteNote}
                    onTogglePin={handleTogglePin}
                  />
                ))
              )}
            </div>
          </>
        )}

        <div className="p-3 border-t border-cream-300 dark:border-navy-600">
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium bg-cream-100 dark:bg-navy-900 border border-cream-300 dark:border-navy-700 text-cream-600 dark:text-gray-300 px-2 py-2 rounded-lg hover:bg-cream-200 dark:hover:bg-navy-800 transition-colors"
          >
            <Share2 size={13} aria-hidden="true" />
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
          <div className="flex-1 min-h-0 flex flex-col max-w-full" {...editorSwipe}>
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
                        aria-hidden="true"
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-cream-400 dark:text-gray-500 pointer-events-none"
                      />
                      <select
                        value={activeNote.folderId || ''}
                        onChange={(e) => handleMoveNote(e.target.value || null)}
                        className="appearance-none pl-7 pr-6 py-1 text-xs rounded-md bg-cream-200 dark:bg-navy-800 text-cream-700 dark:text-gray-200 border border-cream-300 dark:border-navy-600 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                        title="Move note to folder"
                        aria-label="Move note to folder"
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

                  <div className="relative" ref={copyMenuRef}>
                    <button
                      onClick={() => setCopyMenuOpen((v) => !v)}
                      className="flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                      title="Copy note to folder"
                      aria-label="Copy note to folder"
                      aria-expanded={copyMenuOpen}
                      aria-haspopup="menu"
                    >
                      <CopyPlus size={14} aria-hidden="true" />
                      Copy to
                    </button>
                    {copyMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full mt-1 z-30 min-w-[200px] rounded-lg border border-cream-300 dark:border-navy-600 bg-cream-50 dark:bg-navy-900 shadow-lg p-1"
                      >
                        <button
                          role="menuitem"
                          onClick={() => handleCopyNoteToFolder(null)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 text-sm text-cream-800 dark:text-white"
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0 bg-cream-400 dark:bg-gray-500"
                            aria-hidden="true"
                          />
                          <span className="truncate flex-1 text-left">Unfiled</span>
                        </button>
                        {folders.map((f) => (
                          <button
                            key={f.id}
                            role="menuitem"
                            onClick={() => handleCopyNoteToFolder(f.id)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 text-sm text-cream-800 dark:text-white"
                          >
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${folderColorClasses(f.color).dot}`}
                              aria-hidden="true"
                            />
                            <span className="truncate flex-1 text-left">{f.name}</span>
                          </button>
                        ))}
                        {folders.length === 0 && (
                          <div className="px-2 py-2 text-xs text-cream-500 dark:text-gray-400">
                            No folders yet — create one to organize notes.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleShare}
                    className="hidden md:flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                    title="Copy share link"
                  >
                    <Share2 size={14} aria-hidden="true" />
                    Share
                  </button>
                  <button
                    onClick={handleCopyNote}
                    className="hidden md:flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                    title="Copy note as Markdown"
                  >
                    <Copy size={14} aria-hidden="true" />
                    Copy
                  </button>
                  <button
                    onClick={handleExportMarkdown}
                    className="hidden md:flex items-center gap-1 text-xs text-cream-500 dark:text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 bg-cream-200 dark:bg-navy-800 px-2 py-1 rounded-md transition-colors"
                    title="Export as Markdown"
                  >
                    <Download size={14} aria-hidden="true" />
                    Export
                  </button>
                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1 rounded-md text-cream-500 dark:text-gray-400 hover:bg-cream-200 dark:hover:bg-navy-800 disabled:opacity-50 transition-colors"
                    title="Refresh / sync"
                    aria-label="Refresh and sync"
                  >
                    <RefreshCw
                      size={14}
                      aria-hidden="true"
                      className={`text-cream-500 dark:text-gray-400 ${refreshing ? 'animate-spin' : ''}`}
                    />
                  </button>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${statusPill.cls}`}
                    role="status"
                    aria-live="polite"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusPill.dot}`} aria-hidden="true" />
                    <span>{statusPill.label}</span>
                  </div>
                </div>
              </div>

              {!isFullscreen && (
                <div className="max-w-3xl mx-auto w-full">
                  <input
                    type="text"
                    value={activeNote.title}
                    onChange={(e) => handleUpdateNote('title', e.target.value)}
                    placeholder="Note Title"
                    aria-label="Note title"
                    className="text-2xl md:text-3xl font-bold bg-transparent border-none outline-none mb-3 w-full text-cream-800 dark:text-white placeholder-cream-400 dark:placeholder-gray-600"
                  />
                </div>
              )}
            </div>

            <RichEditor
              noteId={activeNote.id}
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
                <FilePlus2 size={16} aria-hidden="true" />
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
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-2 rounded-full text-sm font-medium bg-cream-800 text-cream-50 dark:bg-cream-100 dark:text-cream-900 shadow-lg"
        >
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="font-semibold underline underline-offset-2 hover:opacity-80"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}

      <BottomNav
        onNotes={handleBackToList}
        onNewNote={createNewNote}
        themeMode={themeMode}
        onCycleTheme={cycleThemeMode}
      />
    </div>
  );
};

export default App;
