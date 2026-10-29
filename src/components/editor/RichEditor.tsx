'use client'

import Link from '@tiptap/extension-link'
import Table from '@tiptap/extension-table'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import TableRow from '@tiptap/extension-table-row'
import Placeholder from '@tiptap/extension-placeholder'
import TaskItem from '@tiptap/extension-task-item'
import TaskList from '@tiptap/extension-task-list'
import Typography from '@tiptap/extension-typography'
import { BubbleMenu, type Editor, EditorContent, useEditor } from '@tiptap/react'
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
	Strikethrough,
	ArrowDown,
	ArrowUp,
	Trash2,
	Mic,
	Paperclip,
	Sigma,
	Square,
	Table as TableIcon,
	X
} from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import 'katex/dist/katex.min.css'
import { Markdown } from 'tiptap-markdown'

import { deleteUploads } from '@/lib/imagekit-upload'
import {
	type TypeUploadContext,
	registerEditor,
	startUpload
} from '@/lib/upload-manager'

import { AudioAttachment, FileAttachment } from './attachments'

import {
	IMAGE_WIDTHS,
	PlannerImage,
	TouchDrag,
	TrailingParagraph,
	UploadTracker,
	moveSelectedNode,
	replaceImageSrc
} from './extensions'
import { MathRender, MathText } from './math'

