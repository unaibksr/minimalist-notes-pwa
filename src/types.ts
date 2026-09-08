export interface Note {
  id: string;
  title: string;
  content: string; // HTML string
  updatedAt: number;
  synced: boolean;
  deleted?: boolean;
}

export type Theme = 'light' | 'dark';
