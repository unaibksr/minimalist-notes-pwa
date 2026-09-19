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
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
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
  Table2,
  Sigma,
  Sparkles,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link2,
  Image as ImageIcon,
  Eye,
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

export const RichEditor: React.FC<RichEditorProps> = ({
  noteId,
  content,
  onChange,
  isFullscreen,
  onToggleFullscreen,
  onExportMarkdown,
  onCopyNote,
}) => {
  const [fontSize, setFontSize] = useState<number>(16);
  const [wordCount, setWordCount] = useState<WordCount>({ words: 0, chars: 0, minutes: 0 });
  const [showMathMenu, setShowMathMenu] = useState(false);
  const [showTableMenu, setShowTableMenu] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const loadedNoteId = useRef<string | null>(null);
  const mathMenuRef = useRef<HTMLDivElement>(null);
  const tableMenuRef = useRef<HTMLDivElement>(null);
  const moreOptionsRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Underline,
      Strike,
      Link.configure({
        openOnClick: false,
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
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          'tiptap max-w-none focus:outline-none min-h-[calc(100vh-260px)] text-justify leading-relaxed text-cream-800 dark:text-white',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    // Load fresh content only when switching notes, or when an external change
    // (e.g. a collaborator's edit) arrives while we are not actively typing.
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
    if (!text.trim()) return;
    if (!hasMarkdown(text)) {
      // Could show a toast here, but keeping it simple
      return;
    }
    const html = markdownToHtml(text);
    editor.commands.setContent(html, false);
  };

  const decreaseFontSize = () => setFontSize((s) => Math.max(12, s - 2));
  const increaseFontSize = () => setFontSize((s) => Math.min(32, s + 2));
  const resetFontSize = () => setFontSize(16);

  useEffect(() => {
    if (!editor) return;
    const updateCounts = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const chars = text.length;
      const minutes = Math.max(1, Math.ceil(words / 275)); // 275 words per minute
      setWordCount({ words, chars, minutes });
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

  useEffect(() => {
    if (!editor) return;
    if (isFullscreen) {
      editor.chain().focus().run();
    }
  }, [isFullscreen, editor]);

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

  return (
    <div className={`flex flex-col flex-1 min-h-0 ${isFullscreen ? 'fixed inset-0 z-50 bg-cream-50 dark:bg-navy-950' : ''}`}>
      {!isFullscreen && (
        <div className="shrink-0 bg-cream-50 dark:bg-navy-950 border-b border-cream-300 dark:border-navy-600">
          <div className="px-4 md:px-12 py-2">
            <div className="flex flex-wrap items-center gap-1 p-2 border border-cream-300 dark:border-navy-600 bg-cream-50 dark:bg-navy-900 rounded-xl shadow-sm">
           <button
             onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('heading', { level: 1 }) ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Heading 1"
           >
             <Heading1 size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <button
             onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Heading 2"
           >
             <Heading2 size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <button
             onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('heading', { level: 3 }) ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Heading 3"
           >
             <Heading3 size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <div className="w-px h-5 mx-1 bg-cream-400 dark:bg-navy-700" />

           <button
             onClick={() => editor.chain().focus().toggleBold().run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('bold') ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Bold"
           >
             <Bold size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <button
             onClick={() => editor.chain().focus().toggleItalic().run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('italic') ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Italic"
           >
             <Italic size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <div className="w-px h-5 mx-1 bg-cream-400 dark:bg-navy-700" />

           <button
             onClick={() => editor.chain().focus().setTextAlign('justify').run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive({ textAlign: 'justify' }) ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Justify Text"
           >
             <AlignJustify size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <button
             onClick={() => editor.chain().focus().setTextAlign('center').run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive({ textAlign: 'center' }) ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Center Text"
           >
             <AlignCenter size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <button
             onClick={() => editor.chain().focus().setTextAlign('left').run()}
             className={`p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive({ textAlign: 'left' }) ? 'bg-cream-300 dark:bg-navy-700' : ''}`}
             title="Align Left"
           >
             <AlignLeft size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <div className="w-px h-5 mx-1 bg-cream-400 dark:bg-navy-700" />

           <div className="flex items-center gap-1 px-1">
             <button
               onClick={decreaseFontSize}
               className="px-2 py-1 text-xs border border-cream-400 dark:border-navy-700 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
               title="Decrease Font Size (Ctrl+Shift+[)"
             >
               A-
             </button>
             <span className="text-xs w-6 text-center text-cream-600 dark:text-gray-300">{fontSize}</span>
             <button
               onClick={increaseFontSize}
               className="px-2 py-1 text-xs border border-cream-400 dark:border-navy-700 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
               title="Increase Font Size (Ctrl+Shift+])"
             >
               A+
             </button>
             {fontSize !== 16 && (
               <button
                 onClick={resetFontSize}
                 className="px-2 py-1 text-xs border border-cream-400 dark:border-navy-700 rounded hover:bg-cream-200 dark:hover:bg-navy-800 text-cream-500 dark:text-gray-400"
                 title="Reset Font Size"
               >
                 Reset
               </button>
             )}
           </div>

<div className="w-px h-5 mx-1 bg-cream-400 dark:bg-navy-700" />

            <button
              onClick={cleanBlankLines}
              className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
              title="Remove Extra Blank Lines"
            >
              <Eraser size={18} className="text-amber-600 dark:text-amber-400" />
            </button>

            <div className="w-px h-5 mx-1 bg-cream-400 dark:bg-navy-700" />

            <button
              onClick={renderMarkdown}
              className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
              title="Render Markdown"
            >
              <Eye size={18} className="text-amber-600 dark:text-amber-400" />
            </button>

           <div className="w-px h-5 mx-1 bg-cream-400 dark:bg-navy-700" />

           <button
             onClick={() => editor.chain().focus().undo().run()}
             disabled={!editor.can().undo()}
             className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 disabled:opacity-40"
             title="Undo"
           >
             <Undo size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <button
             onClick={() => editor.chain().focus().redo().run()}
             disabled={!editor.can().redo()}
             className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800 disabled:opacity-40"
             title="Redo"
           >
             <Redo size={18} className="text-amber-600 dark:text-amber-400" />
           </button>

           <div className="ml-auto flex items-center gap-1">
             <button
               onClick={onCopyNote}
               className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
               title="Copy Note"
             >
               <Copy size={18} className="text-amber-600 dark:text-amber-400" />
             </button>
             <button
               onClick={onExportMarkdown}
               className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
               title="Export Markdown"
             >
               <Download size={18} className="text-amber-600 dark:text-amber-400" />
             </button>
             <button
               onClick={() => setShowMoreOptions(true)}
               className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
               title="More options"
             >
               <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
             </button>
             <button
               onClick={onToggleFullscreen}
               className="p-2 rounded hover:bg-cream-200 dark:hover:bg-navy-800"
               title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Reading Mode'}
             >
               {isFullscreen ? <Minimize2 size={18} className="text-amber-600 dark:text-amber-400" /> : <Maximize2 size={18} className="text-amber-600 dark:text-amber-400" />}
             </button>
           </div>
             </div>
           </div>
         </div>
       )}
       <div className={`flex-1 min-h-0 overflow-y-auto w-full max-w-full ${isFullscreen ? 'p-6' : 'px-4 md:px-12 pt-4 pb-24 md:pb-4'}`}>
         <div className="max-w-[62rem] mx-auto w-full">
           <div style={{ fontSize: `${fontSize}px` }} className="w-full max-w-full">
             <BubbleMenu
               editor={editor}
               className="flex items-center gap-0.5 rounded-xl border border-cream-300 dark:border-navy-700 bg-cream-50 dark:bg-navy-900 shadow-lg p-1"
             >
               <button
                 onClick={() => editor.chain().focus().toggleBold().run()}
                 className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('bold') ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-cream-700 dark:text-gray-200'}`}
                 title="Bold"
                 aria-label="Bold"
               >
                 <Bold size={16} aria-hidden="true" />
               </button>
               <button
                 onClick={() => editor.chain().focus().toggleItalic().run()}
                 className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('italic') ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-cream-700 dark:text-gray-200'}`}
                 title="Italic"
                 aria-label="Italic"
               >
                 <Italic size={16} aria-hidden="true" />
               </button>
               <button
                 onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                 className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('heading', { level: 2 }) ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-cream-700 dark:text-gray-200'}`}
                 title="Heading 2"
                 aria-label="Heading 2"
               >
                 <Heading2 size={16} aria-hidden="true" />
               </button>
               <button
                 onClick={() => editor.chain().focus().toggleBulletList().run()}
                 className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('bulletList') ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-cream-700 dark:text-gray-200'}`}
                 title="Bullet list"
                 aria-label="Bullet list"
               >
                 <List size={16} aria-hidden="true" />
               </button>
               <button
                 onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                 className="p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800"
                 title="Insert table"
                 aria-label="Insert table"
               >
                 <Table2 size={16} aria-hidden="true" />
               </button>
               <button
                 onClick={() => setShowMathMenu(true)}
                 className="p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800"
                 title="Math"
                 aria-label="Insert math formula"
               >
                 <Sigma size={16} className="text-amber-600 dark:text-amber-400" />
               </button>
               <button
                 onClick={() => editor.chain().focus().toggleUnderline().run()}
                 className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('underline') ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-cream-700 dark:text-gray-200'}`}
                 title="Underline"
                 aria-label="Underline"
               >
                 <UnderlineIcon size={16} className="text-amber-600 dark:text-amber-400" />
               </button>
               <button
                 onClick={() => editor.chain().focus().toggleStrike().run()}
                 className={`p-2 rounded-md hover:bg-cream-200 dark:hover:bg-navy-800 ${editor.isActive('strike') ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'text-cream-700 dark:text-gray-200'}`}
                 title="Strikethrough"
                 aria-label="Strikethrough"
               >
                 <Strikethrough size={16} className="text-amber-600 dark:text-amber-400" />
               </button>
             </BubbleMenu>
             <EditorContent editor={editor} />
           </div>

           <div className="flex items-center justify-between pt-4 mt-4 text-xs text-cream-500 dark:text-gray-400 border-t border-cream-300 dark:border-navy-600">
             <div className="flex items-center gap-1">
               <Type size={12} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
               <span>{wordCount.words} words</span>
             </div>
             <div className="flex items-center gap-1">
               <Eye size={12} className="text-primary-600 dark:text-primary-400" aria-hidden="true" />
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
           className="fixed bottom-6 right-6 z-50 p-3 rounded-full bg-amber-500/20 dark:bg-amber-400/20 backdrop-blur-md hover:bg-amber-500/30 dark:hover:bg-amber-400/30 transition-colors"
           title="Exit fullscreen"
         >
           <ArrowLeft size={24} className="text-amber-700 dark:text-amber-200" />
         </button>
       )}

       {/* Math Menu */}
       {showMathMenu && (
         <div
           ref={mathMenuRef}
           className="absolute z-50 mt-2 w-64 bg-cream-50 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 rounded-lg shadow-lg"
         >
           <div className="p-3">
             <h4 className="text-sm font-medium mb-2 text-cream-800 dark:text-white">Insert Math</h4>
             <div className="space-y-2">
               <button
                 onClick={insertInlineMath}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>Inline: $...$</span>
                 <Sigma size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
               <button
                 onClick={insertBlockMath}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>Block: $$...$$</span>
                 <Sigma size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
               <div className="border-t border-cream-200 dark:border-navy-700"></div>
               <button
                 onClick={() => insertCommonMath('\\alpha')}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>α alpha</span>
                 <span className="text-xs text-cream-500 dark:text-gray-500">α</span>
               </button>
               <button
                 onClick={() => insertCommonMath('\\beta')}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>β beta</span>
                 <span className="text-xs text-cream-500 dark:text-gray-500">β</span>
               </button>
               <button
                 onClick={() => insertCommonMath('\\gamma')}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>γ gamma</span>
                 <span className="text-xs text-cream-500 dark:text-gray-500">γ</span>
               </button>
               <button
                 onClick={() => insertCommonMath('\\sum')}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>Σ sum</span>
                 <span className="text-xs text-cream-500 dark:text-gray-500">∑</span>
               </button>
               <button
                 onClick={() => insertCommonMath('\\int')}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>∫ integral</span>
                 <span className="text-xs text-cream-500 dark:text-gray-500">∫</span>
               </button>
               <button
                 onClick={() => insertCommonMath('\\frac{1}{2}')}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>½ fraction</span>
                 <span className="text-xs text-cream-500 dark:text-gray-500">1/2</span>
               </button>
             </div>
           </div>
         </div>
       )}

       {/* Table Menu */}
       {showTableMenu && (
         <div
           ref={tableMenuRef}
           className="absolute z-50 mt-2 w-64 bg-cream-50 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 rounded-lg shadow-lg"
         >
           <div className="p-3">
             <h4 className="text-sm font-medium mb-2 text-cream-800 dark:text-white">Insert Table</h4>
             <div className="space-y-2">
               <button
                 onClick={() => insertTable(2, 2)}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>2 × 2</span>
                 <Table2 size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
               <button
                 onClick={() => insertTable(3, 3)}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>3 × 3</span>
                 <Table2 size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
               <button
                 onClick={() => insertTable(4, 4)}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:bg-navy-800 rounded"
               >
                 <span>4 × 4</span>
                 <Table2 size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
               <button
                 onClick={() => insertTable(5, 5)}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:bg-navy-800 rounded"
               >
                 <span>5 × 5</span>
                 <Table2 size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
             </div>
           </div>
         </div>
       )}

       {/* More Options Menu */}
       {showMoreOptions && (
         <div
           ref={moreOptionsRef}
           className="absolute z-50 mt-2 w-64 bg-cream-50 dark:bg-navy-900 border border-cream-300 dark:border-navy-600 rounded-lg shadow-lg"
         >
           <div className="p-3">
             <h4 className="text-sm font-medium mb-2 text-cream-800 dark:text-white">More Options</h4>
             <div className="space-y-2">
               <button
                 onClick={() => editor.chain().focus().toggleCode().run()}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>Code block</span>
                 <Code size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
<button
                  onClick={() => {
                    const url = prompt('Enter URL:');
                    if (url) {
                      editor.chain().focus().setLink({ href: url }).run();
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
                >
                  <span>Add link</span>
                  <Link2 size={14} className="text-cream-600 dark:text-gray-400" />
                </button>
               <button
                 onClick={() => {
                   // Placeholder for image upload - in a real app this would trigger file picker
                   alert('Image upload would open here in a full implementation');
                 }}
                 className="w-full flex items-center justify-between px-3 py-2 text-left text-sm bg-transparent hover:bg-cream-100 dark:hover:bg-navy-800 rounded"
               >
                 <span>Add image</span>
                 <ImageIcon size={14} className="text-cream-600 dark:text-gray-400" />
               </button>
             </div>
           </div>
         </div>
       )}
     </div>
   );
}