interface IRichEditor {
	value: string
	onChange: (markdown: string) => void
	placeholder?: string
	autoFocus?: boolean
	className?: string
	contentClassName?: string
	onSubmitShortcut?: () => void
	// false — режим чтения: без панели, ссылки и файлы кликабельны
	editable?: boolean
	// чья это заметка — чтобы догрузить файл, даже если редактор уже закрыли
	uploadContext?: TypeUploadContext
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
	onSubmitShortcut,
	editable = true,
	uploadContext
}: IRichEditor) {
	const uploadContextRef = useRef(uploadContext)
	uploadContextRef.current = uploadContext
	const [uploading, setUploading] = useState(0)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const anyFileInputRef = useRef<HTMLInputElement>(null)
	const onChangeRef = useRef(onChange)
	const onSubmitRef = useRef(onSubmitShortcut)
	onChangeRef.current = onChange
	onSubmitRef.current = onSubmitShortcut

	// Картинки, аудио и любые файлы: сразу вставляем блок с локальным адресом, после загрузки подменяем
	const insertFiles = async (editor: Editor, files: File[], pos?: number) => {
		for (const file of files) {
			// Видео не принимаем — бесплатного места в ImageKit на них не хватит
			if (
				file.type.startsWith('video/') ||
				(/\.(mp4|mov|avi|mkv)$/i.test(file.name) && !file.type.startsWith('audio/'))
			) {
				toast.error('Видео пока загружать нельзя')
				continue
			}
			const isImage = file.type.startsWith('image/')
			const kind = isImage ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'file'
			const type =
				kind === 'image' ? 'image' : kind === 'audio' ? 'audioAttachment' : 'fileAttachment'
			// Загрузка идёт в фоне и переживает закрытие заметки
			const preview = startUpload(file, kind, uploadContextRef.current)
			const attrs = isImage
				? { src: preview }
				: { src: preview, name: file.name, size: file.size, mime: file.type }
			const chain = editor.chain().focus()
			if (pos !== undefined) chain.insertContentAt(pos, { type, attrs })
			else chain.insertContent({ type, attrs })
			chain.run()
		}
	}

	// Голосовые: запись через MediaRecorder прямо в браузере
	const recorderRef = useRef<MediaRecorder | null>(null)
	const chunksRef = useRef<Blob[]>([])
	const cancelRef = useRef(false)
	const [recordingSince, setRecordingSince] = useState<number | null>(null)
	const [, forceTick] = useState(0)

	useEffect(() => {
		if (!recordingSince) return
		const timer = setInterval(() => forceTick(tick => tick + 1), 500)
		return () => clearInterval(timer)
	}, [recordingSince])

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type =>
				MediaRecorder.isTypeSupported(type)
			)
			// 32 кбит/с Opus — речь звучит чисто, а минута весит ~240 КБ
			const recorder = new MediaRecorder(stream, {
				...(mimeType && { mimeType }),
				audioBitsPerSecond: 32_000
			})
			chunksRef.current = []
			cancelRef.current = false
			recorder.ondataavailable = event => chunksRef.current.push(event.data)
			recorder.onstop = () => {
				stream.getTracks().forEach(track => track.stop())
				setRecordingSince(null)
				if (cancelRef.current || !editorRef.current) return
				const type = (recorder.mimeType || 'audio/webm').split(';')[0]
				const blob = new Blob(chunksRef.current, { type })
				const stamp = new Date().toLocaleString('ru-RU', {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				})
				const ext = type.includes('mp4') ? 'm4a' : 'webm'
				insertFiles(editorRef.current, [
					new File([blob], `Голосовое ${stamp}.${ext}`, { type })
				])
			}
			recorder.start()
			recorderRef.current = recorder
			setRecordingSince(Date.now())
		} catch {
			toast.error('Нет доступа к микрофону')
		}
	}

	const stopRecording = (cancel = false) => {
		cancelRef.current = cancel
		recorderRef.current?.stop()
		recorderRef.current = null
	}

	const editorRef = useRef<Editor | null>(null)

	const editor = useEditor({
		immediatelyRender: false,
		editable,
		autofocus: autoFocus ? 'end' : false,
		extensions: [
			StarterKit.configure({ heading: { levels: [1, 2, 3] }, text: false }),
			MathText,
			MathRender,
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			FileAttachment,
			AudioAttachment,
			UploadTracker.configure({ onDelete: deleteUploads }),
			TouchDrag,
			Placeholder.configure({ placeholder }),
			Link.configure({
				openOnClick: !editable,
				autolink: true,
				HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' }
			}),
			PlannerImage.configure({ HTMLAttributes: { loading: 'lazy' } }),
			TrailingParagraph,
			TaskList,
			TaskItem.configure({ nested: true }),
			Typography,
			Markdown.configure({
				// HTML нужен только для <img width> — ширины картинок
				html: true,
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
				if (!files.length || !editor) return false
				event.preventDefault()
				insertFiles(editor, files)
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
				insertFiles(editor, files, coords?.pos)
				return true
			}
		},
		onUpdate({ editor }) {
			onChangeRef.current(getMarkdown(editor))
		}
	})

	editorRef.current = editor

	// Менеджер загрузок должен знать открытые редакторы, чтобы подставить готовый файл
	useEffect(() => {
		if (!editor) return
		const unregister = registerEditor(editor)
		return () => {
			unregister()
		}
	}, [editor])

	// Переключение «чтение ↔ правка» (архив)
	useEffect(() => {
		if (!editor || editor.isDestroyed || editor.isEditable === editable) return
		editor.setEditable(editable)
		// формулы в режиме чтения и правки рисуются по-разному
		editor.view.dispatch(editor.state.tr.setMeta('mathRefresh', true))
	}, [editor, editable])

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
			{editor && editable && (
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
							if (editor) insertFiles(editor, files)
						}}
					/>
					<ToolButton
						label='Файл или аудио'
						onClick={() => anyFileInputRef.current?.click()}
					>
						<Paperclip size={15} />
					</ToolButton>
					<input
						ref={anyFileInputRef}
						type='file'
						multiple
						hidden
						onChange={event => {
							const files = Array.from(event.currentTarget.files || [])
							event.currentTarget.value = ''
							if (editor) insertFiles(editor, files)
						}}
					/>
					<ToolButton
						label={recordingSince ? 'Остановить запись' : 'Записать голосовое'}
						active={Boolean(recordingSince)}
						onClick={() => (recordingSince ? stopRecording() : startRecording())}
					>
						<Mic size={15} />
					</ToolButton>
					<Divider />
					<ToolButton
						label='Формула (LaTeX)'
						onClick={() => {
							const { from } = editor.state.selection
							editor.chain().focus().insertContent('$$  $$').setTextSelection(from + 3).run()
						}}
					>
						<Sigma size={15} />
					</ToolButton>
					<ToolButton
						label='Таблица'
						active={editor.isActive('table')}
						onClick={() =>
							editor.isActive('table')
								? editor.chain().focus().addRowAfter().run()
								: editor
										.chain()
										.focus()
										.insertTable({ rows: 3, cols: 3, withHeaderRow: true })
										.run()
						}
					>
						<TableIcon size={15} />
					</ToolButton>
				</div>
			)}

			{recordingSince && (
				<div className='mb-3 flex items-center gap-3 border border-danger/40 bg-danger/5 px-3 py-2'>
					<span className='h-2 w-2 animate-pulse rounded-full bg-danger' />
					<span className='font-mono text-sm tabular-nums text-fg'>
						{(() => {
							const seconds = Math.floor((Date.now() - recordingSince) / 1000)
							return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
						})()}
					</span>
					<span className='text-sm text-muted'>Запись…</span>
					<button
						type='button'
						onClick={() => stopRecording(true)}
						aria-label='Отменить запись'
						className='ml-auto grid h-8 w-8 place-items-center text-subtle transition-colors hover:text-fg'
					>
						<X size={15} />
					</button>
					<button
						type='button'
						onClick={() => stopRecording()}
						className='flex h-8 items-center gap-2 bg-danger px-3 text-sm font-medium text-white'
					>
						<Square
							size={12}
							fill='currentColor'
						/>
						Готово
					</button>
				</div>
			)}
			{/* BubbleMenu уносит свой элемент в body — держим его в постоянной обёртке,
			    иначе React падает, вставляя панель/плашку записи «перед» ним */}
			<div className='contents'>
			{editor && (
				<BubbleMenu
					editor={editor}
					shouldShow={({ editor }) => editor.isEditable && editor.isActive('image')}
					tippyOptions={{ placement: 'top', maxWidth: 'none' }}
				>
					<div className='flex items-center border border-border bg-elevated shadow-pop'>
						<ToolButton
							label='Выше'
							onClick={() => moveSelectedNode(editor, -1)}
						>
							<ArrowUp size={15} />
						</ToolButton>
						<ToolButton
							label='Ниже'
							onClick={() => moveSelectedNode(editor, 1)}
						>
							<ArrowDown size={15} />
						</ToolButton>
						<Divider />
						{IMAGE_WIDTHS.map(width => (
							<button
								key={width || 'full'}
								type='button'
								onMouseDown={event => event.preventDefault()}
								onClick={() =>
									editor.chain().focus().updateAttributes('image', { width }).run()
								}
								className={cn(
									'h-8 px-2 font-mono text-xs transition-colors',
									(editor.getAttributes('image').width ?? null) === width
										? 'bg-white/[0.08] text-fg'
										: 'text-subtle hover:text-fg'
								)}
							>
								{width ? width.replace('%', '') : '100'}
							</button>
						))}
						<Divider />
						<ToolButton
							label='Удалить фото'
							onClick={() => editor.chain().focus().deleteSelection().run()}
						>
							<Trash2 size={14} />
						</ToolButton>
					</div>
				</BubbleMenu>
			)}
			</div>
			{/* Тап по любому месту поля ставит курсор в конец текста */}
			<div
				className='min-h-0 flex-1 cursor-text'
				onMouseDown={event => {
					if (!editor || event.target !== event.currentTarget) return
					event.preventDefault()
					editor.commands.focus('end')
				}}
			>
				<EditorContent
					editor={editor}
					className='h-full'
				/>
			</div>
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
