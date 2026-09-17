/**
 * Markdown → HTML conversion for notes. It runs when Markdown is pasted into
 * the editor and when the "Render Markdown" toolbar action is used.
 *
 * Two properties matter here:
 *  1. Literal characters are HTML-escaped before any markup is added, so text
 *     such as `5 < 10` or a copied `<div>` arrives as text and never as tags.
 *  2. Code spans are held aside while emphasis is applied, so `**literal**`
 *     inside backticks is not expanded.
 *
 * Math support: $...$ inline and $$...$$ block math blocks are rendered
 * using KaTeX, with \text{...} commands removed (their content is treated as
 * regular math text).
 */

import katex from 'katex';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);

/** Placeholder marker used to park fragments that later passes must not touch. */
const HOLD = '\u0000';
const HOLD_RE = /\u0000(\d+)\u0000/g;

/** A tab stop counts as four columns, as in CommonMark. */
const indentWidth = (whitespace: string): number =>
  whitespace.replace(/\t/g, '    ').length;

/** Render a math expression using KaTeX. */
const renderMath = (mathContent: string, inline: boolean): string => {
  try {
    const processed = mathContent.replace(
      /\\([a-zA-Z]{2,})/g,
      (_match, name: string) => {
        const known = new Set([
          'text', 'frac', 'sqrt', 'frac', 'overline', 'underline',
          'overline', 'tilde', 'hat', 'vec', 'bar', 'dot', 'ddot',
          'acute', 'grave', 'check', 'breve', 'underline',
          'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta',
          'theta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi',
          'rho', 'sigma', 'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
          'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma',
          'Upsilon', 'Phi', 'Psi', 'Omega',
          'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos',
          'arctan', 'sinh', 'cosh', 'tanh', 'log', 'ln', 'lim', 'min',
          'max', 'sum', 'prod', 'int', 'oint', 'det', 'dim', 'hom',
          'ker', 'exp', 'gcd', 'lcm', 'mod', 'deg', 'Pr',
          'leq', 'geq', 'neq', 'approx', 'sim', 'cong', 'in', 'ni',
          'subset', 'supset', 'subseteq', 'supseteq', 'perp',
          'parallel', 'cdot', 'times', 'div', 'pm', 'mp',
          'infty', 'partial', 'nabla', 'infty',
          'Rightarrow', 'Leftarrow', 'Leftrightarrow', 'Longrightarrow',
          'Longrightarrow', 'Rightarrow', 'leftrightarrow',
        ]);
        if (known.has(name)) return _match;
        return name;
      }
    );
    return katex.renderToString(processed.trim(), {
      throwOnError: false,
      displayMode: !inline,
      output: 'html',
      trust: true,
    });
  } catch {
    return escapeHtml(mathContent);
  }
};

/** Extracts math blocks from text and provides a restore function. */
const extractMath = (text: string): { textWithoutMath: string; restoreMath: (html: string) => string } => {
  interface MathBlock {
    type: 'block' | 'inline';
    content: string;
    index: number;
  }

  const mathBlocks: MathBlock[] = [];
  let processed = text;

  // Extract block math ($$...$$) first
  processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_match, content) => {
    // Remove \text{...} wrappers
    const processedContent = content.replace(/\\text\{(.*?)\}/g, '$1');
    const idx = mathBlocks.length;
    mathBlocks.push({ type: 'block', content: processedContent, index: idx });
    return `\u0003${idx}\u0003`;
  });

  // Then extract inline math ($...$)
  processed = processed.replace(/\$(.*?)\$/g, (_match, content) => {
    // Remove \text{...} wrappers
    const processedContent = content.replace(/\\text\{(.*?)\}/g, '$1');
    const idx = mathBlocks.length;
    mathBlocks.push({ type: 'inline', content: processedContent, index: idx });
    return `\u0004${idx}\u0004`;
  });

  const restoreMath = (html: string): string => {
    let result = html;
    for (let i = 0; i < mathBlocks.length; i++) {
      const block = mathBlocks[i];
      const rendered = renderMath(block.content, block.type === 'inline');
      result = result.replace(new RegExp(`\\u0003${i}\\u0003`, 'g'), rendered);
      result = result.replace(new RegExp(`\\u0004${i}\\u0004`, 'g'), rendered);
    }
    return result;
  };

  return { textWithoutMath: processed, restoreMath };
};

