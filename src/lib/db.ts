import { openDB, DBSchema } from 'idb';
import { Note, Folder } from '../types';

interface NotesDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updated': number };
  };
  folders: {
    key: string;
    value: Folder;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'minimalist-notes-db';
const DB_VERSION = 2;

export const initDB = async () => {
  return openDB<NotesDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('notes')) {
        const store = db.createObjectStore('notes', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      }
      if (!db.objectStoreNames.contains('folders')) {
        const store = db.createObjectStore('folders', { keyPath: 'id' });
        store.createIndex('by-updated', 'updatedAt');
      }
    },
  });
};

export const saveNoteToIDB = async (note: Note) => {
  const db = await initDB();
  await db.put('notes', note);
};

export const saveNotesToIDB = async (notes: Note[]) => {
  const db = await initDB();
  const tx = db.transaction('notes', 'readwrite');
  const store = tx.objectStore('notes');
  for (const note of notes) {
    store.put(note);
  }
  await tx.done;
};

export const getNotesFromIDB = async (): Promise<Note[]> => {
  const db = await initDB();
  const notes = await db.getAllFromIndex('notes', 'by-updated');
  return notes.reverse();
};

export const getNotesFromIDBForUI = async (): Promise<Note[]> => {
  const notes = await getNotesFromIDB();
  return notes.filter((n) => !n.deleted);
};

export const countNotesByFolder = async (): Promise<Record<string, number>> => {
  const notes = await getNotesFromIDBForUI();
  const counts: Record<string, number> = {};
  for (const n of notes) {
    const key = n.folderId || 'unfiled';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
};

export const deleteNoteFromIDB = async (id: string) => {
  const db = await initDB();
  const note = await db.get('notes', id);
  if (note) {
    note.deleted = true;
    note.synced = false;
    note.updatedAt = Date.now();
    await db.put('notes', note);
  }
};

export const saveFolderToIDB = async (folder: Folder) => {
  const db = await initDB();
  await db.put('folders', folder);
};

export const saveFoldersToIDB = async (folders: Folder[]) => {
  if (folders.length === 0) return;
  const db = await initDB();
  const tx = db.transaction('folders', 'readwrite');
  const store = tx.objectStore('folders');
  for (const folder of folders) {
    store.put(folder);
  }
  await tx.done;
};

export const getFoldersFromIDB = async (): Promise<Folder[]> => {
  const db = await initDB();
  const folders = await db.getAllFromIndex('folders', 'by-updated');
  return folders.reverse();
};

export const getFoldersFromIDBForUI = async (): Promise<Folder[]> => {
  const folders = await getFoldersFromIDB();
  return folders.filter((f) => !f.deleted);
};

export const deleteFolderFromIDB = async (id: string) => {
  const db = await initDB();
  const tx = db.transaction(['folders', 'notes'], 'readwrite');
  const folderStore = tx.objectStore('folders');
  const noteStore = tx.objectStore('notes');

  const folder = await folderStore.get(id);
  if (folder) {
    folder.deleted = true;
    folder.synced = false;
    folder.updatedAt = Date.now();
    await folderStore.put(folder);
  }

  const notes = await noteStore.getAll();
  const now = Date.now();
  for (const note of notes) {
    if (note.folderId === id) {
      note.folderId = null;
      note.synced = false;
      note.updatedAt = now;
      await noteStore.put(note);
    }
  }

  await tx.done;
};
