export interface Note {
  id: string;
  title: string;
  content: string; // HTML string
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;
  folderId?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  color?: string;
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;
}

export type Theme = 'light' | 'dark';

export type FolderFilter = 'all' | 'unfiled' | string;
