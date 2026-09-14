const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Escapes the input and wraps case-insensitive matches of `query` in <mark>.
 * Safe to pass to dangerouslySetInnerHTML: all text is escaped before markup
 * is added, so note content can never inject HTML.
 */
export const highlightText = (text: string, query: string): string => {
  const q = query.trim();
  if (!q) return escapeHtml(text);
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  return parts
    .map((part, index) =>
      index % 2 === 1
        ? `<mark class="bg-amber-200 dark:bg-amber-900/40 text-cream-800 dark:text-amber-200 rounded px-0.5">${escapeHtml(part)}</mark>`
        : escapeHtml(part)
    )
    .join('');
};
