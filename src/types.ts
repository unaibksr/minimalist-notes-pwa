export interface Note {
  id: string;
  title: string;
  content: string; // HTML string
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;
  folderId?: string | null;
  pinned?: boolean;
  tags?: string[];
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;
}

export type Theme = 'light' | 'dark' | 'system';

export type FolderFilter = 'all' | 'unfiled' | string;
