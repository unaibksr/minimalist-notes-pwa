import React, { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  AlignJustify,
  AlignLeft,
  Undo,
  Redo,
  Eraser,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Type,
} from 'lucide-react';
import { MarkdownPasteHandler } from '../lib/pasteHandler';

interface RichEditorProps {
  content: string;
  onChange: (content: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExportMarkdown: () => void;
  onCopyNote: () => void;
}

export const RichEditor: React.FC<RichEditorProps> = ({
  content,
  onChange,
  isFullscreen,
  onToggleFullscreen,
  onExportMarkdown,
  onCopyNote,
}) => {
  const [fontSize, setFontSize] = useState<number>(16);
  const [wordCount, setWordCount] = useState({ words: 0, chars: 0 });

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'justify',
      }),
      Placeholder.configure({
        placeholder: 'Start typing your note...',
      }),
      MarkdownPasteHandler,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-220px)] text-justify leading-relaxed',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    const updateCounts = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      setWordCount({ words, chars });
    };
    updateCounts();
    editor.on('update', updateCounts);
    return () => { editor.off('update', updateCounts); };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    if (isFullscreen) {
      editor.setEditable(false);
    } else {
      editor.setEditable(true);
    }
  }, [isFullscreen, editor]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleFullscreen();
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onExportMarkdown();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, onToggleFullscreen, onExportMarkdown]);

  if (!editor) return null;

  const cleanBlankLines = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const normalized = html.replace(/<p[^>]*>(?:\s|<br\s*\/?>)*<\/p>/gi, '<p></p>');
    const cleaned = normalized.replace(/(<p><\/p>\s*){2,}/gi, '<p></p>');
    if (html !== cleaned) {
      editor.commands.setContent(cleaned);
    }
  };

  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-zinc-900 p-6 overflow-y-auto' : ''}`}>
      {!isFullscreen && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 p-2 mb-4 border-b bg-white/80 dark:bg-zinc-900/80 backdrop-blur border-zinc-200 dark:border-zinc-800 rounded-lg">
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 1 }) ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive('heading', { level: 3 }) ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Heading 3"
        >
          <Heading3 size={18} />
        </button>

        <div className="w-px h-5 mx-1 bg-zinc-300 dark:bg-zinc-700" />

        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive('bold') ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Bold"
        >
          <Bold size={18} />
        </button>

        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive('italic') ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Italic"
        >
          <Italic size={18} />
        </button>

        <div className="w-px h-5 mx-1 bg-zinc-300 dark:bg-zinc-700" />

        <button
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Justify Text"
        >
          <AlignJustify size={18} />
        </button>

        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 ${editor.isActive({ textAlign: 'left' }) ? 'bg-zinc-200 dark:bg-zinc-700' : ''}`}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </button>

        <div className="w-px h-5 mx-1 bg-zinc-300 dark:bg-zinc-700" />

        <div className="flex items-center gap-1 px-1">
          <button
            onClick={() => setFontSize((s) => Math.max(12, s - 2))}
            className="px-2 py-1 text-xs border rounded border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Decrease Font Size"
          >
            A-
          </button>
          <span className="text-xs w-6 text-center">{fontSize}</span>
          <button
            onClick={() => setFontSize((s) => Math.min(32, s + 2))}
            className="px-2 py-1 text-xs border rounded border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Increase Font Size"
          >
            A+
          </button>
        </div>

        <div className="w-px h-5 mx-1 bg-zinc-300 dark:bg-zinc-700" />

        <button
          onClick={cleanBlankLines}
          className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
          title="Remove Extra Blank Lines"
        >
          <Eraser size={18} />
        </button>

        <div className="w-px h-5 mx-1 bg-zinc-300 dark:bg-zinc-700" />

        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
          title="Undo"
        >
          <Undo size={18} />
        </button>

        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40"
          title="Redo"
        >
          <Redo size={18} />
        </button>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={onCopyNote}
            className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Copy Note"
          >
            <Copy size={18} />
          </button>
          <button
            onClick={onExportMarkdown}
            className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Export Markdown"
          >
            <Download size={18} />
          </button>
          <button
            onClick={onToggleFullscreen}
            className="p-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Reading Mode'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>
      )}

      <div style={{ fontSize: `${fontSize}px` }} className="flex-1 w-full max-w-full">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between px-2 py-2 text-xs text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-1">
          <Type size={12} />
          <span>{wordCount.words} words</span>
        </div>
        <div>
          <span>{wordCount.chars} characters</span>
        </div>
      </div>
    </div>
  );
};
