import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

interface TextSegment {
  start: number;
  end: number;
  pos: number;
}

const COLON_SEGMENT_RE = /[^\n.!?;:\uFFFC]+:(?=\s|$)/g;

function mapOffsetToPos(segments: TextSegment[], offset: number, isEnd: boolean): number | null {
  for (const seg of segments) {
    if (isEnd ? offset > seg.start && offset <= seg.end : offset >= seg.start && offset < seg.end) {
      return seg.pos + (offset - seg.start);
    }
  }
  return null;
}

function buildColonDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name === 'codeBlock' || node.type.name === 'heading') {
      return false;
    }
    if (!node.isTextblock) {
      return true;
    }

    let text = '';
    const segments: TextSegment[] = [];

    node.forEach((child, offset) => {
      const childPos = pos + 1 + offset;
      if (child.isText && child.text) {
        const hasCodeMark = child.marks.some((m) => m.type.name === 'code');
        if (hasCodeMark) {
          text += '\uFFFC'.repeat(child.text.length);
        } else {
          segments.push({
            start: text.length,
            end: text.length + child.text.length,
            pos: childPos,
          });
          text += child.text;
        }
      } else {
        text += '\n';
      }
    });

    if (!text.includes(':')) {
      return false;
    }

    COLON_SEGMENT_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = COLON_SEGMENT_RE.exec(text)) !== null) {
      const raw = match[0];
      const leadingSpaces = raw.length - raw.trimStart().length;
      const matchStart = match.index + leadingSpaces;
      const matchEnd = match.index + raw.length;
      if (matchStart >= matchEnd) continue;

      const from = mapOffsetToPos(segments, matchStart, false);
      const to = mapOffsetToPos(segments, matchEnd, true);
      if (from !== null && to !== null && from < to) {
        decorations.push(Decoration.inline(from, to, { class: 'colon-lead' }));
      }
    }

    return false;
  });

  return DecorationSet.create(doc, decorations);
}

export const ColonHighlight = Extension.create({
  name: 'colonHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('colonHighlight'),
        state: {
          init(_config, state) {
            return buildColonDecorations(state.doc);
          },
          apply(tr, oldSet) {
            if (!tr.docChanged) {
              return oldSet;
            }
            return buildColonDecorations(tr.doc);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