/** Converts the inline syntax of one line: escapes, code, then emphasis. */
const inline = (line: string): string => {
  const held: string[] = [];
  const hold = (html: string): string => {
    held.push(html);
    return `${HOLD}${held.length - 1}${HOLD}`;
  };

  // Backslash escapes: \* is a literal asterisk, not the start of emphasis.
  let out = line.replace(/\\([\\`*_{}[\]()#+\-.!~>])/g, (_match, ch: string) =>
    hold(escapeHtml(ch))
  );

  // Code spans are converted first and parked, so the emphasis passes below
  // cannot reach inside them.
  out = out.replace(/`([^`\n]+)`/g, (_match, code: string) =>
    hold(`<code>${escapeHtml(code)}</code>`)
  );

  // Links and images are deliberately left as text: the editor schema has no
  // link mark or image node, so converting them to <a>/<img> would make
  // ProseMirror drop the destination (or the whole node) on the floor.
  // Keeping the Markdown text at least keeps the URL visible.

  // Everything that is left is literal text.
  out = escapeHtml(out);

  // Emphasis. Strong and strike run before emphasis, and a delimiter may not be
  // followed (or preceded) by whitespace, so plain arithmetic like "5 * 3 * 2"
  // is left alone.
  out = out.replace(/\*\*(\S(?:[^*]*\S)?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__(\S(?:[^_]*\S)?)__/g, '<strong>$1</strong>');
  out = out.replace(/~~(\S(?:[^~]*\S)?)~~/g, '<s>$1</s>');
  out = out.replace(/(^|[^\w*])\*(\S(?:[^*]*\S)?)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^\w_])_(\S(?:[^_]*\S)?)_(?!\w)/g, '$1<em>$2</em>');

  // Restore placeholders in reverse order: first held (escape placeholders
  // are \u0000, math placeholders use \u0003/\u0004 which survive escapeHtml).
  out = out.replace(HOLD_RE, (_match, index: string) => held[Number(index)] ?? '');

  return out;
};

/** One level of the list stack used while parsing block structure. */
interface ListFrame {
  indent: number;
  tag: 'ul' | 'ol';
  itemOpen: boolean;
}

/**
 * Renders markdown to HTML, including LaTeX math expressions using KaTeX.
 * \text{...} commands inside math are removed, treating their content as
 * regular math text (which will be italicized and have spaces ignored).
 */
export const markdownToHtml = (text: string): string => {
  if (!text || !text.trim()) return '';

  // First, extract math blocks and replace with placeholders
  const { textWithoutMath, restoreMath } = extractMath(text);

  // Then process the remaining markdown
  const lines = textWithoutMath.replace(/\r\n?/g, '\n').split('\n');
  const html: string[] = [];
  const lists: ListFrame[] = [];
  const paragraph: string[] = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(`<p>${paragraph.join('<br>')}</p>`);
    paragraph.length = 0;
  };

  const closeFrame = (frame: ListFrame) => {
    if (frame.itemOpen) html.push('</li>');
    html.push(`</${frame.tag}>`);
  };

  const closeLists = () => {
    while (lists.length) closeFrame(lists.pop()!);
  };

  /**
   * Starts (or continues) a list item. Nested items open a child list inside
   * the item that is still open, which is what makes indented sub-bullets —
   * and the indentation turndown writes when exporting — round-trip.
   */
  const openListItem = (
    tag: 'ul' | 'ol',
    indent: number,
    content: string,
    start: number
  ) => {
    // Close frames that cannot hold the new item: shallower ones, and a sibling
    // list of the other type. A bullet list directly followed by a numbered
    // list is a new list, not a nested one.
    while (lists.length) {
      const top = lists[lists.length - 1];
      const isSiblingOfOtherType = indent === top.indent && top.tag !== tag;
      if (indent < top.indent || isSiblingOfOtherType) {
        closeFrame(lists.pop()!);
      } else {
        break;
      }
    }

    let frame = lists[lists.length - 1];
    if (!frame || indent > frame.indent || frame.tag !== tag) {
      html.push(
        tag === 'ol' && start > 1 ? `<ol start="${start}">` : `<${tag}>`
      );
      frame = { indent, tag, itemOpen: false };
      lists.push(frame);
    }

    if (frame.itemOpen) html.push('</li>');
    html.push(`<li>${inline(content)}`);
    frame.itemOpen = true;
  };

  while (index < lines.length) {
    const line = lines[index];

    // Fenced code block: ``` or ~~~, optionally with a language hint. The whole
    // block is taken verbatim, so Markdown inside it is not interpreted.
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w+#.-]*)\s*$/);
    if (fence) {
      flushParagraph();
      closeLists();
      const closingFence = new RegExp(
        `^\\s*${fence[1][0]}{${fence[1].length},}\\s*$`
      );
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !closingFence.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1; // Consume the closing fence.
      const language = fence[2];
      html.push(
        `<pre><code${
          language ? ` class="language-${escapeHtml(language)}"` : ''
        }>${escapeHtml(code.join('\n'))}</code></pre>`
      );
      continue;
    }

    if (!line.trim()) {
      // A blank line ends the current paragraph but not the list: Markdown
      // allows blank lines between the items of a loose list, and turndown
      // writes one when it exports a list item that holds a paragraph or a
      // nested list. Any non-list block below closes the list instead.
      flushParagraph();
      index += 1;
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeLists();
      const level = heading[1].length;
      const text = heading[2].replace(/\s+#+\s*$/, ''); // Closing hashes.
      html.push(`<h${level}>${inline(text)}</h${level}>`);
      index += 1;
      continue;
    }

    // Horizontal rule: three or more -, * or _ (optionally space separated).
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flushParagraph();
      closeLists();
      html.push('<hr>');
      index += 1;
      continue;
    }

    // Consecutive quote lines form one blockquote, not one per line.
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeLists();
      const quoted: string[] = [quote[1]];
      index += 1;
      while (index < lines.length) {
        const next = lines[index].match(/^\s*>\s?(.*)$/);
        if (!next) break;
        quoted.push(next[1]);
        index += 1;
      }
      html.push(
        `<blockquote><p>${quoted.map(inline).join('<br>')}</p></blockquote>`
      );
      continue;
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      openListItem('ul', indentWidth(bullet[1]), bullet[2], 1);
      index += 1;
      continue;
    }

    const ordered = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      flushParagraph();
      openListItem('ol', indentWidth(ordered[1]), ordered[3], Number(ordered[2]));
      index += 1;
      continue;
    }

    // Plain text: consecutive lines join into one paragraph, keeping the line
    // breaks the user typed as <br>.
    closeLists();
    paragraph.push(inline(line));
    index += 1;
  }

  flushParagraph();
  closeLists();

  const result = html.join('');
  return restoreMath(result);
};

