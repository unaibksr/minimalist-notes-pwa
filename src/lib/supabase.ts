import { createClient } from '@supabase/supabase-js';
import { getNotesFromIDB, getNotesFromIDBForUI, saveNotesToIDB } from './db';
import type { Note } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  db: { schema: 'public' },
  global: { headers: { 'x-client-name': 'minimalist-notes' } },
});

let lastSyncTimestamp = 0;

export const syncNotesWithSupabase = async (): Promise<Note[]> => {
  const localNotes = await getNotesFromIDB();
  const unSynced = localNotes.filter((n) => !n.synced);

  if (unSynced.length > 0) {
    const upsertPromises = unSynced
      .filter((n) => !n.deleted)
      .map((note) =>
        supabase.from('notes').upsert({
          id: note.id,
          title: note.title,
          content: note.content,
          updated_at: note.updatedAt,
        })
      );

    const deletePromises = unSynced
      .filter((n) => n.deleted)
      .map((note) => supabase.from('notes').delete().eq('id', note.id));

    await Promise.all([...upsertPromises, ...deletePromises]);

    for (const note of unSynced) {
      note.synced = true;
    }
    await saveNotesToIDB(unSynced);
  }

  const { data: remoteNotes } = await supabase
    .from('notes')
    .select('id,title,content,updated_at')
    .gt('updated_at', lastSyncTimestamp);

  lastSyncTimestamp = Date.now();

  if (remoteNotes && remoteNotes.length > 0) {
    const notesToSave: Note[] = [];
    for (const rNote of remoteNotes) {
      const local = localNotes.find((n) => n.id === rNote.id);
      if (!local) {
        notesToSave.push({
          id: rNote.id,
          title: rNote.title,
          content: rNote.content,
          updatedAt: rNote.updated_at,
          synced: true,
        });
      } else if (!local.deleted && local.updatedAt < rNote.updated_at) {
        local.title = rNote.title;
        local.content = rNote.content;
        local.updatedAt = rNote.updated_at;
        local.synced = true;
        notesToSave.push(local);
      }
    }
    if (notesToSave.length > 0) {
      await saveNotesToIDB(notesToSave);
    }
  }

  return getNotesFromIDBForUI();
};
