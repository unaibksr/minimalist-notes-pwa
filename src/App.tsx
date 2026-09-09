import React, { useState, useEffect, useRef } from 'react';
import { Note, Theme } from './types';
import { getNotesFromIDBForUI, saveNoteToIDB, deleteNoteFromIDB } from './lib/db';
import { syncNotesWithSupabase } from './lib/supabase';
import { RichEditor } from './components/RichEditor';
import { Search, Plus, Trash2, Moon, Sun, Check, RefreshCw, PanelLeft, EyeOff, Eye, Copy, Download, Share2 } from 'lucide-react';

export const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<Theme>('light');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);
  const [isMobile, setIsMobile] = useState(window.matchMedia('(max-width: 767px)').matches);
  
  const touchStartX = useRef<number>(0);
  const mainTouchStartX = useRef<number>(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    setIsMobile(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const init = async () => {
      const updatedNotes = await syncNotesWithSupabase();
      setNotes(updatedNotes);
      if (updatedNotes.length > 0 && !isMobile) {
        setActiveNoteId(updatedNotes[0].id);
      }
    };

    init();
  }, [isMobile]);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const activeNote = notes.find((n) => n.id === activeNoteId);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900 text-zinc-900 dark:text-zinc-100 rounded px-0.5">$1</mark>');
  };

  const getPreviewText = (note: Note) => {
    const text = note.content.replace(/<[^>]*>/g, '');
    return text || 'No additional text';
  };

  const handleBackToList = async () => {
    await syncNotesWithSupabase();
    setActiveNoteId(null);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('saving'), 500);
  };

  const handleUpdateNote = (field: 'title' | 'content', value: string) => {
    if (!activeNoteId) return;

    setSaveStatus('saving');

    setNotes((prev) =>
      prev.map((note) => {
        if (note.id === activeNoteId) {
          return {
            ...note,
            [field]: value,
            updatedAt: Date.now(),
            synced: false,
          };
        }
        return note;
      })
    );

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(async () => {
      const currentNotes = await getNotesFromIDBForUI();
      const updated = currentNotes.find((n) => n.id === activeNoteId);
      if (updated) {
        const payload = { ...updated, [field]: value, updatedAt: Date.now(), synced: false };
        await saveNoteToIDB(payload);
        setSaveStatus('saved');
      }
    }, 1000);
  };

  const createNewNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled Note',
      content: '<p></p>',
      updatedAt: Date.now(),
      synced: false,
    };
    await saveNoteToIDB(newNote);
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    const updatedNotes = await syncNotesWithSupabase();
    setNotes(updatedNotes);
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNoteFromIDB(id);
    const filtered = notes.filter((n) => n.id !== id);
    setNotes(filtered);
    if (activeNoteId === id) {
      setActiveNoteId(filtered.length > 0 ? filtered[0].id : null);
    }
  };

  const handleCopyNote = async () => {
    if (!activeNote) return;
    const text = activeNote.content.replace(/<[^>]*>/g, '');
    await navigator.clipboard.writeText(text);
    setTimeout(() => setSaveStatus('saved'), 500);
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
  };

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

   return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row">
      <aside className={`w-full md:w-80 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-screen ${activeNoteId ? 'hidden md:flex' : ''} ${isZenMode ? 'hidden' : ''}`}>
        <header className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <h1 className="text-xl font-bold tracking-tight">Notes</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsZenMode(!isZenMode)}
              className={`p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${isZenMode ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
              title={isZenMode ? 'Exit Focus Mode' : 'Focus Mode'}
            >
              {isZenMode ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Toggle Theme"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              onClick={createNewNote}
              className="p-2 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:opacity-90 flex items-center gap-1 text-sm font-medium"
            >
              <Plus size={18} />
            </button>
          </div>
        </header>

        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-900 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-400"
            />
          </div>
        </div>

        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">Share this link to collaborate</p>
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-1 text-xs bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 px-2 py-1.5 rounded hover:opacity-90"
          >
            <Share2 size={12} />
            Copy share link
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
              onTouchEnd={(e) => {
                const diffX = touchStartX.current - e.changedTouches[0].clientX;
                if (diffX > 80) handleDeleteNote(note.id);
              }}
              onClick={() => setActiveNoteId(note.id)}
              className={`p-4 cursor-pointer transition-colors flex justify-between items-start group ${
                activeNoteId === note.id ? 'bg-zinc-100 dark:bg-zinc-900' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
              }`}
            >
              <div className="flex-1 pr-2 overflow-hidden">
                <h3 className="font-semibold text-sm truncate" dangerouslySetInnerHTML={{ __html: highlightText(note.title || 'Untitled Note', searchQuery) }} />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-1" dangerouslySetInnerHTML={{ __html: highlightText(getPreviewText(note), searchQuery) }} />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteNote(note.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <main className={`flex-1 flex flex-col h-screen overflow-hidden ${!activeNoteId ? 'hidden md:flex' : ''} ${isZenMode ? 'md:flex' : ''}`}>
        {activeNote ? (
           <div
             className="flex-1 flex flex-col h-full max-w-full p-4 md:p-8 md:px-12 overflow-y-auto"
             onTouchStart={(e) => { mainTouchStartX.current = e.touches[0].clientX; }}
             onTouchEnd={(e) => {
               const diffX = mainTouchStartX.current - e.changedTouches[0].clientX;
               if (diffX > 80 && isMobile) handleBackToList();
             }}
           >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToList}
                  className="md:hidden text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  ← Back to list
                </button>
                {isZenMode && (
                  <button
                    onClick={() => setIsZenMode(false)}
                    className="hidden md:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded"
                  >
                    <PanelLeft size={14} />
                    Exit Focus Mode
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="hidden md:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded"
                  title="Copy share link"
                >
                  <Share2 size={14} />
                  Share
                </button>
                <button
                  onClick={handleCopyNote}
                  className="hidden md:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded"
                  title="Copy note text"
                >
                  <Copy size={14} />
                  Copy
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="hidden md:flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded"
                  title="Export as Markdown"
                >
                  <Download size={14} />
                  Export
                </button>
                <div className="flex items-center gap-1 text-xs text-zinc-400 ml-auto">
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

            <input
              type="text"
              value={activeNote.title}
              onChange={(e) => handleUpdateNote('title', e.target.value)}
              placeholder="Note Title"
              className="text-2xl md:text-3xl font-bold bg-transparent border-none outline-none mb-4 w-full"
            />

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
              <h2 className="text-xl font-semibold text-zinc-700 dark:text-zinc-300 mb-2">No Note Selected</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Select a note from the sidebar or create a new one to start writing. 
                Your notes are saved automatically and sync across devices.
              </p>
              <div className="flex flex-col gap-2 text-xs text-zinc-400">
                <p><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">B</kbd> Bold</p>
                <p><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">I</kbd> Italic</p>
                <p><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">S</kbd> Export Markdown</p>
                <p><kbd className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">Esc</kbd> Exit fullscreen</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
