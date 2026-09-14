export interface FolderColorClasses {
  dot: string;
  soft: string;
  active: string;
}

/**
 * Fixed palette. Class strings are written out literally so Tailwind's scanner
 * includes them in the build.
 */
const PALETTE: Record<string, FolderColorClasses> = {
  amber: {
    dot: 'bg-amber-500',
    soft: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    active:
      'bg-amber-600 border-amber-600 text-white dark:bg-amber-500 dark:border-amber-500 dark:text-amber-950',
  },
  rose: {
    dot: 'bg-rose-500',
    soft: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    active: 'bg-rose-600 border-rose-600 text-white dark:bg-rose-500 dark:border-rose-500 dark:text-rose-950',
  },
  sky: {
    dot: 'bg-sky-500',
    soft: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    active: 'bg-sky-600 border-sky-600 text-white dark:bg-sky-500 dark:border-sky-500 dark:text-sky-950',
  },
  emerald: {
    dot: 'bg-emerald-500',
    soft: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    active:
      'bg-emerald-600 border-emerald-600 text-white dark:bg-emerald-500 dark:border-emerald-500 dark:text-emerald-950',
  },
  violet: {
    dot: 'bg-violet-500',
    soft: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    active:
      'bg-violet-600 border-violet-600 text-white dark:bg-violet-500 dark:border-violet-500 dark:text-violet-950',
  },
  orange: {
    dot: 'bg-orange-500',
    soft: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    active:
      'bg-orange-600 border-orange-600 text-white dark:bg-orange-500 dark:border-orange-500 dark:text-orange-950',
  },
  teal: {
    dot: 'bg-teal-500',
    soft: 'bg-teal-500/15 text-teal-700 dark:text-teal-300',
    active: 'bg-teal-600 border-teal-600 text-white dark:bg-teal-500 dark:border-teal-500 dark:text-teal-950',
  },
  pink: {
    dot: 'bg-pink-500',
    soft: 'bg-pink-500/15 text-pink-700 dark:text-pink-300',
    active: 'bg-pink-600 border-pink-600 text-white dark:bg-pink-500 dark:border-pink-500 dark:text-pink-950',
  },
  indigo: {
    dot: 'bg-indigo-500',
    soft: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300',
    active:
      'bg-indigo-600 border-indigo-600 text-white dark:bg-indigo-500 dark:border-indigo-500 dark:text-indigo-950',
  },
  lime: {
    dot: 'bg-lime-500',
    soft: 'bg-lime-500/15 text-lime-700 dark:text-lime-300',
    active: 'bg-lime-600 border-lime-600 text-white dark:bg-lime-500 dark:border-lime-500 dark:text-lime-950',
  },
};

export const FOLDER_COLOR_KEYS = Object.keys(PALETTE);
export const DEFAULT_FOLDER_COLOR = 'amber';

export const folderColorClasses = (key?: string | null): FolderColorClasses =>
  PALETTE[key ?? ''] ?? PALETTE[DEFAULT_FOLDER_COLOR];

/** Picks the first unused palette colour, falling back to round-robin. */
export const pickFolderColor = (usedColors: Array<string | undefined | null>): string => {
  const used = new Set(usedColors.filter(Boolean) as string[]);
  const free = FOLDER_COLOR_KEYS.find((key) => !used.has(key));
  return free ?? FOLDER_COLOR_KEYS[used.size % FOLDER_COLOR_KEYS.length];
};

export const normalizeFolderColor = (key?: string | null): string =>
  key && PALETTE[key] ? key : DEFAULT_FOLDER_COLOR;
