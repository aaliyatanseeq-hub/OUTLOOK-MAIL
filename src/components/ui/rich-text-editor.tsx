'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import Image from '@tiptap/extension-image'
import {
  BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon,
  LinkIcon, ListIcon, ListOrderedIcon, QuoteIcon,
  AlignLeftIcon, AlignCenterIcon, AlignRightIcon,
  Undo2Icon, Redo2Icon, MinusIcon,
} from 'lucide-react'
import { useCallback, useEffect } from 'react'

interface Props {
  value?: string
  onChange?: (html: string) => void
  placeholder?: string
  minHeight?: number
}

function Btn({ onClick, active, title, children }: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      type="button" onClick={onClick} title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-indigo-500/20 text-indigo-200'
          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  )
}

export function RichTextEditor({ value, onChange, placeholder = 'Write your email…', minHeight = 240 }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder }),
      Image.configure({ allowBase64: true, inline: true }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: 'outline-none',
        style: `min-height: ${minHeight}px; padding: 16px;`,
      },
      // Handle image paste from clipboard (e.g. Outlook signatures)
      handlePaste(view, event) {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) continue
            const reader = new FileReader()
            reader.onload = (e) => {
              const src = e.target?.result as string
              if (src) view.dispatch(view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src })
              ))
            }
            reader.readAsDataURL(file)
            return true
          }
        }
        return false
      },
    },
    onUpdate({ editor }) { onChange?.(editor.getHTML()) },
  })

  useEffect(() => {
    if (!editor) return
    if (value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value)
    }
  }, [value, editor])

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('URL', prev || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().setLink({ href: url }).run()
  }, [editor])

  if (!editor) return null

  const ic = 'w-3.5 h-3.5'

  return (
    <div className="border border-slate-700 rounded-md overflow-hidden focus-within:border-slate-500 transition-colors bg-slate-900">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-800 bg-slate-800/60">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()}        active={editor.isActive('bold')}        title="Bold">        <BoldIcon          className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()}      active={editor.isActive('italic')}      title="Italic">      <ItalicIcon        className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().toggleUnderline().run()}   active={editor.isActive('underline')}   title="Underline">   <UnderlineIcon     className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()}      active={editor.isActive('strike')}      title="Strike">      <StrikethroughIcon className={ic}/></Btn>
        <span className="w-px h-4 bg-slate-700 mx-0.5"/>
        <Btn onClick={setLink}                                                active={editor.isActive('link')}        title="Link">        <LinkIcon          className={ic}/></Btn>
        <span className="w-px h-4 bg-slate-700 mx-0.5"/>
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Bullet list"> <ListIcon          className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered">    <ListOrderedIcon   className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()}  active={editor.isActive('blockquote')}  title="Quote">       <QuoteIcon         className={ic}/></Btn>
        <span className="w-px h-4 bg-slate-700 mx-0.5"/>
        <Btn onClick={() => editor.chain().focus().setTextAlign('left').run()}   active={editor.isActive({textAlign:'left'})}   title="Align left">   <AlignLeftIcon   className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({textAlign:'center'})} title="Align center"> <AlignCenterIcon className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().setTextAlign('right').run()}  active={editor.isActive({textAlign:'right'})}  title="Align right">  <AlignRightIcon  className={ic}/></Btn>
        <span className="w-px h-4 bg-slate-700 mx-0.5"/>
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><MinusIcon  className={ic}/></Btn>
        <span className="w-px h-4 bg-slate-700 mx-0.5"/>
        <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2Icon className={ic}/></Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2Icon className={ic}/></Btn>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
