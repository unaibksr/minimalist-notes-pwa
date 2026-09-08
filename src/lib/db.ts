import { openDB, DBSchema } from 'idb';
import { Note } from '../types';

interface NotesDB extends DBSchema {
  notes: {
    key: string;
    value: Note;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'minimalist-notes-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB<NotesDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('notes', { keyPath: 'id' });
      store.createIndex('by-updated', 'updatedAt');
    },
  });
};

export const saveNoteToIDB = async (note: Note) => {
  const db = await initDB();
  await db.put('notes', note);
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
