'use client'

import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Typography from '@tiptap/extension-typography'
import { type Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import cn from 'clsx'
import {
	Bold,
	Code,
	Heading1,
	Heading2,
	ImagePlus,
	Italic,
	Link2,
	List,
	ListChecks,
	ListOrdered,
	Loader2,
	Quote,
	Strikethrough
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Markdown } from 'tiptap-markdown'

import { uploadImage } from '@/lib/imagekit-upload'

interface IRichEditor {
	value: string
	onChange: (markdown: string) => void
	placeholder?: string
	autoFocus?: boolean
	className?: string
	contentClassName?: string
	onSubmitShortcut?: () => void
}

const getMarkdown = (editor: Editor): string =>
	editor.storage.markdown.getMarkdown()

/**
 * Редактор в духе Telegraph: Markdown-сокращения (#, -, >, [ ]), панель форматирования,
 * вставка фото из буфера/перетаскиванием. Хранит и отдаёт Markdown — поэтому старые
 * текстовые заметки открываются без миграции.
 */
export function RichEditor({
	value,
	onChange,
	placeholder = 'Начните писать…',
	autoFocus,
	className,
	contentClassName,
	onSubmitShortcut
}: IRichEditor) {
	const [uploading, setUploading] = useState(0)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const onChangeRef = useRef(onChange)
	const onSubmitRef = useRef(onSubmitShortcut)
	onChangeRef.current = onChange
	onSubmitRef.current = onSubmitShortcut

	const insertImages = async (editor: Editor, files: File[], pos?: number) => {
		const images = files.filter(file => file.type.startsWith('image/'))
		for (const file of images) {
			setUploading(count => count + 1)
			try {
				const src = await uploadImage(file)
				const chain = editor.chain().focus()
				if (pos !== undefined) chain.insertContentAt(pos, { type: 'image', attrs: { src } })
				else chain.setImage({ src })
				chain.run()
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : 'Не удалось загрузить фото'
				)
			} finally {
				setUploading(count => count - 1)
			}
		}
	}

	const editor = useEditor({
		immediatelyRender: false,
		autofocus: autoFocus ? 'end' : false,
		extensions: [
			StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
			Placeholder.configure({ placeholder }),
			Link.configure({
				openOnClick: false,
				autolink: true,
				HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
			}),
			Image.configure({ HTMLAttributes: { loading: 'lazy' } }),
			TaskList,
			TaskItem.configure({ nested: true }),
			Typography,
			Markdown.configure({
				html: false,
				linkify: true,
				transformPastedText: true,
				transformCopiedText: true
			})
		],
		content: value,
		editorProps: {
			attributes: {
				class: cn('rich-editor-content', contentClassName)
			},
			handleKeyDown(_view, event) {
				if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
					onSubmitRef.current?.()
					return Boolean(onSubmitRef.current)
				}
				return false
			},
			handlePaste(_view, event) {
				const files = Array.from(event.clipboardData?.files || [])
				if (!files.some(file => file.type.startsWith('image/')) || !editor) {
					return false
				}
				event.preventDefault()
				insertImages(editor, files)
				return true
			},
			handleDrop(view, event, _slice, moved) {
				const files = Array.from(event.dataTransfer?.files || [])
				if (moved || !files.length || !editor) return false
				event.preventDefault()
				const coords = view.posAtCoords({
					left: event.clientX,
					top: event.clientY
				})
				insertImages(editor, files, coords?.pos)
				return true
			}
		},
		onUpdate({ editor }) {
			onChangeRef.current(getMarkdown(editor))
		}
	})

	// Внешняя смена значения (другой день, другая задача) — подменяем содержимое
	useEffect(() => {
		if (!editor || editor.isDestroyed) return
		if (getMarkdown(editor) !== value) {
			editor.commands.setContent(value, false)
		}
	}, [editor, value])

	const setLink = () => {
		if (!editor) return
		const previous = editor.getAttributes('link').href as string | undefined
		const url = window.prompt('Ссылка', previous || 'https://')
		if (url === null) return
		if (!url.trim()) {
			editor.chain().focus().extendMarkRange('link').unsetLink().run()
			return
		}
		editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
	}

	return (
		<div className={cn('flex min-h-0 flex-col', className)}>
			{editor && (
				<div
					role='toolbar'
					aria-label='Форматирование'
					className='sticky top-0 z-10 -mx-1 mb-3 flex flex-wrap items-center gap-px border-b border-border bg-inherit pb-2'
				>
					<ToolButton
						label='Заголовок'
						active={editor.isActive('heading', { level: 1 })}
						onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
					>
						<Heading1 size={16} />
					</ToolButton>
					<ToolButton
						label='Подзаголовок'
						active={editor.isActive('heading', { level: 2 })}
						onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
					>
						<Heading2 size={16} />
					</ToolButton>
					<Divider />
					<ToolButton
						label='Жирный (Ctrl+B)'
						active={editor.isActive('bold')}
						onClick={() => editor.chain().focus().toggleBold().run()}
					>
						<Bold size={15} />
					</ToolButton>
					<ToolButton
						label='Курсив (Ctrl+I)'
						active={editor.isActive('italic')}
						onClick={() => editor.chain().focus().toggleItalic().run()}
					>
						<Italic size={15} />
					</ToolButton>
					<ToolButton
						label='Зачёркнутый'
						active={editor.isActive('strike')}
						onClick={() => editor.chain().focus().toggleStrike().run()}
					>
						<Strikethrough size={15} />
					</ToolButton>
					<ToolButton
						label='Ссылка'
						active={editor.isActive('link')}
						onClick={setLink}
					>
						<Link2 size={15} />
					</ToolButton>
					<Divider />
					<ToolButton
						label='Список'
						active={editor.isActive('bulletList')}
						onClick={() => editor.chain().focus().toggleBulletList().run()}
					>
						<List size={16} />
					</ToolButton>
					<ToolButton
						label='Нумерованный список'
						active={editor.isActive('orderedList')}
						onClick={() => editor.chain().focus().toggleOrderedList().run()}
					>
						<ListOrdered size={16} />
					</ToolButton>
					<ToolButton
						label='Чек-лист'
						active={editor.isActive('taskList')}
						onClick={() => editor.chain().focus().toggleTaskList().run()}
					>
						<ListChecks size={16} />
					</ToolButton>
					<ToolButton
						label='Цитата'
						active={editor.isActive('blockquote')}
						onClick={() => editor.chain().focus().toggleBlockquote().run()}
					>
						<Quote size={15} />
					</ToolButton>
					<ToolButton
						label='Код'
						active={editor.isActive('codeBlock')}
						onClick={() => editor.chain().focus().toggleCodeBlock().run()}
					>
						<Code size={15} />
					</ToolButton>
					<Divider />
					<ToolButton
						label='Фото'
						onClick={() => fileInputRef.current?.click()}
					>
						{uploading ? (
							<Loader2
								size={15}
								className='animate-spin'
							/>
						) : (
							<ImagePlus size={15} />
						)}
					</ToolButton>
					<input
						ref={fileInputRef}
						type='file'
						accept='image/*'
						multiple
						hidden
						onChange={event => {
							const files = Array.from(event.currentTarget.files || [])
							event.currentTarget.value = ''
							if (editor) insertImages(editor, files)
						}}
					/>
				</div>
			)}
			<EditorContent
				editor={editor}
				className='min-h-0 flex-1'
			/>
		</div>
	)
}

function ToolButton({
	label,
	active,
	onClick,
	children
}: {
	label: string
	active?: boolean
	onClick: () => void
	children: ReactNode
}) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			aria-pressed={active}
			onMouseDown={event => event.preventDefault()}
			onClick={onClick}
			className={cn(
				'grid h-8 w-8 place-items-center transition-colors',
				active
					? 'bg-white/[0.08] text-fg'
					: 'text-subtle hover:bg-white/[0.04] hover:text-fg'
			)}
		>
			{children}
		</button>
	)
}

function Divider() {
	return <span className='mx-1 h-4 w-px bg-border' />
}
