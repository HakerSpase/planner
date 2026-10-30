'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {
	ArrowLeft,
	Brain,
	Eye,
	Check,
	ChevronRight,
	FilePlus2,
	FolderTree,
	FolderPlus,
	ListTree,
	Maximize2,
	Minimize2,
	Pencil,
	Plus,
	Trash2,
	Waypoints
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { MathExcerpt } from '@/components/editor/MathExcerpt'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import { useBackClose } from '@/hooks/useBackClose'
import { useLocalStorage } from '@/hooks/useLocalStorage'

import { LibrarySearch } from './LibrarySearch'
import {
	OutlineSheet,
	PageBacklinks,
	PageMenu,
	PageOutline,
	ReadingProgress,
	ShareDialog,
	useHeadings
} from './PageTools'
import { Heading } from '@/components/ui/Heading'

import {
	type ILibraryPageMeta,
	type ILibrarySection,
	type ILibraryTopic,
	libraryService,
	newLibraryId,
	toExcerpt
} from '@/services/library.service'

const LibraryGraph = dynamic(() => import('./LibraryGraph').then(mod => mod.LibraryGraph), {
	ssr: false,
	loading: () => <div className='h-[min(70vh,44rem)] animate-pulse border border-border bg-white/[0.02]' />
})

const LibraryCards = dynamic(() => import('./LibraryCards').then(mod => mod.LibraryCards), {
	ssr: false,
	loading: () => <div className='h-64 animate-pulse border border-border bg-white/[0.02]' />
})

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{ ssr: false, loading: () => <div className='h-64 animate-pulse bg-white/[0.02]' /> }
)

const TREE_KEY = ['library', 'tree']
const pagesKey = (topicId: string) => ['library', 'pages', topicId]
const pageKey = (pageId: string) => ['library', 'page', pageId]

type TypeTree = { sections: ILibrarySection[]; topics: ILibraryTopic[] }

