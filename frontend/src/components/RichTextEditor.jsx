import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';

// Toolbar layout: groups are separated by a thin divider.
const GROUPS = [
  [
    { label: 'Bold', icon: Bold, run: (e) => e.chain().focus().toggleBold().run(), active: (e) => e.isActive('bold') },
    { label: 'Italic', icon: Italic, run: (e) => e.chain().focus().toggleItalic().run(), active: (e) => e.isActive('italic') },
    { label: 'Strikethrough', icon: Strikethrough, run: (e) => e.chain().focus().toggleStrike().run(), active: (e) => e.isActive('strike') },
    { label: 'Inline code', icon: Code, run: (e) => e.chain().focus().toggleCode().run(), active: (e) => e.isActive('code') },
  ],
  [
    { label: 'Heading 2', icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(), active: (e) => e.isActive('heading', { level: 2 }) },
    { label: 'Heading 3', icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(), active: (e) => e.isActive('heading', { level: 3 }) },
  ],
  [
    { label: 'Bullet list', icon: List, run: (e) => e.chain().focus().toggleBulletList().run(), active: (e) => e.isActive('bulletList') },
    { label: 'Numbered list', icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run(), active: (e) => e.isActive('orderedList') },
    { label: 'Quote', icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run(), active: (e) => e.isActive('blockquote') },
    { label: 'Divider', icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
  ],
  [
    { label: 'Undo', icon: Undo2, run: (e) => e.chain().focus().undo().run(), disabled: (e) => !e.can().undo() },
    { label: 'Redo', icon: Redo2, run: (e) => e.chain().focus().redo().run(), disabled: (e) => !e.can().redo() },
  ],
];

const ToolbarButton = ({ label, icon: Icon, active, disabled, onClick }) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onClick={onClick}
    className={`flex h-8 w-8 items-center justify-center border disabled:pointer-events-none disabled:opacity-30 ${
      active ? 'border-ink bg-ink text-paper' : 'border-transparent hover:border-ink'
    }`}
  >
    <Icon size={16} aria-hidden="true" />
  </button>
);

// `value` is the initial HTML; `onChange` receives the latest HTML on every edit.
// Mount it only once the initial value is known (it is not re-synced afterwards).
const RichTextEditor = ({ value = '', onChange, placeholder = 'Tell your story…' }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose max-w-none font-serif min-h-80 px-4 py-3 focus:outline-none',
      },
    },
    onUpdate: ({ editor: instance }) => onChange(instance.getHTML()),
  });

  if (!editor) return null;

  const setLink = () => {
    const previous = editor.getAttributes('link').href || '';
    const input = window.prompt('Link URL (leave empty to remove the link)', previous);
    if (input === null) return;
    const url = input.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  return (
    <div className="border border-ink bg-paper">
      <div className="flex flex-wrap items-center gap-1 border-b border-ink bg-subtle p-1.5">
        {GROUPS.map((group, i) => (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <span className="mx-1 h-5 w-px bg-ink" aria-hidden="true" />}
            {group.map((item) => (
              <ToolbarButton
                key={item.label}
                label={item.label}
                icon={item.icon}
                active={item.active?.(editor)}
                disabled={item.disabled?.(editor)}
                onClick={() => item.run(editor)}
              />
            ))}
            {/* The link button sits at the end of the inline-formatting group. */}
            {i === 0 && (
              <ToolbarButton
                label="Link"
                icon={LinkIcon}
                active={editor.isActive('link')}
                onClick={setLink}
              />
            )}
          </div>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
