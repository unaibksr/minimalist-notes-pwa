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

/**
 * GitHub-flavoured strikethrough. TipTap's strike mark renders as <s>, and
 * <del>/<strike> can arrive from pasted HTML; turndown has no rule for any of
 * them, so without this the markers would be dropped on export.
 */
turndown.addRule('strikethrough', {
  // A filter function rather than ['s', 'del', 'strike']: TypeScript's
  // HTMLElementTagNameMap no longer lists the obsolete <strike> element.
  filter: (node) => ['S', 'DEL', 'STRIKE'].includes(node.nodeName),
  replacement: (content) => (content.trim() ? `~~${content}~~` : ''),
});

/**
 * A <pre> without an inner <code> is not covered by turndown's fenced-code
 * rule, so fence its text explicitly instead of flattening the block.
 */
turndown.addRule('barePre', {
  filter: (node) =>
    node.nodeName === 'PRE' &&
    !(node.firstChild && node.firstChild.nodeName === 'CODE'),
  replacement: (_content, node) => {
    const code = (node.textContent ?? '').replace(/\n$/, '');
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  },
});

export const htmlToMarkdown = (html: string): string => {
  if (!html || !html.trim()) return '';
  try {
    // Turndown indents the newline that closes a <li><p>…</p></li>, leaving
    // lines that hold nothing but spaces; dropping them keeps the exported
    // Markdown clean. Lines with a hard-break marker ("text  ") keep their
    // trailing spaces because they are not empty.
    return turndown
      .turndown(html)
      .replace(/^[ \t]+$/gm, '')
      .trim();
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
