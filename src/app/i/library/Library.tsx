'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {
	ArrowLeft,
	Check,
	ChevronRight,
	FilePlus2,
	FolderPlus,
	Loader2,
	Pencil,
	Plus,
	Trash2
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Heading } from '@/components/ui/Heading'

import {
	type ILibraryPageMeta,
	type ILibrarySection,
	type ILibraryTopic,
	libraryService,
	toExcerpt
} from '@/services/library.service'

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{ ssr: false, loading: () => <div className='h-64 animate-pulse bg-white/[0.02]' /> }
)

const TREE_KEY = ['library', 'tree']
const pagesKey = (topicId: string) => ['library', 'pages', topicId]
const pageKey = (pageId: string) => ['library', 'page', pageId]

type TypeDeleteTarget =
	| { table: 'library_section'; id: string; title: string }
	| { table: 'library_topic'; id: string; title: string }
	| { table: 'library_page'; id: string; title: string }

export function Library() {
	const router = useRouter()
	const pathname = usePathname()
	const params = useSearchParams()
	const queryClient = useQueryClient()
	const topicId = params.get('topic')
	const pageId = params.get('page')

	const { data: tree, isLoading } = useQuery({
		queryKey: TREE_KEY,
		queryFn: libraryService.getTree,
		staleTime: 5 * 60 * 1000
	})
	const sections = tree?.sections || []
	const topics = tree?.topics || []
	const topic = topics.find(item => item.id === topicId)
	const section = sections.find(item => item.id === topic?.section_id)

	const [deleteTarget, setDeleteTarget] = useState<TypeDeleteTarget | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)

	const navigate = useCallback(
		(next: { topic?: string | null; page?: string | null }) => {
			const search = new URLSearchParams()
			if (next.topic) search.set('topic', next.topic)
			if (next.page) search.set('page', next.page)
			const query = search.toString()
			router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
		},
		[pathname, router]
	)

	const refreshTree = () => queryClient.invalidateQueries({ queryKey: TREE_KEY })

	const confirmDelete = async () => {
		if (!deleteTarget) return
		setIsDeleting(true)
		try {
			await libraryService.remove(deleteTarget.table, deleteTarget.id)
			if (deleteTarget.table === 'library_page') {
				queryClient.invalidateQueries({ queryKey: ['library', 'pages'] })
				navigate({ topic: topicId })
			} else {
				await refreshTree()
				if (
					(deleteTarget.table === 'library_topic' && deleteTarget.id === topicId) ||
					(deleteTarget.table === 'library_section' && deleteTarget.id === section?.id)
				)
					navigate({})
			}
			setDeleteTarget(null)
		} catch {
			toast.error('Не удалось удалить')
		} finally {
			setIsDeleting(false)
		}
	}

	const deleteDialog = deleteTarget && (
		<ConfirmDialog
			open
			title={
				deleteTarget.table === 'library_section'
					? 'Удалить раздел?'
					: deleteTarget.table === 'library_topic'
						? 'Удалить тему?'
						: 'Удалить лист?'
			}
			description={
				deleteTarget.table === 'library_page'
					? `«${deleteTarget.title || 'Без названия'}» исчезнет без возможности восстановления.`
					: `«${deleteTarget.title}» и всё, что внутри, исчезнет без возможности восстановления.`
			}
			isPending={isDeleting}
			onConfirm={confirmDelete}
			onClose={() => setDeleteTarget(null)}
		/>
	)

	// Открытый лист — как отдельная страница, без дерева и рамок
	if (pageId && topic) {
		return (
			<>
				<PageView
					key={pageId}
					pageId={pageId}
					topic={topic}
					section={section}
					onBack={() => navigate({ topic: topic.id })}
					onOpenRoot={() => navigate({})}
					onDelete={setDeleteTarget}
				/>
				{deleteDialog}
			</>
		)
	}

	return (
		<div>
			<Heading
				title='Архив'
				description='Разделы, темы и конспекты — с формулами, таблицами и файлами'
			/>
		<div className='grid gap-x-12 lg:grid-cols-[15rem_minmax(0,1fr)]'>
			{/* Дерево: на телефоне показывается, пока не выбрана тема */}
			<aside
				className={cn(
					'min-w-0',
					topicId ? 'hidden lg:block' : 'block'
				)}
			>
				<LibraryTree
					sections={sections}
					topics={topics}
					isLoading={isLoading}
					activeTopicId={topicId}
					onOpenTopic={id => navigate({ topic: id })}
					onChanged={refreshTree}
					onDelete={setDeleteTarget}
				/>
			</aside>

			<main className={cn('min-w-0', !topicId && 'hidden lg:block')}>
				{topic ? (
					<TopicView
						topic={topic}
						section={section}
						onBack={() => navigate({})}
						onOpenPage={id => navigate({ topic: topic.id, page: id })}
						onRenamed={refreshTree}
						onDelete={setDeleteTarget}
					/>
				) : (
					<EmptyState hasSections={sections.length > 0} />
				)}
			</main>
		</div>
			{deleteDialog}
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Дерево разделов и тем                                               */
/* ------------------------------------------------------------------ */

function LibraryTree({
	sections,
	topics,
	isLoading,
	activeTopicId,
	onOpenTopic,
	onChanged,
	onDelete
}: {
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	isLoading: boolean
	activeTopicId: string | null
	onOpenTopic: (id: string) => void
	onChanged: () => Promise<unknown>
	onDelete: (target: TypeDeleteTarget) => void
}) {
	const [isAdding, setIsAdding] = useState(false)
	const [addingTopicTo, setAddingTopicTo] = useState<string | null>(null)
	const [renaming, setRenaming] = useState<string | null>(null)
	const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

	const createSection = async (title: string) => {
		setIsAdding(false)
		if (!title) return
		try {
			await libraryService.createSection(title, sections.length)
			await onChanged()
		} catch {
			toast.error('Не удалось создать раздел')
		}
	}

	const createTopic = async (sectionId: string, title: string) => {
		setAddingTopicTo(null)
		if (!title) return
		try {
			const topic = await libraryService.createTopic(
				sectionId,
				title,
				topics.filter(item => item.section_id === sectionId).length
			)
			await onChanged()
			onOpenTopic(topic.id)
		} catch {
			toast.error('Не удалось создать тему')
		}
	}

	const rename = async (
		table: 'library_section' | 'library_topic',
		id: string,
		title: string
	) => {
		setRenaming(null)
		if (!title) return
		try {
			await libraryService.rename(table, id, title)
			await onChanged()
		} catch {
			toast.error('Не удалось переименовать')
		}
	}

	return (
		<div className='flex h-full flex-col'>
			<header className='flex h-10 shrink-0 items-center justify-between'>
				<span className='eyebrow'>Разделы</span>
				<IconButton
					label='Новый раздел'
					onClick={() => setIsAdding(true)}
				>
					<FolderPlus size={16} />
				</IconButton>
			</header>

			<div className='min-h-0 flex-1 py-1'>
				{isLoading && (
					<div className='space-y-2 px-4 py-2'>
						{[60, 75, 45].map(width => (
							<div
								key={width}
								className='h-4 animate-pulse bg-white/[0.05]'
								style={{ width: `${width}%` }}
							/>
						))}
					</div>
				)}

				{sections.map(section => {
					const sectionTopics = topics.filter(item => item.section_id === section.id)
					const isCollapsed = collapsed[section.id]
					return (
						<div
							key={section.id}
							className='mb-1'
						>
							{renaming === section.id ? (
								<InlineInput
									initial={section.title}
									onSubmit={title => rename('library_section', section.id, title)}
								/>
							) : (
								<Row
									onClick={() =>
										setCollapsed(state => ({ ...state, [section.id]: !isCollapsed }))
									}
									leading={
										<ChevronRight
											size={14}
											className={cn(
												'text-subtle transition-transform',
												!isCollapsed && 'rotate-90'
											)}
										/>
									}
									title={section.title}
									titleClassName='font-semibold text-fg'
									actions={
										<>
											<IconButton
												label='Новая тема'
												onClick={() => {
													setCollapsed(state => ({ ...state, [section.id]: false }))
													setAddingTopicTo(section.id)
												}}
											>
												<Plus size={14} />
											</IconButton>
											<IconButton
												label='Переименовать'
												onClick={() => setRenaming(section.id)}
											>
												<Pencil size={13} />
											</IconButton>
											<IconButton
												label='Удалить раздел'
												danger
												onClick={() =>
													onDelete({
														table: 'library_section',
														id: section.id,
														title: section.title
													})
												}
											>
												<Trash2 size={13} />
											</IconButton>
										</>
									}
								/>
							)}

							{!isCollapsed && (
								<div className='ml-[1.4rem] border-l border-border'>
									{sectionTopics.map(topic =>
										renaming === topic.id ? (
											<InlineInput
												key={topic.id}
												initial={topic.title}
												onSubmit={title => rename('library_topic', topic.id, title)}
											/>
										) : (
											<Row
												key={topic.id}
												active={topic.id === activeTopicId}
												onClick={() => onOpenTopic(topic.id)}
												title={topic.title}
												actions={
													<>
														<IconButton
															label='Переименовать'
															onClick={() => setRenaming(topic.id)}
														>
															<Pencil size={13} />
														</IconButton>
														<IconButton
															label='Удалить тему'
															danger
															onClick={() =>
																onDelete({
																	table: 'library_topic',
																	id: topic.id,
																	title: topic.title
																})
															}
														>
															<Trash2 size={13} />
														</IconButton>
													</>
												}
											/>
										)
									)}
									{addingTopicTo === section.id ? (
										<InlineInput
											placeholder='Название темы'
											onSubmit={title => createTopic(section.id, title)}
										/>
									) : (
										<button
											type='button'
											onClick={() => setAddingTopicTo(section.id)}
											className='flex h-9 w-full items-center gap-2 px-3 text-left text-sm text-subtle transition-colors hover:text-fg'
										>
											<Plus size={13} />
											Тема
										</button>
									)}
								</div>
							)}
						</div>
					)
				})}

				{isAdding ? (
					<InlineInput
						placeholder='Например: Подготовка к экзамену'
						onSubmit={createSection}
					/>
				) : (
					!isLoading && (
						<button
							type='button'
							onClick={() => setIsAdding(true)}
							className='mt-2 flex h-9 w-full items-center gap-2 px-2 text-sm text-subtle transition-colors hover:text-fg'
						>
							<FolderPlus size={14} />
							Новый раздел
						</button>
					)
				)}
			</div>
		</div>
	)
}

function Row({
	title,
	titleClassName,
	leading,
	actions,
	active,
	onClick
}: {
	title: string
	titleClassName?: string
	leading?: ReactNode
	actions?: ReactNode
	active?: boolean
	onClick: () => void
}) {
	return (
		<div
			className={cn(
				'group relative flex h-9 items-center gap-2 pl-2 pr-1 transition-colors',
				active
					? 'bg-white/[0.06] before:absolute before:inset-y-0 before:-left-px before:w-0.5 before:bg-primary'
					: 'hover:bg-white/[0.03]'
			)}
		>
			<button
				type='button'
				onClick={onClick}
				className='flex min-w-0 flex-1 items-center gap-2 text-left'
			>
				{leading}
				<span
					className={cn(
						'truncate text-sm',
						active ? 'text-fg' : 'text-muted',
						titleClassName
					)}
				>
					{title}
				</span>
			</button>
			<span className='flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 [@media(hover:none)]:opacity-100'>
				{actions}
			</span>
		</div>
	)
}

function InlineInput({
	initial = '',
	placeholder,
	onSubmit
}: {
	initial?: string
	placeholder?: string
	onSubmit: (value: string) => void
}) {
	const [value, setValue] = useState(initial)
	const done = useRef(false)
	const submit = (next: string) => {
		if (done.current) return
		done.current = true
		onSubmit(next.trim())
	}
	return (
		<div className='px-2 py-1'>
			<input
				autoFocus
				value={value}
				placeholder={placeholder}
				maxLength={200}
				onChange={event => setValue(event.target.value)}
				onKeyDown={event => {
					if (event.key === 'Enter') submit(value)
					if (event.key === 'Escape') submit(initial)
				}}
				onBlur={() => submit(value)}
				className='h-8 w-full border border-primary/60 bg-bg px-2 text-sm text-fg outline-none placeholder:text-subtle'
			/>
		</div>
	)
}

function IconButton({
	label,
	onClick,
	danger,
	children
}: {
	label: string
	onClick: () => void
	danger?: boolean
	children: ReactNode
}) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			onClick={event => {
				event.stopPropagation()
				onClick()
			}}
			className={cn(
				'grid h-7 w-7 place-items-center text-subtle transition-colors hover:bg-white/[0.06]',
				danger ? 'hover:text-danger' : 'hover:text-fg'
			)}
		>
			{children}
		</button>
	)
}

