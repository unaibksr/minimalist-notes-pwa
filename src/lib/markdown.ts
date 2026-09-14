import TurndownService from 'turndown';

const turndown = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
});

turndown.addRule('underline', {
  filter: ['u'],
  replacement: (content) => content,
});

export const htmlToMarkdown = (html: string): string => {
  if (!html || !html.trim()) return '';
  try {
    return turndown.turndown(html).trim();
  } catch {
    return html.replace(/<[^>]*>/g, '').trim();
  }
};

export const htmlToPlainText = (html: string): string => {
  if (!html) return '';
  return html
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/div)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
