import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const MarkdownPasteHandler = Extension.create({
  name: 'markdownPasteHandler',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('markdownPasteHandler'),
        props: {
          handlePaste(_view, event) {
            const text = event.clipboardData?.getData('text/plain');
            if (!text) return false;

            const isMarkdown = /(^#|\*\*|__|\*|_|- |\d+\. |```)/m.test(text);
            if (!isMarkdown) return false;

            const lines = text.split('\n');
            lines
              .map((line) => {
                if (line.startsWith('# ')) return `<h1>${line.replace('# ', '')}</h1>`;
                if (line.startsWith('## ')) return `<h2>${line.replace('## ', '')}</h2>`;
                if (line.startsWith('### ')) return `<h3>${line.replace('### ', '')}</h3>`;
                let parsedLine = line
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>');
                return `<p>${parsedLine}</p>`;
              })
              .join('');

            return false;
          },
        },
      }),
    ];
  },
});