/* ------------------------------------------------------------------ */
/* Тема: список листов                                                  */
/* ------------------------------------------------------------------ */

function TopicView({
	topic,
	section,
	onBack,
	onOpenPage,
	onRenamed,
	onDelete
}: {
	topic: ILibraryTopic
	section?: ILibrarySection
	onBack: () => void
	onOpenPage: (id: string) => void
	onRenamed: () => Promise<unknown>
	onDelete: (target: TypeDeleteTarget) => void
}) {
	const queryClient = useQueryClient()
	const { data: pages, isLoading } = useQuery({
		queryKey: pagesKey(topic.id),
		queryFn: () => libraryService.getPages(topic.id),
		staleTime: 60 * 1000
	})
	const [isCreating, setIsCreating] = useState(false)
	const [isRenaming, setIsRenaming] = useState(false)

	const createPage = async () => {
		setIsCreating(true)
		try {
			const page = await libraryService.createPage(topic.id, pages?.length || 0)
			queryClient.setQueryData(pageKey(page.id), page)
			queryClient.invalidateQueries({ queryKey: pagesKey(topic.id) })
			onOpenPage(page.id)
		} catch {
			toast.error('Не удалось создать лист')
		} finally {
			setIsCreating(false)
		}
	}

	return (
		<div>
			<button
				type='button'
				onClick={onBack}
				className='mb-4 flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-fg lg:hidden'
			>
				<ArrowLeft size={15} />
				Разделы
			</button>

			<div className='flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5'>
				<div className='min-w-0'>
					{section && <p className='eyebrow'>{section.title}</p>}
					{isRenaming ? (
						<input
							autoFocus
							defaultValue={topic.title}
							maxLength={200}
							onBlur={async event => {
								setIsRenaming(false)
								const title = event.target.value.trim()
								if (title && title !== topic.title) {
									await libraryService.rename('library_topic', topic.id, title)
									await onRenamed()
								}
							}}
							onKeyDown={event => {
								if (event.key === 'Enter') event.currentTarget.blur()
							}}
							className='mt-2 w-full bg-transparent text-3xl font-semibold tracking-[-0.02em] text-fg outline-none'
						/>
					) : (
						<h1
							onDoubleClick={() => setIsRenaming(true)}
							className='mt-2 break-words text-3xl font-semibold tracking-[-0.02em] text-fg'
						>
							{topic.title}
						</h1>
					)}
					<p className='mt-2 font-mono text-xs text-subtle'>
						{pages ? `${pages.length} ${plural(pages.length, 'лист', 'листа', 'листов')}` : ' '}
					</p>
				</div>
				<div className='flex items-center gap-2'>
					<IconButton
						label='Удалить тему'
						danger
						onClick={() => onDelete({ table: 'library_topic', id: topic.id, title: topic.title })}
					>
						<Trash2 size={15} />
					</IconButton>
					<button
						type='button'
						onClick={createPage}
						disabled={isCreating}
						className='flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-50'
					>
						{isCreating ? (
							<Loader2
								size={15}
								className='animate-spin'
							/>
						) : (
							<FilePlus2 size={15} />
						)}
						Новый лист
					</button>
				</div>
			</div>

			{isLoading ? (
				<div className='mt-6 grid gap-3 sm:grid-cols-2 2xl:grid-cols-3'>
					{[0, 1, 2].map(item => (
						<div
							key={item}
							className='h-32 animate-pulse bg-white/[0.03]'
						/>
					))}
				</div>
			) : pages?.length ? (
				<div>
					{pages.map((page, index) => (
						<PageCard
							key={page.id}
							page={page}
							index={index}
							onOpen={() => onOpenPage(page.id)}
						/>
					))}
				</div>
			) : (
				<div className='mt-16 text-center'>
					<p className='text-sm text-muted'>В теме пока нет листов</p>
					<p className='mx-auto mt-1 max-w-sm text-xs leading-5 text-subtle'>
						Лист — это конспект: текст, формулы LaTeX, таблицы, фото, файлы и
						голосовые. Можно вставить готовый ответ нейросети — разметка сохранится.
					</p>
				</div>
			)}
		</div>
	)
}