/** Создание и переименование без ожидания базы: дерево меняется сразу, запись идёт фоном */
function useTreeActions() {
	const queryClient = useQueryClient()
	const patchTree = (update: (tree: TypeTree) => TypeTree) =>
		queryClient.setQueryData<TypeTree>(TREE_KEY, old => (old ? update(old) : old))
	const resync = (message: string) => {
		toast.error(message)
		queryClient.invalidateQueries({ queryKey: TREE_KEY })
	}

	return {
		addSection(title: string, order: number) {
			const id = newLibraryId()
			patchTree(tree => ({ ...tree, sections: [...tree.sections, { id, title, order }] }))
			libraryService
				.createSection(id, title, order)
				.catch(() => resync('Не удалось создать раздел'))
			return id
		},
		addTopic(sectionId: string, title: string, order: number) {
			const id = newLibraryId()
			patchTree(tree => ({
				...tree,
				topics: [...tree.topics, { id, section_id: sectionId, title, order }]
			}))
			libraryService
				.createTopic(id, sectionId, title, order)
				.catch(() => resync('Не удалось создать тему'))
			return id
		},
		rename(table: 'library_section' | 'library_topic', id: string, title: string) {
			const key = table === 'library_section' ? 'sections' : 'topics'
			patchTree(tree => ({
				...tree,
				[key]: tree[key].map(item => (item.id === id ? { ...item, title } : item))
			}))
			libraryService.rename(table, id, title).catch(() => resync('Не удалось переименовать'))
		}
	}
}

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
	const sectionId = params.get('section')
	const view = params.get('view')
	const isGraph = view === 'graph'
	const isCards = view === 'cards'

	const { data: tree, isLoading } = useQuery({
		queryKey: TREE_KEY,
		queryFn: libraryService.getTree,
		staleTime: 5 * 60 * 1000
	})
	const sections = tree?.sections || []
	const topics = tree?.topics || []
	const topic = topics.find(item => item.id === topicId)
	const section = sections.find(item => item.id === (topic?.section_id ?? sectionId))

	const [deleteTarget, setDeleteTarget] = useState<TypeDeleteTarget | null>(null)
	const [isDeleting, setIsDeleting] = useState(false)

	const navigate = useCallback(
		(next: {
			topic?: string | null
			page?: string | null
			section?: string | null
			view?: 'graph' | 'cards' | null
		}) => {
			const search = new URLSearchParams()
			if (next.view) search.set('view', next.view)
			if (next.section) search.set('section', next.section)
			if (next.topic) search.set('topic', next.topic)
			if (next.page) search.set('page', next.page)
			const query = search.toString()
			router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
		},
		[pathname, router]
	)

	const refreshTree = () => queryClient.invalidateQueries({ queryKey: TREE_KEY })

	// Файл догрузился в закрытый лист — сбрасываем кэш, чтобы открыть уже с ним
	useEffect(() => {
		const onPatched = (event: Event) => {
			const { context } = (event as CustomEvent).detail
			if (context.type !== 'page') return
			queryClient.invalidateQueries({ queryKey: pageKey(context.id) })
			queryClient.invalidateQueries({ queryKey: ['library', 'pages'] })
		}
		window.addEventListener('planner:note-patched', onPatched)
		return () => window.removeEventListener('planner:note-patched', onPatched)
	}, [queryClient])

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
					onOpenSection={id => navigate({ section: id })}
					onOpenPage={(topic, page) => navigate({ topic, page })}
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
			<div className='mb-6 flex flex-wrap items-start gap-2'>
				<div className='min-w-0 max-w-xl flex-1 basis-64'>
					<LibrarySearch
						sections={sections}
						topics={topics}
						onOpenPage={(topic, page) => navigate({ topic, page })}
						onOpenTopic={topic => navigate({ topic })}
						onOpenSection={id => navigate({ section: id })}
					/>
				</div>
				<div
					role='tablist'
					aria-label='Вид архива'
					className='flex h-11 w-full divide-x divide-border border border-border sm:w-auto'
				>
					<ViewTab
						active={!isGraph && !isCards}
						onClick={() => navigate({})}
					>
						<FolderTree size={15} />
						Разделы
					</ViewTab>
					<ViewTab
						active={isGraph}
						onClick={() => navigate({ view: 'graph' })}
					>
						<Waypoints size={15} />
						Граф
					</ViewTab>
					<ViewTab
						active={isCards}
						onClick={() => navigate({ view: 'cards' })}
					>
						<Brain size={15} />
						Карточки
					</ViewTab>
				</div>
			</div>

			{isCards ? (
				<LibraryCards
					sections={sections}
					topics={topics}
					onOpenPage={(topic, page) => navigate({ topic, page })}
				/>
			) : isGraph ? (
				<LibraryGraph
					sections={sections}
					topics={topics}
					onOpenPage={(topic, page) => navigate({ topic, page })}
					onOpenTopic={topic => navigate({ topic })}
				/>
			) : (
				<div className='grid gap-x-12 lg:grid-cols-[17rem_minmax(0,1fr)]'>
					{/* Дерево: на телефоне показывается, пока не выбрана тема */}
					<aside className={cn('min-w-0', topicId || sectionId ? 'hidden lg:block' : 'block')}>
						<LibraryTree
							sections={sections}
							topics={topics}
							isLoading={isLoading}
							activeTopicId={topicId}
							onOpenTopic={id => navigate({ topic: id })}
							onOpenSection={id => navigate({ section: id })}
							activeSectionId={!topicId ? sectionId : null}
							onDelete={setDeleteTarget}
						/>
					</aside>

					<main className={cn('min-w-0', !topicId && !sectionId && 'hidden lg:block')}>
						{!topic && section ? (
							<SectionView
								section={section}
								topics={topics.filter(item => item.section_id === section.id)}
								onBack={() => navigate({})}
								onOpenTopic={id => navigate({ topic: id })}
							/>
						) : topic ? (
							<TopicView
								topic={topic}
								section={section}
								onBack={() => navigate({})}
								onOpenPage={id => navigate({ topic: topic.id, page: id })}
								onDelete={setDeleteTarget}
							/>
						) : (
							<EmptyState hasSections={sections.length > 0} />
						)}
					</main>
				</div>
			)}
			{deleteDialog}
		</div>
	)
}

function ViewTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
	return (
		<button
			type='button'
			role='tab'
			aria-selected={active}
			onClick={onClick}
			className={cn(
				'flex flex-1 items-center justify-center gap-2 px-2.5 text-sm transition-colors sm:flex-none sm:px-3.5',
				active ? 'bg-white/[0.08] text-fg' : 'text-muted hover:text-fg'
			)}
		>
			{children}
		</button>
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
	activeSectionId,
	onOpenTopic,
	onOpenSection,
	onDelete
}: {
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	isLoading: boolean
	activeTopicId: string | null
	activeSectionId?: string | null
	onOpenTopic: (id: string) => void
	onOpenSection: (id: string) => void
	onDelete: (target: TypeDeleteTarget) => void
}) {
	const [isAdding, setIsAdding] = useState(false)
	const [addingTopicTo, setAddingTopicTo] = useState<string | null>(null)
	const [renaming, setRenaming] = useState<string | null>(null)
	// Свёрнутые разделы запоминаем на устройстве
	const [collapsed, setCollapsed] = useLocalStorage<Record<string, boolean>>({
		key: 'library-collapsed',
		defaultValue: {}
	})

	const actions = useTreeActions()

	const createSection = (title: string) => {
		setIsAdding(false)
		if (title) actions.addSection(title, sections.length)
	}

	const createTopic = (sectionId: string, title: string) => {
		setAddingTopicTo(null)
		if (!title) return
		onOpenTopic(
			actions.addTopic(
				sectionId,
				title,
				topics.filter(item => item.section_id === sectionId).length
			)
		)
	}

	const rename = (table: 'library_section' | 'library_topic', id: string, title: string) => {
		setRenaming(null)
		if (title) actions.rename(table, id, title)
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
									onClick={() => onOpenSection(section.id)}
									active={section.id === activeSectionId}
									leading={
										<span
											role='button'
											tabIndex={0}
											aria-label={isCollapsed ? 'Развернуть раздел' : 'Свернуть раздел'}
											onClick={event => {
												event.stopPropagation()
												setCollapsed(state => ({ ...state, [section.id]: !isCollapsed }))
											}}
											className='-m-1 grid h-6 w-6 shrink-0 place-items-center'
										>
											<ChevronRight
												size={14}
												className={cn(
													'text-subtle transition-transform',
													!isCollapsed && 'rotate-90'
												)}
											/>
										</span>
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
				'group relative flex min-h-9 items-center gap-2 py-1 pl-2 pr-1 transition-colors',
				active
					? 'bg-white/[0.06] before:absolute before:inset-y-0 before:-left-px before:w-0.5 before:bg-primary'
					: 'hover:bg-white/[0.03]'
			)}
		>
			<button
				type='button'
				onClick={onClick}
				title={title}
				className='flex min-w-0 flex-1 items-center gap-2 text-left'
			>
				{leading}
				{/* Длинное название — в две строки, а не обрезка на полуслове */}
				<span
					className={cn(
						'line-clamp-2 min-w-0 break-words text-sm leading-5',
						active ? 'text-fg' : 'text-muted',
						titleClassName
					)}
				>
					{title}
				</span>
			</button>
			{/* На компьютере кнопки всплывают поверх строки и не отнимают место у названия */}
			<span className='flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:hover)]:absolute [@media(hover:hover)]:inset-y-0 [@media(hover:hover)]:right-0 [@media(hover:hover)]:bg-gradient-to-l [@media(hover:hover)]:from-bg [@media(hover:hover)]:from-70% [@media(hover:hover)]:to-transparent [@media(hover:hover)]:pl-6 [@media(hover:hover)]:pr-1 [@media(hover:none)]:opacity-100'>
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
	onDelete
}: {
	topic: ILibraryTopic
	section?: ILibrarySection
	onBack: () => void
	onOpenPage: (id: string) => void
	onDelete: (target: TypeDeleteTarget) => void
}) {
	const queryClient = useQueryClient()
	const { data: pages, isLoading } = useQuery({
		queryKey: pagesKey(topic.id),
		queryFn: () => libraryService.getPages(topic.id),
		staleTime: 60 * 1000
	})
	const [isRenaming, setIsRenaming] = useState(false)

	const actions = useTreeActions()

	// Лист появляется и открывается сразу, в базу он уходит фоном
	const createPage = () => {
		const id = newLibraryId()
		const order = pages?.length || 0
		const page = {
			id,
			topic_id: topic.id,
			title: '',
			content: '',
			order,
			updated_at: new Date().toISOString(),
			excerpt: ''
		}
		queryClient.setQueryData(pageKey(id), page)
		queryClient.setQueryData<ILibraryPageMeta[]>(pagesKey(topic.id), old => [
			...(old || []),
			page
		])
		onOpenPage(id)
		libraryService.createPage(id, topic.id, order).catch(() => {
			toast.error('Не удалось создать лист')
			queryClient.invalidateQueries({ queryKey: pagesKey(topic.id) })
		})
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
							onBlur={event => {
								setIsRenaming(false)
								const title = event.target.value.trim()
								if (title && title !== topic.title) actions.rename('library_topic', topic.id, title)
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
						className='flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
					>
						<FilePlus2 size={15} />
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
			className='lazy-paint group grid w-full grid-cols-[2.5rem_minmax(0,1fr)] gap-x-2 border-b border-border py-5 text-left transition-colors sm:grid-cols-[3rem_minmax(0,1fr)_auto]'
		>
			<span className='pt-1 font-mono text-xs text-subtle'>{String(index + 1).padStart(2, '0')}</span>
			<span className='min-w-0'>
				<span className='block truncate text-lg font-medium text-fg transition-colors group-hover:text-primary'>
					{page.title || 'Без названия'}
				</span>
				<span className='mt-1 line-clamp-2 text-sm leading-6 text-subtle sm:line-clamp-3'>
					{page.excerpt ? <MathExcerpt text={page.excerpt} /> : 'Пустой лист'}
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
	onOpenSection,
	onOpenPage,
	onDelete
}: {
	pageId: string
	topic: ILibraryTopic
	section?: ILibrarySection
	onBack: () => void
	onOpenRoot: () => void
	onOpenSection: (id: string) => void
	onOpenPage: (topicId: string, pageId: string) => void
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

	// Чтение: оглавление, прогресс, проверка, ссылка «поделиться», полный экран
	const articleRef = useRef<HTMLElement>(null)
	const [selfCheck, setSelfCheck] = useState(false)
	const [outlineOpen, setOutlineOpen] = useState(false)
	const [showOutline, setShowOutline] = useLocalStorage<boolean>({
		key: 'planner:library:outline-visible',
		defaultValue: true
	})
	const [shareOpen, setShareOpen] = useState(false)
	const [isFocus, setIsFocus] = useState(false)
	const headings = useHeadings(articleRef, `${isEditing}:${Boolean(page)}:${isFocus}`)

	const enterFocus = () => {
		setIsFocus(true)
		document.documentElement.requestFullscreen?.().catch(() => {})
	}
	const exitFocus = useCallback(() => {
		setIsFocus(false)
		if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
	}, [])
	useBackClose(isFocus, exitFocus)
	useEffect(() => {
		if (!isFocus) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') exitFocus()
		}
		const onFullscreen = () => {
			if (!document.fullscreenElement) setIsFocus(false)
		}
		window.addEventListener('keydown', onKey)
		document.addEventListener('fullscreenchange', onFullscreen)
		return () => {
			window.removeEventListener('keydown', onKey)
			document.removeEventListener('fullscreenchange', onFullscreen)
		}
	}, [isFocus, exitFocus])

	if (isLoading || !page) {
		return (
			<div className='mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-8'>
				<div className='h-9 w-2/3 animate-pulse bg-white/[0.05]' />
				<div className='h-4 w-full animate-pulse bg-white/[0.04]' />
				<div className='h-4 w-5/6 animate-pulse bg-white/[0.04]' />
			</div>
		)
	}

	const articleBody = (
		<article
			ref={articleRef}
			className={cn('library-article', isFocus && 'mx-auto max-w-6xl')}
		>
			<header
				className={cn(
					'sticky z-20 -mx-4 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg px-4 print:hidden sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10',
					isFocus
						? 'top-0'
						: 'top-[calc(-1*max(0.5rem,env(safe-area-inset-top)))] lg:-top-3'
				)}
			>
				<ReadingProgress anchorRef={articleRef} />
				<button
					type='button'
					onClick={async () => {
						if (isFocus) {
							exitFocus()
							return
						}
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
							if (isFocus) exitFocus()
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
							<button
								type='button'
								onClick={async () => {
									if (isFocus) exitFocus()
									await flush()
									onOpenSection(section.id)
								}}
								className='truncate transition-colors hover:text-fg'
							>
								{section.title}
							</button>
						</>
					)}
					<span className='text-white/15'>/</span>
					<button
						type='button'
						onClick={async () => {
							if (isFocus) exitFocus()
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
					{selfCheck && !isEditing && (
						<button
							type='button'
							onClick={() => setSelfCheck(false)}
							className='hidden h-9 items-center gap-1.5 border border-primary/60 px-3 text-sm text-fg sm:flex'
						>
							<Eye size={14} />
							Проверка
						</button>
					)}
					{headings.length > 1 && (
						<button
							type='button'
							onClick={() => setShowOutline(value => !value)}
							title={showOutline ? 'Скрыть содержание' : 'Показать содержание'}
							aria-label={showOutline ? 'Скрыть содержание' : 'Показать содержание'}
							className={cn(
								'hidden h-9 w-9 place-items-center border border-border transition-colors xl:grid',
								showOutline ? 'bg-white/[0.06] text-fg' : 'text-subtle hover:text-fg'
							)}
						>
							<ListTree size={15} />
						</button>
					)}
					<PageMenu
						selfCheck={selfCheck}
						onToggleSelfCheck={() => {
							setSelfCheck(value => !value)
							setIsEditing(false)
						}}
						onOpenOutline={() => setOutlineOpen(true)}
						showOutline={headings.length > 1 ? showOutline : undefined}
						onToggleOutline={
							headings.length > 1 ? () => setShowOutline(value => !value) : undefined
						}
						onShare={() => setShareOpen(true)}
						onDelete={() => onDelete({ table: 'library_page', id: page.id, title })}
					/>
					<button
						type='button'
						onClick={async () => {
							if (isEditing) await flush()
							setIsEditing(!isEditing)
							setSelfCheck(false)
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
					{isFocus ? (
						<button
							type='button'
							onClick={exitFocus}
							title='Выйти из полноэкранного режима (Esc)'
							className='flex h-9 items-center gap-2 border border-border px-3 text-sm text-muted transition-colors hover:text-fg'
						>
							<Minimize2 size={14} />
							<span className='hidden sm:inline'>Выйти · Esc</span>
						</button>
					) : (
						<button
							type='button'
							onClick={enterFocus}
							title='На весь экран (выход — Esc)'
							aria-label='На весь экран'
							className='grid h-9 w-9 place-items-center border border-border text-subtle transition-colors hover:text-fg'
						>
							<Maximize2 size={15} />
						</button>
					)}
				</div>
			</header>

			<div
				className={cn(
					'grid w-full grid-cols-[minmax(0,1fr)] gap-10 pb-24 pt-10 sm:pt-14',
					headings.length > 1 && showOutline && 'xl:grid-cols-[minmax(0,1fr)_13rem]'
				)}
			>
			<div className='min-w-0'>
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
					uploadContext={{ type: 'page', id: pageId }}
					editable={isEditing}
					onChange={value => {
						setContent(value)
						schedule({ content: value })
					}}
					placeholder='Пишите или вставьте конспект. Формулы: $x^2$ в строке, $$\int f(x)\,dx$$ отдельно.'
					className={cn(
						'library-page [&_[role=toolbar]]:top-12',
						isEditing ? 'bg-bg' : 'bg-transparent'
					)}
					contentClassName={cn('min-h-[50vh]', !isEditing && 'library-reading')}
					selfCheck={selfCheck && !isEditing}
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

				{!isEditing && (
					<div className='print:hidden'>
						<PageBacklinks
							pageId={pageId}
							title={title}
							onOpen={onOpenPage}
						/>
					</div>
				)}
			</div>

			{/* Оглавление сбоку — на широком экране, скрывается по желанию */}
			{headings.length > 1 && showOutline && (
				<aside className='hidden print:hidden xl:block'>
					<div className='sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
						<p className='eyebrow mb-3'>Содержание</p>
						<PageOutline headings={headings} />
					</div>
				</aside>
			)}
			</div>

			{selfCheck && (
				<p className='fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 border border-primary/40 bg-elevated px-4 py-2 text-xs text-muted shadow-pop print:hidden lg:bottom-6'>
					Режим проверки: нажмите на размытое, чтобы открыть
				</p>
			)}
			{outlineOpen && (
				<OutlineSheet
					headings={headings}
					onClose={() => setOutlineOpen(false)}
				/>
			)}
			{shareOpen && (
				<ShareDialog
					pageId={pageId}
					onClose={() => setShareOpen(false)}
				/>
			)}
		</article>
	)

	if (isFocus && typeof document !== 'undefined') {
		return createPortal(
			<div
				data-scroll-root
				className='fixed inset-0 z-[120] animate-fade-in overflow-y-auto overscroll-contain bg-bg px-4 pt-[env(safe-area-inset-top)] sm:px-6 lg:px-8 xl:px-10'
			>
				{articleBody}
			</div>,
			document.body
		)
	}

	return articleBody
}

function SectionView({
	section,
	topics,
	onBack,
	onOpenTopic,
}: {
	section: ILibrarySection
	topics: ILibraryTopic[]
	onBack: () => void
	onOpenTopic: (id: string) => void
}) {
	const [isAdding, setIsAdding] = useState(false)

	const actions = useTreeActions()

	const createTopic = (title: string) => {
		setIsAdding(false)
		if (title) onOpenTopic(actions.addTopic(section.id, title, topics.length))
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
					<p className='eyebrow'>Раздел</p>
					<h1 className='mt-2 break-words text-3xl font-semibold tracking-[-0.02em] text-fg'>
						{section.title}
					</h1>
					<p className='mt-2 font-mono text-xs text-subtle'>
						{topics.length} {plural(topics.length, 'тема', 'темы', 'тем')}
					</p>
				</div>
				<button
					type='button'
					onClick={() => setIsAdding(true)}
					className='flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
				>
					<Plus size={15} />
					Новая тема
				</button>
			</div>

			{isAdding && (
				<div className='border-b border-border py-3'>
					<InlineInput
						placeholder='Название темы'
						onSubmit={createTopic}
					/>
				</div>
			)}

			{topics.length ? (
				topics.map((topic, index) => (
					<button
						key={topic.id}
						type='button'
						onClick={() => onOpenTopic(topic.id)}
						className='group grid w-full grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-2 border-b border-border py-5 text-left sm:grid-cols-[3rem_minmax(0,1fr)_auto]'
					>
						<span className='font-mono text-xs text-subtle'>{String(index + 1).padStart(2, '0')}</span>
						<span className='truncate text-lg font-medium text-fg transition-colors group-hover:text-primary'>
							{topic.title}
						</span>
						<ChevronRight
							size={16}
							className='text-subtle transition-transform group-hover:translate-x-0.5'
						/>
					</button>
				))
			) : (
				<p className='py-16 text-center text-sm text-subtle'>В разделе пока нет тем</p>
			)}
		</div>
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
