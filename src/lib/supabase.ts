import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getNotesFromIDB,
  getNotesFromIDBForUI,
  saveNotesToIDB,
  getFoldersFromIDB,
  getFoldersFromIDBForUI,
  saveFoldersToIDB,
} from './db';
import type { Note, Folder } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export let supabase: SupabaseClient<any, any, any> | null = null;

if (isSupabaseConfigured) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      db: { schema: 'public' },
      global: { headers: { 'x-client-name': 'minimalist-notes' } },
    });
  } catch {
    supabase = null;
  }
}

let lastSyncTimestamp = 0;

export interface SupabaseCapabilities {
  foldersTable: boolean;
  noteFolderColumn: boolean;
}

let capabilities: SupabaseCapabilities | null = null;

export const detectSupabaseCapabilities = async (): Promise<SupabaseCapabilities> => {
  if (capabilities) return capabilities;
  const client = supabase;
  if (!client) {
    capabilities = { foldersTable: false, noteFolderColumn: false };
    return capabilities;
  }
  const result: SupabaseCapabilities = { foldersTable: false, noteFolderColumn: false };
  try {
    const { error } = await client.from('folders').select('id').limit(1);
    result.foldersTable = !error;
  } catch {
    result.foldersTable = false;
  }
  try {
    const { error } = await client.from('notes').select('folder_id').limit(1);
    result.noteFolderColumn = !error;
  } catch {
    result.noteFolderColumn = false;
  }
  capabilities = result;
  return result;
};

export interface SyncResult {
  notes: Note[];
  folders: Folder[];
}

export const syncWithSupabase = async (): Promise<SyncResult> => {
  const client = supabase;
  if (!client) {
    return {
      notes: await getNotesFromIDBForUI(),
      folders: await getFoldersFromIDBForUI(),
    };
  }

  const caps = await detectSupabaseCapabilities();

  const localNotes = await getNotesFromIDB();
  const unSyncedNotes = localNotes.filter((n) => !n.synced);

  if (unSyncedNotes.length > 0) {
    const upsertPromises = unSyncedNotes
      .filter((n) => !n.deleted)
      .map((note) => {
        const row: Record<string, any> = {
          id: note.id,
          title: note.title,
          content: note.content,
          updated_at: note.updatedAt,
        };
        if (caps.noteFolderColumn) row.folder_id = note.folderId ?? null;
        return client.from('notes').upsert(row);
      });

    const deletePromises = unSyncedNotes
      .filter((n) => n.deleted)
      .map((note) => client.from('notes').delete().eq('id', note.id));

    await Promise.all([...upsertPromises, ...deletePromises]);

    for (const note of unSyncedNotes) {
      note.synced = true;
    }
    await saveNotesToIDB(unSyncedNotes);
  }

  if (caps.foldersTable) {
    const localFolders = await getFoldersFromIDB();
    const unSyncedFolders = localFolders.filter((f) => !f.synced);
    if (unSyncedFolders.length > 0) {
      const upsertPromises = unSyncedFolders
        .filter((f) => !f.deleted)
        .map((folder) =>
          client.from('folders').upsert({
            id: folder.id,
            name: folder.name,
            updated_at: folder.updatedAt,
          })
        );

      const deletePromises = unSyncedFolders
        .filter((f) => f.deleted)
        .map((folder) => client.from('folders').delete().eq('id', folder.id));

      await Promise.all([...upsertPromises, ...deletePromises]);

      for (const folder of unSyncedFolders) {
        folder.synced = true;
      }
      await saveFoldersToIDB(unSyncedFolders);
    }
  }

  const noteColumns = caps.noteFolderColumn
    ? 'id,title,content,updated_at,folder_id'
    : 'id,title,content,updated_at';

  const { data: remoteNotes } = await client
    .from('notes')
    .select(noteColumns)
    .gt('updated_at', lastSyncTimestamp);

  if (remoteNotes && remoteNotes.length > 0) {
    const notesToSave: Note[] = [];
    for (const rNote of remoteNotes as any[]) {
      const local = localNotes.find((n) => n.id === rNote.id);
      const remoteFolderId = caps.noteFolderColumn ? (rNote.folder_id ?? null) : null;
      if (!local) {
        notesToSave.push({
          id: rNote.id,
          title: rNote.title,
          content: rNote.content,
          updatedAt: rNote.updated_at,
          synced: true,
          folderId: remoteFolderId,
        });
      } else if (!local.deleted && local.updatedAt < rNote.updated_at) {
        local.title = rNote.title;
        local.content = rNote.content;
        local.updatedAt = rNote.updated_at;
        local.folderId = remoteFolderId;
        local.synced = true;
        notesToSave.push(local);
      }
    }
    if (notesToSave.length > 0) {
      await saveNotesToIDB(notesToSave);
    }
  }

  if (caps.foldersTable) {
    const { data: remoteFolders } = await client
      .from('folders')
      .select('id,name,updated_at')
      .gt('updated_at', lastSyncTimestamp);

    if (remoteFolders && remoteFolders.length > 0) {
      const localFolders = await getFoldersFromIDB();
      const foldersToSave: Folder[] = [];
      for (const rFolder of remoteFolders as any[]) {
        const local = localFolders.find((f) => f.id === rFolder.id);
        if (!local) {
          foldersToSave.push({
            id: rFolder.id,
            name: rFolder.name,
            updatedAt: rFolder.updated_at,
            synced: true,
          });
        } else if (!local.deleted && local.updatedAt < rFolder.updated_at) {
          local.name = rFolder.name;
          local.updatedAt = rFolder.updated_at;
          local.synced = true;
          foldersToSave.push(local);
        }
      }
      if (foldersToSave.length > 0) {
        await saveFoldersToIDB(foldersToSave);
      }
    }
  }

  lastSyncTimestamp = Date.now();

  return {
    notes: await getNotesFromIDBForUI(),
    folders: await getFoldersFromIDBForUI(),
  };
};

type ChangeHandler = (payload: {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, any>;
  old?: Record<string, any>;
}) => void;

export const subscribeToRealtime = (
  client: SupabaseClient | null,
  handlers: { onNote: ChangeHandler; onFolder: ChangeHandler },
  options: { folders: boolean }
): (() => void) => {
  if (!client) return () => {};

  try {
    let channel = client
      .channel('minimalist-notes-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes' },
        (payload) => {
          handlers.onNote(payload as any);
        }
      );

    if (options.folders) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders' },
        (payload) => {
          handlers.onFolder(payload as any);
        }
      );
    }

    channel.subscribe();

    return () => {
      client.removeChannel(channel);
    };
  } catch {
    return () => {};
  }
};
