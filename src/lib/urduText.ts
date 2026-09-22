import { Mark } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    urdu: {
      setUrdu: () => ReturnType;
      toggleUrdu: () => ReturnType;
    };
  }
}

export const UrduText = Mark.create({
  name: 'urdu',

  addAttributes() {
    return {};
  },

  parseHTML() {
    return [{ tag: 'span[data-urdu]' }];
  },

  renderHTML() {
    return ['span', { 'data-urdu': true, class: 'urdu-text' }, 0];
  },

  addCommands() {
    return {
      setUrdu:
        () =>
        ({ chain }: { chain: any }) => {
          return chain().focus().toggleMark(this.name).run();
        },
      toggleUrdu:
        () =>
        ({ chain }: { chain: any }) => {
          return chain().focus().toggleMark(this.name).run();
        },
    };
  },
});