function PageCard({
	page,
	index,
	onOpen
}: {
	page: ILibraryPageMeta
	index: number
	onOpen: () => void
}) {
	return (
		<button
			type='button'
			onClick={onOpen}
			className='group grid w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-b border-border py-5 text-left transition-colors sm:grid-cols-[3rem_minmax(0,1fr)_auto]'
		>
			<span className='pt-1 font-mono text-xs text-subtle'>{String(index + 1).padStart(2, '0')}</span>
			<span className='min-w-0'>
				<span className='block truncate text-lg font-medium text-fg transition-colors group-hover:text-primary'>
					{page.title || 'Без названия'}
				</span>
				<span className='mt-1 line-clamp-2 block text-sm leading-6 text-subtle'>
					{page.excerpt || 'Пустой лист'}
				</span>
			</span>
			<span className='col-start-2 mt-2 font-mono text-2xs uppercase tracking-wider text-subtle sm:col-start-3 sm:mt-1.5'>
				{dayjs(page.updated_at).locale('ru').format('D MMM, HH:mm')}
			</span>
		</button>
	)
}

/* ------------------------------------------------------------------ */
/* Лист: чтение по умолчанию, правка по кнопке                          */
/* ------------------------------------------------------------------ */

function PageView({
	pageId,
	topic,
	section,
	onBack,
	onOpenRoot,
	onDelete
}: {
	pageId: string
	topic: ILibraryTopic
	section?: ILibrarySection
	onBack: () => void
	onOpenRoot: () => void
	onDelete: (target: TypeDeleteTarget) => void
}) {
	const queryClient = useQueryClient()
	const { data: page, isLoading } = useQuery({
		queryKey: pageKey(pageId),
		queryFn: () => libraryService.getPage(pageId),
		staleTime: 60 * 1000
	})

	const [title, setTitle] = useState('')
	const [content, setContent] = useState('')
	const [isEditing, setIsEditing] = useState(false)
	const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
	const loaded = useRef(false)
	const dirty = useRef<{ title?: string; content?: string }>({})
	const timer = useRef<ReturnType<typeof setTimeout>>()

	useEffect(() => {
		if (!page || loaded.current) return
		loaded.current = true
		setTitle(page.title)
		setContent(page.content)
		// новый пустой лист сразу открываем на правку
		if (!page.title && !page.content) setIsEditing(true)
	}, [page])

	const flush = useCallback(async () => {
		clearTimeout(timer.current)
		const patch = dirty.current
		if (!Object.keys(patch).length) return
		dirty.current = {}
		setStatus('saving')
		try {
			const saved = await libraryService.updatePage(pageId, patch)
			setStatus('saved')
			queryClient.setQueryData(pageKey(pageId), (old: any) =>
				old ? { ...old, ...patch, updated_at: saved.updated_at } : old
			)
			queryClient.setQueryData(pagesKey(topic.id), (old: ILibraryPageMeta[] | undefined) =>
				old?.map(item =>
					item.id === pageId
						? {
								...item,
								...(patch.title !== undefined && { title: patch.title }),
								...(patch.content !== undefined && {
									excerpt: toExcerpt(patch.content.slice(0, 1500))
								}),
								updated_at: saved.updated_at
							}
						: item
				)
			)
		} catch {
			dirty.current = { ...patch, ...dirty.current }
			setStatus('error')
		}
	}, [pageId, queryClient, topic.id])

	const schedule = (patch: { title?: string; content?: string }) => {
		dirty.current = { ...dirty.current, ...patch }
		setStatus('saving')
		clearTimeout(timer.current)
		timer.current = setTimeout(flush, 900)
	}

	// Уходим со страницы — досохраняем
	useEffect(() => () => void flush(), [flush])

	if (isLoading || !page) {
		return (
			<div className='mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-8'>
				<div className='h-9 w-2/3 animate-pulse bg-white/[0.05]' />
				<div className='h-4 w-full animate-pulse bg-white/[0.04]' />
				<div className='h-4 w-5/6 animate-pulse bg-white/[0.04]' />
			</div>
		)
	}

	return (
		<article>
			<header className='sticky -top-2 z-20 -mx-4 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10'>
				<button
					type='button'
					onClick={async () => {
						await flush()
						onBack()
					}}
					className='flex shrink-0 items-center gap-1.5 text-sm text-subtle transition-colors hover:text-fg sm:hidden'
				>
					<ArrowLeft
						size={15}
						className='shrink-0'
					/>
					<span className='max-w-[40vw] truncate'>{topic.title}</span>
				</button>
				<nav
					aria-label='Путь'
					className='hidden min-w-0 items-center gap-2 text-sm text-subtle sm:flex'
				>
					<button
						type='button'
						onClick={async () => {
							await flush()
							onOpenRoot()
						}}
						className='shrink-0 transition-colors hover:text-fg'
					>
						Архив
					</button>
					{section && (
						<>
							<span className='text-white/15'>/</span>
							<span className='truncate'>{section.title}</span>
						</>
					)}
					<span className='text-white/15'>/</span>
					<button
						type='button'
						onClick={async () => {
							await flush()
							onBack()
						}}
						className='truncate transition-colors hover:text-fg'
					>
						{topic.title}
					</button>
				</nav>
				<div className='flex shrink-0 items-center gap-2'>
					<span className='hidden font-mono text-2xs uppercase tracking-wider text-subtle sm:inline'>
						{status === 'saving'
							? 'Сохранение…'
							: status === 'saved'
								? 'Сохранено'
								: status === 'error'
									? 'Ошибка сохранения'
									: ''}
					</span>
					<IconButton
						label='Удалить лист'
						danger
						onClick={() => onDelete({ table: 'library_page', id: page.id, title })}
					>
						<Trash2 size={15} />
					</IconButton>
					<button
						type='button'
						onClick={async () => {
							if (isEditing) await flush()
							setIsEditing(!isEditing)
						}}
						className={cn(
							'flex h-9 items-center gap-2 px-3.5 text-sm font-medium transition-colors',
							isEditing
								? 'bg-primary text-white hover:bg-primary-hover'
								: 'border border-border text-fg hover:bg-white/[0.05]'
						)}
					>
						{isEditing ? <Check size={15} /> : <Pencil size={14} />}
						{isEditing ? 'Готово' : 'Править'}
					</button>
				</div>
			</header>

			<div className='mx-auto max-w-3xl pb-24 pt-10 sm:pt-16'>
				{isEditing ? (
					<textarea
						value={title}
						rows={1}
						maxLength={300}
						placeholder='Название листа'
						onChange={event => {
							setTitle(event.target.value.replace(/\n/g, ' '))
							schedule({ title: event.target.value.replace(/\n/g, ' ') })
						}}
						ref={element => {
							if (element) {
								element.style.height = 'auto'
								element.style.height = `${element.scrollHeight}px`
							}
						}}
						className='w-full resize-none overflow-hidden bg-transparent text-3xl font-semibold leading-tight tracking-[-0.02em] text-fg outline-none placeholder:text-subtle sm:text-4xl'
					/>
				) : (
					<h1 className='break-words text-3xl font-semibold leading-tight tracking-[-0.02em] text-fg sm:text-4xl'>
						{title || 'Без названия'}
					</h1>
				)}
				<p className='mb-8 mt-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
					{dayjs(page.updated_at).locale('ru').format('D MMMM YYYY, HH:mm')}
				</p>

				<RichEditor
					value={content}
					editable={isEditing}
					onChange={value => {
						setContent(value)
						schedule({ content: value })
					}}
					placeholder='Пишите или вставьте конспект. Формулы: $x^2$ в строке, $$\int f(x)\,dx$$ отдельно.'
					className='library-page bg-bg [&_[role=toolbar]]:top-12'
					contentClassName={cn('min-h-[50vh]', !isEditing && 'library-reading')}
				/>

				{!isEditing && !content.trim() && (
					<button
						type='button'
						onClick={() => setIsEditing(true)}
						className='mt-2 text-sm text-primary hover:underline'
					>
						Начать писать
					</button>
				)}
			</div>
		</article>
	)
}

function EmptyState({ hasSections }: { hasSections: boolean }) {
	return (
		<div className='flex min-h-[22rem] flex-col items-center justify-center px-6 text-center lg:items-start lg:pt-10 lg:text-left'>
			<p className='eyebrow'>Архив</p>
			<h2 className='mt-3 text-2xl font-semibold tracking-[-0.02em] text-fg'>
				{hasSections ? 'Выберите тему слева' : 'Соберите свою библиотеку знаний'}
			</h2>
			<p className='mt-3 max-w-md text-sm leading-6 text-subtle'>
				Разделы — для больших направлений («Подготовка к экзамену», «Английский»,
				«Личный проект»), внутри — темы, в темах — конспекты с формулами, таблицами,
				фото и файлами.
			</p>
		</div>
	)
}

const plural = (value: number, one: string, few: string, many: string) => {
	const mod10 = value % 10
	const mod100 = value % 100
	if (mod10 === 1 && mod100 !== 11) return one
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
	return many
}
