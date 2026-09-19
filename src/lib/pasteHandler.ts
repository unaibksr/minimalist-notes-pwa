import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { markdownToHtml, hasMarkdown } from './markdownToHtml';

export const MarkdownPasteHandler = Extension.create({
  name: 'markdownPasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPasteHandler'),
        props: {
          handlePaste: (_view, event) => {
            const text = event.clipboardData?.getData('text/plain');
            if (!text || !text.trim()) return false;
            if (!hasMarkdown(text)) return false;

            event.preventDefault();
            const html = markdownToHtml(text);
            this.editor.commands.insertContent(html);
            return true;
          },
        },
      }),
    ];
  },
});
