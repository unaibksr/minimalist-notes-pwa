import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  getNotesFromIDB,
  getNotesFromIDBForUI,
  saveNotesToIDB,
  purgeNotesFromIDB,
  getFoldersFromIDB,
  getFoldersFromIDBForUI,
  saveFoldersToIDB,
  purgeFoldersFromIDB,
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

/**
 * Overlap window (ms) for incremental pulls so minor clock skew between
 * devices never causes missed updates.
 */
const SKEW_BUFFER_MS = 60_000;

let lastNotesSyncTs = 0;
let lastFoldersSyncTs = 0;

export interface SupabaseCapabilities {
  foldersTable: boolean;
  noteFolderColumn: boolean;
  folderColorColumn: boolean;
  notePinnedColumn: boolean;
  noteDeletedColumn: boolean;
  folderDeletedColumn: boolean;
}

let capabilities: SupabaseCapabilities | null = null;

const probeColumn = async (
  client: SupabaseClient<any, any, any>,
  table: string,
  column: string
): Promise<boolean> => {
  try {
    const { error } = await client.from(table).select(column).limit(1);
    return !error;
  } catch {
    return false;
  }
};

export const detectSupabaseCapabilities = async (): Promise<SupabaseCapabilities> => {
  if (capabilities) return capabilities;
  const client = supabase;
  if (!client) {
    capabilities = {
      foldersTable: false,
      noteFolderColumn: false,
      folderColorColumn: false,
      notePinnedColumn: false,
      noteDeletedColumn: false,
      folderDeletedColumn: false,
    };
    return capabilities;
  }

  const [foldersTable, noteFolderColumn, notePinnedColumn, noteDeletedColumn] =
    await Promise.all([
      probeColumn(client, 'folders', 'id'),
      probeColumn(client, 'notes', 'folder_id'),
      probeColumn(client, 'notes', 'pinned'),
      probeColumn(client, 'notes', 'deleted'),
    ]);

  const [folderColorColumn, folderDeletedColumn] = foldersTable
    ? await Promise.all([
        probeColumn(client, 'folders', 'color'),
        probeColumn(client, 'folders', 'deleted'),
      ])
    : [false, false];

  capabilities = {
    foldersTable,
    noteFolderColumn,
    folderColorColumn,
    notePinnedColumn,
    noteDeletedColumn,
    folderDeletedColumn,
  };
  return capabilities;
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

  // ---------------------------------------------------------------------------
  // 1. Push local unsynced notes
  // ---------------------------------------------------------------------------
  const localNotes = await getNotesFromIDB();
  const unSyncedNotes = localNotes.filter((n) => !n.synced);

  if (unSyncedNotes.length > 0) {
    const succeededUpserts: Note[] = [];
    const hardDeletedIds: string[] = [];
    let pushError: unknown = null;

    const tasks = unSyncedNotes.map(async (note) => {
      if (note.deleted && !caps.noteDeletedColumn) {
        const { error } = await client.from('notes').delete().eq('id', note.id);
        if (error) {
          pushError = pushError ?? error;
          return;
        }
        hardDeletedIds.push(note.id);
        return;
      }

      const row: Record<string, any> = {
        id: note.id,
        title: note.title,
        content: note.content,
        updated_at: note.updatedAt,
      };
      if (caps.noteFolderColumn) row.folder_id = note.folderId ?? null;
      if (caps.notePinnedColumn) row.pinned = !!note.pinned;
      if (caps.noteDeletedColumn) row.deleted = !!note.deleted;

      const { error } = await client.from('notes').upsert(row);
      if (error) {
        pushError = pushError ?? error;
        return;
      }
      note.synced = true;
      succeededUpserts.push(note);
    });

    await Promise.all(tasks);

    if (succeededUpserts.length > 0) {
      await saveNotesToIDB(succeededUpserts);
    }
    if (hardDeletedIds.length > 0) {
      await purgeNotesFromIDB(hardDeletedIds);
    }
    if (pushError) {
      throw pushError;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Push local unsynced folders
  // ---------------------------------------------------------------------------
  if (caps.foldersTable) {
    const localFolders = await getFoldersFromIDB();
    const unSyncedFolders = localFolders.filter((f) => !f.synced);

    if (unSyncedFolders.length > 0) {
      const succeededUpserts: Folder[] = [];
      const hardDeletedIds: string[] = [];
      let pushError: unknown = null;

      const tasks = unSyncedFolders.map(async (folder) => {
        if (folder.deleted && !caps.folderDeletedColumn) {
          const { error } = await client.from('folders').delete().eq('id', folder.id);
          if (error) {
            pushError = pushError ?? error;
            return;
          }
          hardDeletedIds.push(folder.id);
          return;
        }

        const row: Record<string, any> = {
          id: folder.id,
          name: folder.name,
          updated_at: folder.updatedAt,
        };
        if (caps.folderColorColumn) row.color = folder.color ?? null;
        if (caps.folderDeletedColumn) row.deleted = !!folder.deleted;

        const { error } = await client.from('folders').upsert(row);
        if (error) {
          pushError = pushError ?? error;
          return;
        }
        folder.synced = true;
        succeededUpserts.push(folder);
      });

      await Promise.all(tasks);

      if (succeededUpserts.length > 0) {
        await saveFoldersToIDB(succeededUpserts);
      }
      if (hardDeletedIds.length > 0) {
        await purgeFoldersFromIDB(hardDeletedIds);
      }
      if (pushError) {
        throw pushError;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Pull remote notes & reconcile cross-device deletions
  // ---------------------------------------------------------------------------
  const freshLocalNotes = await getNotesFromIDB();
  const noteColumns = (() => {
    const cols = ['id', 'title', 'content', 'updated_at'];
    if (caps.noteFolderColumn) cols.push('folder_id');
    if (caps.notePinnedColumn) cols.push('pinned');
    if (caps.noteDeletedColumn) cols.push('deleted');
    return cols.join(',');
  })();

  const sinceNotes = lastNotesSyncTs > 0 ? Math.max(0, lastNotesSyncTs - SKEW_BUFFER_MS) : 0;
  const notesQuery = client.from('notes').select(noteColumns);
  const { data: remoteNotes, error: notesPullError } =
    sinceNotes > 0 ? await notesQuery.gt('updated_at', sinceNotes) : await notesQuery;

  if (notesPullError) {
    throw notesPullError;
  }

  let maxRemoteNoteTs = lastNotesSyncTs;
  if (remoteNotes && remoteNotes.length > 0) {
    const notesToSave: Note[] = [];
    for (const rNote of remoteNotes as any[]) {
      if (typeof rNote.updated_at === 'number' && rNote.updated_at > maxRemoteNoteTs) {
        maxRemoteNoteTs = rNote.updated_at;
      }
      const local = freshLocalNotes.find((n) => n.id === rNote.id);
      const remoteFolderId = caps.noteFolderColumn ? (rNote.folder_id ?? null) : null;
      const remotePinned = caps.notePinnedColumn ? !!rNote.pinned : false;
      const remoteDeleted = caps.noteDeletedColumn ? !!rNote.deleted : false;

      if (!local) {
        if (!remoteDeleted) {
          notesToSave.push({
            id: rNote.id,
            title: rNote.title,
            content: rNote.content,
            updatedAt: rNote.updated_at,
            synced: true,
            folderId: remoteFolderId,
            pinned: remotePinned,
          });
        }
      } else if (
        remoteDeleted &&
        !local.deleted &&
        (local.synced || local.updatedAt <= rNote.updated_at)
      ) {
        local.deleted = true;
        local.updatedAt = rNote.updated_at;
        local.synced = true;
        notesToSave.push(local);
      } else if (
        !local.deleted &&
        (local.synced ? local.updatedAt < rNote.updated_at : local.updatedAt < rNote.updated_at)
      ) {
        local.title = rNote.title;
        local.content = rNote.content;
        local.updatedAt = rNote.updated_at;
        local.folderId = remoteFolderId;
        local.pinned = remotePinned;
        local.deleted = remoteDeleted;
        local.synced = true;
        notesToSave.push(local);
      }
    }
    if (notesToSave.length > 0) {
      await saveNotesToIDB(notesToSave);
    }
  }
  lastNotesSyncTs = maxRemoteNoteTs;

  // When the Supabase `notes` table has no `deleted` tombstone column, reconcile
  // hard-deleted notes by comparing local synced notes against existing remote IDs.
  if (!caps.noteDeletedColumn) {
    const { data: remoteNoteIds, error: idError } = await client.from('notes').select('id');
    if (idError) {
      throw idError;
    }
    const remoteIdSet = new Set((remoteNoteIds ?? []).map((r: { id: string }) => r.id));
    const deletedRemotely = freshLocalNotes
      .filter((n) => n.synced && !n.deleted && !remoteIdSet.has(n.id))
      .map((n) => n.id);
    if (deletedRemotely.length > 0) {
      await purgeNotesFromIDB(deletedRemotely);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Pull remote folders & reconcile cross-device deletions
  // ---------------------------------------------------------------------------
  if (caps.foldersTable) {
    const freshLocalFolders = await getFoldersFromIDB();
    const folderColumns = (() => {
      const cols = ['id', 'name', 'updated_at'];
      if (caps.folderColorColumn) cols.push('color');
      if (caps.folderDeletedColumn) cols.push('deleted');
      return cols.join(',');
    })();

    const sinceFolders =
      lastFoldersSyncTs > 0 ? Math.max(0, lastFoldersSyncTs - SKEW_BUFFER_MS) : 0;
    const foldersQuery = client.from('folders').select(folderColumns);
    const { data: remoteFolders, error: foldersPullError } =
      sinceFolders > 0 ? await foldersQuery.gt('updated_at', sinceFolders) : await foldersQuery;

    if (foldersPullError) {
      throw foldersPullError;
    }

    let maxRemoteFolderTs = lastFoldersSyncTs;
    if (remoteFolders && remoteFolders.length > 0) {
      const foldersToSave: Folder[] = [];
      for (const rFolder of remoteFolders as any[]) {
        if (typeof rFolder.updated_at === 'number' && rFolder.updated_at > maxRemoteFolderTs) {
          maxRemoteFolderTs = rFolder.updated_at;
        }
        const local = freshLocalFolders.find((f) => f.id === rFolder.id);
        const remoteColor = caps.folderColorColumn ? rFolder.color ?? undefined : undefined;
        const remoteDeleted = caps.folderDeletedColumn ? !!rFolder.deleted : false;

        if (!local) {
          if (!remoteDeleted) {
            foldersToSave.push({
              id: rFolder.id,
              name: rFolder.name,
              color: remoteColor,
              updatedAt: rFolder.updated_at,
              synced: true,
            });
          }
        } else if (
          remoteDeleted &&
          !local.deleted &&
          (local.synced || local.updatedAt <= rFolder.updated_at)
        ) {
          local.deleted = true;
          local.updatedAt = rFolder.updated_at;
          local.synced = true;
          foldersToSave.push(local);
        } else if (!local.deleted && local.updatedAt < rFolder.updated_at) {
          local.name = rFolder.name;
          // Only adopt a remote colour when it actually exists, so we never
          // wipe a locally assigned colour.
          if (caps.folderColorColumn && remoteColor) local.color = remoteColor;
          local.deleted = remoteDeleted;
          local.updatedAt = rFolder.updated_at;
          local.synced = true;
          foldersToSave.push(local);
        }
      }
      if (foldersToSave.length > 0) {
        await saveFoldersToIDB(foldersToSave);
      }
    }
    lastFoldersSyncTs = maxRemoteFolderTs;

    if (!caps.folderDeletedColumn) {
      const { data: remoteFolderIds, error: idError } = await client.from('folders').select('id');
      if (idError) {
        throw idError;
      }
      const remoteIdSet = new Set((remoteFolderIds ?? []).map((r: { id: string }) => r.id));
      const deletedRemotely = freshLocalFolders
        .filter((f) => f.synced && !f.deleted && !remoteIdSet.has(f.id))
        .map((f) => f.id);
      if (deletedRemotely.length > 0) {
        await purgeFoldersFromIDB(deletedRemotely);
      }
    }
  }

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
