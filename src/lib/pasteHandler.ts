import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { markdownToHtml, hasMarkdown } from './markdownToHtml';

const BOLD_WEIGHT_RE = /font-weight\s*:\s*(bold|bolder|[6-9]\d{2})/i;
const NORMAL_WEIGHT_RE = /font-weight\s*:\s*(normal|lighter|[1-5]\d{2})/i;
const ITALIC_STYLE_RE = /font-style\s*:\s*italic/i;

const unwrapElement = (el: Element) => {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
};

const replaceTag = (el: Element, newTag: string): Element => {
  const replacement = el.ownerDocument.createElement(newTag);
  while (el.firstChild) replacement.appendChild(el.firstChild);
  el.parentNode?.replaceChild(replacement, el);
  return replacement;
};

/**
 * Normalizes rich HTML copied from Gemini / ChatGPT / mobile browsers so
 * headings, bold, italic, and lists map cleanly onto TipTap's schema without
 * carrying over source website styles or wrapper artifacts.
 */
const cleanPastedHtml = (rawHtml: string): string => {
  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
  const body = doc.body;

  // Remove scripts, styles, and meta tags
  body.querySelectorAll('script, style, meta, link').forEach((el) => el.remove());

  // Convert ARIA headings (used by some web apps) to real <h1>–<h6>
  body.querySelectorAll('[role="heading"]').forEach((el) => {
    const level = Math.min(6, Math.max(1, Number(el.getAttribute('aria-level')) || 2));
    replaceTag(el, `h${level}`);
  });

  // Unwrap Google/Android wrapper <b style="font-weight: normal">
  body.querySelectorAll('b').forEach((el) => {
    const style = el.getAttribute('style') || '';
    if (NORMAL_WEIGHT_RE.test(style)) {
      unwrapElement(el);
    }
  });

  // Convert styled <span> elements (font-weight: 600+/bold, font-style: italic)
  body.querySelectorAll('span').forEach((span) => {
    const style = span.getAttribute('style') || '';
    const isBold = BOLD_WEIGHT_RE.test(style);
    const isItalic = ITALIC_STYLE_RE.test(style);
    if (isBold && isItalic) {
      const strong = doc.createElement('strong');
      const em = doc.createElement('em');
      while (span.firstChild) em.appendChild(span.firstChild);
      strong.appendChild(em);
      span.parentNode?.replaceChild(strong, span);
    } else if (isBold) {
      replaceTag(span, 'strong');
    } else if (isItalic) {
      replaceTag(span, 'em');
    }
  });

  // Convert <b> to <strong> and <i> to <em>
  body.querySelectorAll('b').forEach((el) => replaceTag(el, 'strong'));
  body.querySelectorAll('i').forEach((el) => replaceTag(el, 'em'));

  // Android/Chrome clipboard often wraps lines in <div> instead of <p>
  body.querySelectorAll('div').forEach((div) => {
    if (!div.querySelector('p, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, pre, div')) {
      replaceTag(div, 'p');
    } else {
      unwrapElement(div);
    }
  });

  // Strip noisy inline styles/classes so the app's own heading & bold styles apply
  body.querySelectorAll('*').forEach((el) => {
    el.removeAttribute('class');
    el.removeAttribute('style');
  });

  // Remove empty spacer paragraphs (<p></p> or <p><br></p>)
  body.querySelectorAll('p').forEach((p) => {
    if (!p.textContent?.trim() && !p.querySelector('img, table, hr')) {
      p.remove();
    }
  });

  return body.innerHTML.trim();
};

export const MarkdownPasteHandler = Extension.create({
  name: 'markdownPasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPasteHandler'),
        props: {
          handlePaste: (view, event) => {
            const clipboard = event.clipboardData;
            if (!clipboard) return false;

            const plain = clipboard.getData('text/plain');
            const rawHtml = clipboard.getData('text/html');

            // 1. Prefer Markdown conversion when plain text contains Markdown syntax
            //    (e.g. tapping the "Copy" button in Gemini / ChatGPT).
            if (plain && plain.trim() && hasMarkdown(plain)) {
              event.preventDefault();
              const html = markdownToHtml(plain);
              view.pasteHTML(html, event);
              return true;
            }

            // 2. Otherwise, if rich HTML is present (e.g. selecting & copying
            //    from Gemini or a webpage on mobile), normalize its headings/bold.
            if (rawHtml && rawHtml.trim()) {
              const cleaned = cleanPastedHtml(rawHtml);
              if (cleaned) {
                event.preventDefault();
                view.pasteHTML(cleaned, event);
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },
});