/**
 * Reports whether the text contains anything the converter can act on. Used to
 * leave ordinary notes alone when they are pasted or run through
 * "Render Markdown".
 */
export const hasMarkdown = (text: string): boolean =>
  new RegExp(
    [
      // Inline syntax.
      '\\*\\*|__|~~|`{3,}|~{3,}',
      // Emphasis, using the same "no space after the opener / before the
      // closer" rule as the converter so identifiers such as user_name_and_file
      // are not mistaken for Markdown.
      '(?:^|[^\\w*])\\*[^\\s*](?:[^*]*[^\\s*])?\\*',
      '(?:^|[^\\w_])_[^\\s_](?:[^_]*[^\\s_])?_(?!\\w)',
      // Math: $...$ or $$...$$ patterns
      '\\$[^$]+\\$',
      '\\$\\$[^$]+\\$\\$',
      // Blocks: headings, quotes, bullets, numbered items and rules.
      '^[ \\t]{0,3}#{1,6}[ \\t]',
      '^[ \\t]*>[ \\t]',
      '^[ \\t]*[-*+][ \\t]',
      '^[ \\t]*\\d+[.)][ \\t]',
      '^[ \\t]{0,3}([-*_])([ \\t]*\\1){2,}[ \\t]*$',
    ].join('|'),
    'm'
  ).test(text);