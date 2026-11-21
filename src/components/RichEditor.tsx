import React, { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import { MarkdownPasteHandler } from '../lib/pasteHandler';
import { markdownToHtml, hasMarkdown } from '../lib/markdownToHtml';
import { UrduText } from '../lib/urduText';
import { NoteImage, compressImageToDataUrl } from '../lib/noteImage';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  AlignJustify,
  AlignCenter,
  AlignLeft,
  Undo,
  Redo,
  Eraser,
  Maximize2,
  Minimize2,
  Download,
  Copy,
  Type,
  ArrowLeft,
  List,
  ListOrdered,
  Quote,
  Table2,
  Sigma,
  Sparkles,
  Code,
  Code2,
  Underline as UnderlineIcon,
  Strikethrough,
  Link2,
  Image as ImageIcon,
  Eye,
  Trash2,
  Plus,
} from 'lucide-react';

interface RichEditorProps {
  noteId: string;
  content: string;
  onChange: (content: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onExportMarkdown: () => void;
  onCopyNote: () => void;
}

interface WordCount {
  words: number;
  chars: number;
  minutes: number;
}

const FONT_SIZE_KEY = 'notes-font-size';

const getInitialFontSize = (): number => {
  try {
    const saved = Number(localStorage.getItem(FONT_SIZE_KEY));
    if (saved >= 12 && saved <= 32) return saved;
  } catch {
    // ignore storage errors
  }
  return 16;
};

export const RichEditor: React.FC<RichEditorProps> = ({
  noteId,
  content,
  onChange,
  isFullscreen,
  onToggleFullscreen,
  onExportMarkdown,
  onCopyNote,
}) => {
  const [fontSize, setFontSize] = useState<number>(getInitialFontSize);
  const [wordCount, setWordCount] = useState<WordCount>({ words: 0, chars: 0, minutes: 0 });
  const [showMathMenu, setShowMathMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [inTable, setInTable] = useState(false);

  const loadedNoteId = useRef<string | null>(null);
  const mathMenuRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const insertImageFile = async (file: File, targetEditor: ReturnType<typeof useEditor>) => {
    if (!targetEditor || !file.type.startsWith('image/')) return;
    try {
      const src = await compressImageToDataUrl(file);
      targetEditor.chain().focus().setNoteImage({ src, alt: file.name }).run();
    } catch (err) {
      console.warn('Image insert failed', err);
    }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Underline,
      Strike,
      NoteImage,
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
        defaultAlignment: 'justify',
      }),
      Placeholder.configure({
        placeholder: 'Start typing your note...',
      }),
      MarkdownPasteHandler,
      UrduText,
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setInTable(ed.isActive('table'));
    },
    editorProps: {
      attributes: {
        class:
          'tiptap max-w-none focus:outline-none min-h-[calc(100vh-260px)] text-justify leading-relaxed text-cream-800 dark:text-gray-100',
      },
      handlePaste: (view, event) => {
        const hasTextOrHtml = Boolean(
          event.clipboardData?.getData('text/plain') ||
            event.clipboardData?.getData('text/html')
        );
        if (hasTextOrHtml) return false;

        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              event.preventDefault();
              compressImageToDataUrl(file).then((src) => {
                const { state, dispatch } = view;
                const node = state.schema.nodes.image?.create({ src, alt: file.name });
                if (node) dispatch(state.tr.replaceSelectionWith(node));
              });
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
        if (!imageFile) return false;
        event.preventDefault();
        compressImageToDataUrl(imageFile).then((src) => {
          const { state, dispatch } = view;
          const node = state.schema.nodes.image?.create({ src, alt: imageFile.name });
          if (node) dispatch(state.tr.replaceSelectionWith(node));
        });
        return true;
      },
    },
  });

  useEffect(() => {
    try {
      localStorage.setItem(FONT_SIZE_KEY, String(fontSize));
    } catch {
      // ignore storage errors
    }
  }, [fontSize]);

  useEffect(() => {
    if (!editor) return;
    if (loadedNoteId.current !== noteId) {
      loadedNoteId.current = noteId;
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content, false);
      }
      return;
    }
    if (!editor.isFocused && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor, noteId]);

  const insertInlineMath = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('$...$').run();
    setShowMathMenu(false);
  };

  const insertBlockMath = () => {
    if (!editor) return;
    editor.chain().focus().insertContent('$$...$$').run();
    setShowMathMenu(false);
  };

  const insertCommonMath = (template: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(template).run();
    setShowMathMenu(false);
  };

  const insertTable = (rows: number, cols: number) => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
    setShowTableMenu(false);
  };

  const cleanBlankLines = () => {
    if (!editor) return;
    const html = editor.getHTML();
    const normalized = html.replace(/<p[^>]*>(?:\s|<br\s*\/?>)*<\/p>/gi, '<p></p>');
    const cleaned = normalized.replace(/(<p><\/p>\s*){2,}/gi, '<p></p>');
    if (html !== cleaned) {
      editor.commands.setContent(cleaned);
    }
  };

  const renderMarkdown = () => {
    if (!editor) return;
    const text = editor.getText();
    if (!text.trim() || !hasMarkdown(text)) return;
    const html = markdownToHtml(text);
    editor.commands.setContent(html, false);
  };

  const toggleUrduText = () => {
    if (!editor) return;
    if (editor.isActive('urdu')) {
      editor.chain().focus().unsetMark('urdu').setTextAlign('justify').run();
    } else {
      editor.chain().focus().setMark('urdu').setTextAlign('right').run();
    }
  };

  const handleAddLink = () => {
    if (!editor) return;
    const prevUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Enter URL (leave empty to remove link):', prevUrl);
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const href = /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/') ? trimmed : `https://${trimmed}`;
    editor.chain().focus().setLink({ href }).run();
  };

  const decreaseFontSize = () => setFontSize((s) => Math.max(12, s - 2));
  const increaseFontSize = () => setFontSize((s) => Math.min(32, s + 2));
  const resetFontSize = () => setFontSize(16);

  // Font-size keyboard shortcuts (Ctrl+Shift+[ / ])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        if (e.key === '[' || e.key === '{') {
          e.preventDefault();
          decreaseFontSize();
        } else if (e.key === ']' || e.key === '}') {
          e.preventDefault();
          increaseFontSize();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!editor) return;
    const updateCounts = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      const minutes = words === 0 ? 0 : Math.max(1, Math.ceil(words / 275));
      setWordCount({ words, chars, minutes });
    };
    updateCounts();
    editor.on('update', updateCounts);
    return () => {
      editor.off('update', updateCounts);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isFullscreen);
  }, [isFullscreen, editor]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleFullscreen();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, onToggleFullscreen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showMathMenu && mathMenuRef.current && !mathMenuRef.current.contains(e.target as Node)) {
        setShowMathMenu(false);
      }
      if (showTableMenu && tableMenuRef.current && !tableMenuRef.current.contains(e.target as Node)) {
        setShowTableMenu(false);
      }
      if (showMoreOptions && moreOptionsRef.current && !moreOptionsRef.current.contains(e.target as Node)) {
        setShowMoreOptions(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMathMenu(false);
        setShowTableMenu(false);
        setShowMoreOptions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', onKey);
    };
  }, [showMathMenu, showTableMenu, showMoreOptions]);

  if (!editor) return null;

  const toolBtn = (active = false) =>
    `p-2 rounded transition-colors hover:bg-cream-200 dark:hover:bg-navy-800 ${
      active ? 'bg-cream-300 dark:bg-navy-700' : ''
    }`;

  return (
    <div
      className={`flex flex-col flex-1 min-h-0 ${
        isFullscreen ? 'fixed inset-0 z-50 bg-cream-50 dark:bg-navy-950 book-page' : ''
      }`}
    >
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) insertImageFile(file, editor);
          e.target.value = '';
        }}
      />

      {!isFullscreen && (
        <div className="shrink-0 bg-transparent border-b border-cream-300 dark:border-navy-600">
          <div className="px-4 md:px-12 py-2">
            <div className="flex flex-wrap items-center gap-0.5 p-1.5 border border-cream-300 dark:border-navy-600 bg-cream-100/75 dark:bg-navy-900 rounded-xl shadow-sm">
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={toolBtn(editor.isActive('heading', { level: 1 }))}
                title="Heading 1"
                aria-label="Heading 1"
              >
                <Heading1 size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={toolBtn(editor.isActive('heading', { level: 2 }))}
                title="Heading 2"
                aria-label="Heading 2"
              >
                <Heading2 size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={toolBtn(editor.isActive('heading', { level: 3 }))}
                title="Heading 3"
                aria-label="Heading 3"
              >
                <Heading3 size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                className={toolBtn(editor.isActive('heading', { level: 4 }))}
                title="Heading 4"
                aria-label="Heading 4"
              >
                <Heading4 size={18} className="text-amber-600 dark:text-amber-400" />
              </button>

              <div className="w-px h-5 mx-1 bg-cream-300 dark:bg-navy-700" />

              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={toolBtn(editor.isActive('bold'))}
                title="Bold (Ctrl+B)"
                aria-label="Bold"
              >
                <Bold size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={toolBtn(editor.isActive('italic'))}
                title="Italic (Ctrl+I)"
                aria-label="Italic"
              >
                <Italic size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={toolBtn(editor.isActive('bulletList'))}
                title="Bullet List"
                aria-label="Bullet List"
              >
                <List size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={toolBtn(editor.isActive('orderedList'))}
                title="Numbered List"
                aria-label="Numbered List"
              >
                <ListOrdered size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={toolBtn(editor.isActive('blockquote'))}
                title="Quote"
                aria-label="Quote"
              >
                <Quote size={18} className="text-amber-600 dark:text-amber-400" />
              </button>

              <div className="w-px h-5 mx-1 bg-cream-300 dark:bg-navy-700" />

              <button
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={toolBtn(editor.isActive({ textAlign: 'justify' }))}
                title="Justify Text"
                aria-label="Justify Text"
              >
                <AlignJustify size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={toolBtn(editor.isActive({ textAlign: 'center' }))}
                title="Center Text"
                aria-label="Center Text"
              >
                <AlignCenter size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={toolBtn(editor.isActive({ textAlign: 'left' }))}
                title="Align Left"
                aria-label="Align Left"
              >
                <AlignLeft size={18} className="text-amber-600 dark:text-amber-400" />
              </button>

              <div className="w-px h-5 mx-1 bg-cream-300 dark:bg-navy-700" />

              <div className="flex items-center gap-1 px-1">
                <button
                  onClick={decreaseFontSize}
                  className="px-2 py-1 text-xs border border-cream-300 dark:border-navy-600 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
                  title="Decrease Font Size (Ctrl+Shift+[)"
                >
                  A-
                </button>
                <span className="text-xs w-6 text-center text-cream-600 dark:text-gray-300">
                  {fontSize}
                </span>
                <button
                  onClick={increaseFontSize}
                  className="px-2 py-1 text-xs border border-cream-300 dark:border-navy-600 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
                  title="Increase Font Size (Ctrl+Shift+])"
                >
                  A+
                </button>
                {fontSize !== 16 && (
                  <button
                    onClick={resetFontSize}
                    className="px-2 py-1 text-xs border border-cream-300 dark:border-navy-600 rounded hover:bg-cream-200 dark:hover:bg-navy-800 text-cream-500 dark:text-gray-400"
                    title="Reset Font Size"
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="w-px h-5 mx-1 bg-cream-300 dark:bg-navy-700" />

              <button
                onClick={cleanBlankLines}
                className={toolBtn()}
                title="Remove Extra Blank Lines"
                aria-label="Remove Extra Blank Lines"
              >
                <Eraser size={18} className="text-amber-600 dark:text-amber-400" />
              </button>

              <button
                onClick={toggleUrduText}
                className={toolBtn(editor.isActive('urdu'))}
                title="Urdu Text (Noto Nastaliq Urdu, Right Aligned)"
                aria-label="Urdu Text"
              >
                <span
                  style={{ fontFamily: "'Noto Nastaliq Urdu', 'Noto Nastaliq', sans-serif" }}
                  className="text-amber-600 dark:text-amber-400 text-base leading-none"
                >
                  ن
                </span>
              </button>

              <button
                onClick={renderMarkdown}
                className={toolBtn()}
                title="Render Markdown"
                aria-label="Render Markdown"
              >
                <Eye size={18} className="text-amber-600 dark:text-amber-400" />
              </button>

              <div className="w-px h-5 mx-1 bg-cream-300 dark:bg-navy-700" />

              <button
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className={`${toolBtn()} disabled:opacity-40`}
                title="Undo (Ctrl+Z)"
                aria-label="Undo"
              >
                <Undo size={18} className="text-amber-600 dark:text-amber-400" />
              </button>
              <button
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className={`${toolBtn()} disabled:opacity-40`}
                title="Redo (Ctrl+Y)"
                aria-label="Redo"
              >
                <Redo size={18} className="text-amber-600 dark:text-amber-400" />
              </button>

              <div className="ml-auto flex items-center gap-0.5">
                {/* Table dropdown */}
                <div className="relative" ref={tableMenuRef}>
                  <button
                    onClick={() => {
                      setShowTableMenu((v) => !v);
                      setShowMathMenu(false);
                      setShowMoreOptions(false);
                    }}
                    className={toolBtn(inTable || showTableMenu)}
                    title="Table"
                    aria-label="Table options"
                  >
                    <Table2 size={18} className="text-amber-600 dark:text-amber-400" />
                  </button>
                  {showTableMenu && (
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-52 bg-cream-50 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 rounded-xl shadow-lg p-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider px-2 py-1 text-cream-500 dark:text-gray-400">
                        Insert Table
                      </h4>
                      <div className="space-y-0.5">
                        {[
                          [2, 2],
                          [3, 3],
                          [4, 4],
                          [5, 5],
                        ].map(([r, c]) => (
                          <button
                            key={`${r}x${c}`}
                            onClick={() => insertTable(r, c)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                          >
                            <span>
                              {r} × {c}
                            </span>
                            <Table2 size={14} className="text-cream-500 dark:text-gray-400" />
                          </button>
                        ))}
                      </div>
                      {inTable && (
                        <>
                          <div className="my-1.5 border-t border-cream-200 dark:border-navy-700" />
                          <div className="space-y-0.5">
                            <button
                              onClick={() => {
                                editor.chain().focus().addRowAfter().run();
                                setShowTableMenu(false);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                            >
                              <span>Add row</span>
                              <Plus size={14} className="text-cream-500 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => {
                                editor.chain().focus().addColumnAfter().run();
                                setShowTableMenu(false);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                            >
                              <span>Add column</span>
                              <Plus size={14} className="text-cream-500 dark:text-gray-400" />
                            </button>
                            <button
                              onClick={() => {
                                editor.chain().focus().deleteTable().run();
                                setShowTableMenu(false);
                              }}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                            >
                              <span>Delete table</span>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Math dropdown */}
                <div className="relative" ref={mathMenuRef}>
                  <button
                    onClick={() => {
                      setShowMathMenu((v) => !v);
                      setShowTableMenu(false);
                      setShowMoreOptions(false);
                    }}
                    className={toolBtn(showMathMenu)}
                    title="Insert Math"
                    aria-label="Insert math formula"
                  >
                    <Sigma size={18} className="text-amber-600 dark:text-amber-400" />
                  </button>
                  {showMathMenu && (
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-56 bg-cream-50 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 rounded-xl shadow-lg p-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider px-2 py-1 text-cream-500 dark:text-gray-400">
                        Insert Math
                      </h4>
                      <div className="space-y-0.5">
                        <button
                          onClick={insertInlineMath}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                        >
                          <span>Inline: $...$</span>
                          <Sigma size={14} className="text-cream-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={insertBlockMath}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                        >
                          <span>Block: $$...$$</span>
                          <Sigma size={14} className="text-cream-500 dark:text-gray-400" />
                        </button>
                        <div className="my-1 border-t border-cream-200 dark:border-navy-700" />
                        {[
                          ['α alpha', '\\alpha', 'α'],
                          ['β beta', '\\beta', 'β'],
                          ['γ gamma', '\\gamma', 'γ'],
                          ['Σ sum', '\\sum', '∑'],
                          ['∫ integral', '\\int', '∫'],
                          ['½ fraction', '\\frac{1}{2}', '1/2'],
                        ].map(([label, tpl, sym]) => (
                          <button
                            key={tpl}
                            onClick={() => insertCommonMath(tpl)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                          >
                            <span>{label}</span>
                            <span className="text-xs text-cream-500 dark:text-gray-400">{sym}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* More options dropdown */}
                <div className="relative" ref={moreOptionsRef}>
                  <button
                    onClick={() => {
                      setShowMoreOptions((v) => !v);
                      setShowMathMenu(false);
                      setShowTableMenu(false);
                    }}
                    className={toolBtn(showMoreOptions)}
                    title="More options"
                    aria-label="More options"
                  >
                    <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
                  </button>
                  {showMoreOptions && (
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-52 bg-cream-50 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 rounded-xl shadow-lg p-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider px-2 py-1 text-cream-500 dark:text-gray-400">
                        Insert & Format
                      </h4>
                      <div className="space-y-0.5">
                        <button
                          onClick={() => {
                            editor.chain().focus().toggleCode().run();
                            setShowMoreOptions(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                        >
                          <span>Inline code</span>
                          <Code size={14} className="text-cream-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => {
                            editor.chain().focus().toggleCodeBlock().run();
                            setShowMoreOptions(false);
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                        >
                          <span>Code block</span>
                          <Code2 size={14} className="text-cream-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            handleAddLink();
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                        >
                          <span>Add / edit link</span>
                          <Link2 size={14} className="text-cream-500 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => {
                            setShowMoreOptions(false);
                            imageInputRef.current?.click();
                          }}
                          className="w-full flex items-center justify-between px-2.5 py-1.5 text-left text-sm hover:bg-cream-200 dark:hover:bg-navy-800 rounded-lg"
                        >
                          <span>Insert image</span>
                          <ImageIcon size={14} className="text-cream-500 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={onCopyNote}
                  className={toolBtn()}
                  title="Copy Note as Markdown"
                  aria-label="Copy Note"
                >
                  <Copy size={18} className="text-amber-600 dark:text-amber-400" />
                </button>
                <button
                  onClick={onExportMarkdown}
                  className={toolBtn()}
                  title="Export Markdown"
                  aria-label="Export Markdown"
                >
                  <Download size={18} className="text-amber-600 dark:text-amber-400" />
                </button>
                <button
                  onClick={onToggleFullscreen}
                  className={toolBtn()}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Reading Mode'}
                  aria-label="Toggle reading mode"
                >
                  {isFullscreen ? (
                    <Minimize2 size={18} className="text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Maximize2 size={18} className="text-amber-600 dark:text-amber-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-y-auto w-full max-w-full ${
          isFullscreen ? 'p-6 md:py-12' : 'px-4 md:px-12 pt-4 pb-24 md:pb-4'
        }`}
      >
        <div className="max-w-[62rem] mx-auto w-full">
          <div style={{ fontSize: `${fontSize}px` }} className="w-full max-w-full">
            <BubbleMenu
              editor={editor}
              className="flex items-center gap-0.5 rounded-xl border border-cream-300 dark:border-navy-600 bg-cream-50 dark:bg-navy-900 shadow-lg p-1"
            >
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('bold')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Bold"
                aria-label="Bold"
              >
                <Bold size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('italic')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Italic"
                aria-label="Italic"
              >
                <Italic size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('underline')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Underline"
                aria-label="Underline"
              >
                <UnderlineIcon size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('strike')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Strikethrough"
                aria-label="Strikethrough"
              >
                <Strikethrough size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('heading', { level: 2 })
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Heading 2"
                aria-label="Heading 2"
              >
                <Heading2 size={16} aria-hidden="true" />
              </button>
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('bulletList')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Bullet list"
                aria-label="Bullet list"
              >
                <List size={16} aria-hidden="true" />
              </button>
              <button
                onClick={toggleUrduText}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('urdu')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Urdu Text (Noto Nastaliq Urdu)"
                aria-label="Urdu Text"
              >
                <span
                  style={{ fontFamily: "'Noto Nastaliq Urdu', 'Noto Nastaliq', sans-serif" }}
                  className="text-amber-600 dark:text-amber-400 text-base leading-none"
                >
                  ن
                </span>
              </button>
              <button
                onClick={handleAddLink}
                className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${
                  editor.isActive('link')
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'text-cream-700 dark:text-gray-200'
                }`}
                title="Add / edit link"
                aria-label="Add or edit link"
              >
                <Link2 size={16} aria-hidden="true" />
              </button>
            </BubbleMenu>
            <EditorContent editor={editor} />
          </div>

          <div className="flex items-center justify-between pt-4 mt-4 text-xs text-cream-500 dark:text-gray-400 border-t border-cream-300 dark:border-navy-600">
            <div className="flex items-center gap-1">
              <Type size={12} className="text-amber-600 dark:text-primary-400" aria-hidden="true" />
              <span>{wordCount.words} words</span>
            </div>
            <div className="flex items-center gap-1">
              <Eye size={12} className="text-amber-600 dark:text-primary-400" aria-hidden="true" />
              <span>{wordCount.minutes} min read</span>
            </div>
            <div>
              <span>{wordCount.chars} characters</span>
            </div>
          </div>
        </div>
      </div>

      {isFullscreen && (
        <button
          onClick={onToggleFullscreen}
          className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20 backdrop-blur-md hover:bg-amber-500/30 dark:hover:bg-amber-400/30 transition-colors shadow-lg"
          title="Exit fullscreen (Esc)"
          aria-label="Exit fullscreen"
        >
          <ArrowLeft size={24} className="text-amber-700 dark:text-amber-200" />
        </button>
      )}
    </div>
  );
};
