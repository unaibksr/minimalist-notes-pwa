import { createClient, type Session } from '@supabase/supabase-js';
import { getNotesFromIDB, saveNoteToIDB } from './db';
import type { Note } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSession = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session;
};

export const initAnonAuth = async () => {
  const session = await getSession();
  if (!session) {
    await supabase.auth.signInAnonymously();
  }
};

export const signInWithMagicLink = async (email: string) => {
  const { error } = await supabase.auth.signInWithOtp({ email });
  return error;
};

export const signOut = async () => {
  await supabase.auth.signOut();
};

export const onAuthStateChange = (callback: (session: Session | null) => void) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return subscription;
};

export const syncNotesWithSupabase = async (): Promise<Note[]> => {
  const { data } = await supabase.auth.getUser();
  if (!data?.user) return getNotesFromIDB();
  const user = data.user;

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
        user_id: user.id,
        updated_at: note.updatedAt,
      });
    }
    note.synced = true;
    await saveNoteToIDB(note);
  }

  const { data: remoteNotes } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', user.id);

  if (remoteNotes) {
    for (const rNote of remoteNotes) {
      const local = localNotes.find((n) => n.id === rNote.id);
      if (!local || local.updatedAt < rNote.updated_at) {
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

  return getNotesFromIDB();
};
