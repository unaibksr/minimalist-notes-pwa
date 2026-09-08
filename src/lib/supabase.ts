import { createClient } from '@supabase/supabase-js';
import { getNotesFromIDB, getNotesFromIDBForUI, saveNoteToIDB } from './db';
import type { Note } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const syncNotesWithSupabase = async (): Promise<Note[]> => {
  const localNotes = await getNotesFromIDB();
  const unSynced = localNotes.filter((n) => !n.synced);

  for (const note of unSynced) {
    if (note.deleted) {
      await supabase.from('notes').delete().eq('id', note.id);
    } else {
      await supabase.from('notes').upsert({
        id: note.id,
        title: note.title,
        content: note.content,
        updated_at: note.updatedAt,
      });
    }
    note.synced = true;
    await saveNoteToIDB(note);
  }

  const { data: remoteNotes } = await supabase
    .from('notes')
    .select('*');

  if (remoteNotes) {
    for (const rNote of remoteNotes) {
      const local = localNotes.find((n) => n.id === rNote.id);
      if (!local) {
        await saveNoteToIDB({
          id: rNote.id,
          title: rNote.title,
          content: rNote.content,
          updatedAt: rNote.updated_at,
          synced: true,
        });
      } else if (!local.deleted && local.updatedAt < rNote.updated_at) {
        await saveNoteToIDB({
          id: rNote.id,
          title: rNote.title,
          content: rNote.content,
          updatedAt: rNote.updated_at,
          synced: true,
        });
      }
    }
  }

  return getNotesFromIDBForUI();
};
