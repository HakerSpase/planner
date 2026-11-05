'use client'

import {
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors
} from '@dnd-kit/core'
import {
	SortableContext,
	arrayMove,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {
	ArrowLeft,
	Brain,
	Check,
	ChevronRight,
	Eye,
	FilePlus2,
	FolderPlus,
	FolderTree,
	GripVertical,
	ListTree,
	Maximize2,
	MoreHorizontal,
	Minimize2,
	Pencil,
	Pin,
	Plus,
	Trash2,
	Waypoints
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
	type MutableRefObject,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState
} from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { MathExcerpt } from '@/components/editor/MathExcerpt'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Heading } from '@/components/ui/Heading'

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
import { isSpeechSupported, speak, speechFromNode } from '@/lib/speech'
import {
	type ILibraryPageMeta,
	type ILibrarySection,
	type ILibraryTopic,
	libraryService,
	newLibraryId,
	describeContents,
	toExcerpt
} from '@/services/library.service'

import {
	EMPTY_PANE,
	type ILibraryTab,
	LibraryTabBar,
	useCanSplit,
	useFillHeight,
	useLibraryTabs
} from './LibraryTabs'

const LibraryGraph = dynamic(
	() => import('./LibraryGraph').then(mod => mod.LibraryGraph),
	{
		ssr: false,
		loading: () => (
			<div className='h-[min(70vh,44rem)] animate-pulse border border-border bg-white/[0.02]' />
		)
	}
)

const LibraryCards = dynamic(
	() => import('./LibraryCards').then(mod => mod.LibraryCards),
	{
		ssr: false,
		loading: () => (
			<div className='h-64 animate-pulse border border-border bg-white/[0.02]' />
		)
	}
)

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{
		ssr: false,
		loading: () => <div className='h-64 animate-pulse bg-white/[0.02]' />
	}
)

const TREE_KEY = ['library', 'tree']
const pagesKey = (topicId: string) => ['library', 'pages', topicId]
const pageKey = (pageId: string) => ['library', 'page', pageId]

// Где остановились в каждом листе — для возврата на вкладку
const scrollPositions = new Map<string, number>()

type TypeTree = { sections: ILibrarySection[]; topics: ILibraryTopic[] }

const sortByPinAndOrder = <T extends { is_pinned?: boolean; order: number }>(
	items: T[]
): T[] =>
	[...items].sort(
		(a, b) =>
			Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) ||
			a.order - b.order
	)

const reorderWithinGroup = <
	T extends { id: string; is_pinned?: boolean; order: number }
>(
	items: T[],
	activeId: string,
	overId: string
): T[] | null => {
	const sorted = sortByPinAndOrder(items)
	const activeItem = sorted.find(item => item.id === activeId)
	const overItem = sorted.find(item => item.id === overId)
	if (!activeItem || !overItem || activeId === overId) return null

	const isPinned = Boolean(activeItem.is_pinned)
	const pinned = sorted.filter(item => Boolean(item.is_pinned))
	const unpinned = sorted.filter(item => !item.is_pinned)
	const group = isPinned ? pinned : unpinned

	const oldIndex = group.findIndex(item => item.id === activeId)
	if (oldIndex === -1) return null

	let newIndex = group.findIndex(item => item.id === overId)
	if (newIndex === -1) {
		newIndex = isPinned ? group.length - 1 : 0
	}
	if (oldIndex === newIndex) return null

	const movedGroup = arrayMove(group, oldIndex, newIndex)
	const combined = isPinned
		? [...movedGroup, ...unpinned]
		: [...pinned, ...movedGroup]
	return combined.map((item, index) => ({ ...item, order: index }))
}

function useLibraryDndSensors() {
	return useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 5 }
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates
		})
	)
}

type TypeDragHandleProps = {
	attributes: ReturnType<typeof useSortable>['attributes']
	listeners: ReturnType<typeof useSortable>['listeners']
}

function SortableItem({
	id,
	className,
	children
}: {
	id: string
	className?: string
	children: (dragHandleProps: TypeDragHandleProps) => ReactNode
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging
	} = useSortable({ id })

	return (
		<div
			ref={setNodeRef}
			style={{
				transform: CSS.Transform.toString(transform),
				transition
			}}
			className={cn(className, isDragging && 'relative z-20 opacity-75')}
		>
			{children({ attributes, listeners })}
		</div>
	)
}

/** Создание, переименование, закрепление и сортировка без ожидания базы: дерево меняется сразу, запись идёт фоном */
function useTreeActions() {
	const queryClient = useQueryClient()
	const patchTree = (update: (tree: TypeTree) => TypeTree) =>
		queryClient.setQueryData<TypeTree>(TREE_KEY, old =>
			old ? update(old) : old
		)
	const resync = (message: string) => {
		toast.error(message)
		queryClient.invalidateQueries({ queryKey: TREE_KEY })
	}

	return {
		addSection(title: string, order: number) {
			const id = newLibraryId()
			patchTree(tree => ({
				...tree,
				sections: sortByPinAndOrder([
					...tree.sections,
					{ id, title, order, is_pinned: false }
				])
			}))
			libraryService
				.createSection(id, title, order)
				.catch(() => resync('Не удалось создать раздел'))
			return id
		},
		addTopic(sectionId: string, title: string, order: number) {
			const id = newLibraryId()
			patchTree(tree => ({
				...tree,
				topics: sortByPinAndOrder([
					...tree.topics,
					{ id, section_id: sectionId, title, order, is_pinned: false }
				])
			}))
			libraryService
				.createTopic(id, sectionId, title, order)
				.catch(() => resync('Не удалось создать тему'))
			return id
		},
		rename(
			table: 'library_section' | 'library_topic',
			id: string,
			title: string
		) {
			const key = table === 'library_section' ? 'sections' : 'topics'
			patchTree(tree => ({
				...tree,
				[key]: tree[key].map(item =>
					item.id === id ? { ...item, title } : item
				)
			}))
			libraryService
				.rename(table, id, title)
				.catch(() => resync('Не удалось переименовать'))
		},
		setPinned(
			table: 'library_section' | 'library_topic',
			id: string,
			isPinned: boolean
		) {
			const key = table === 'library_section' ? 'sections' : 'topics'
			patchTree(tree => ({
				...tree,
				[key]: sortByPinAndOrder(
					tree[key].map(item =>
						item.id === id ? { ...item, is_pinned: isPinned } : item
					)
				)
			}))
			libraryService
				.setPinned(table, id, isPinned)
				.catch(() => resync('Не удалось обновить закрепление'))
		},
		reorderSections(nextSections: ILibrarySection[]) {
			patchTree(tree => ({
				...tree,
				sections: nextSections
			}))
			libraryService
				.reorder(
					'library_section',
					nextSections.map(item => item.id)
				)
				.catch(() => resync('Не удалось изменить порядок разделов'))
		},
		reorderTopics(sectionId: string, nextSectionTopics: ILibraryTopic[]) {
			const byId = new Map(nextSectionTopics.map(item => [item.id, item]))
			patchTree(tree => ({
				...tree,
				topics: sortByPinAndOrder(
					tree.topics.map(item =>
						item.section_id === sectionId ? (byId.get(item.id) ?? item) : item
					)
				)
			}))
			libraryService
				.reorder(
					'library_topic',
					nextSectionTopics.map(item => item.id)
				)
				.catch(() => resync('Не удалось изменить порядок тем'))
		},
		moveTopic(topicId: string, targetSectionId: string, targetOrder: number) {
			patchTree(tree => ({
				...tree,
				topics: sortByPinAndOrder(
					tree.topics.map(item =>
						item.id === topicId
							? { ...item, section_id: targetSectionId, order: targetOrder }
							: item
					)
				)
			}))
			libraryService
				.moveTopic(topicId, targetSectionId, targetOrder)
				.catch(() => resync('Не удалось переместить тему'))
		},
		setPagePinned(topicId: string, pageId: string, isPinned: boolean) {
			queryClient.setQueryData<ILibraryPageMeta[]>(pagesKey(topicId), old =>
				old
					? sortByPinAndOrder(
							old.map(item =>
								item.id === pageId ? { ...item, is_pinned: isPinned } : item
							)
						)
					: old
			)
			queryClient.setQueryData(pageKey(pageId), (old: any) =>
				old ? { ...old, is_pinned: isPinned } : old
			)
			libraryService.setPinned('library_page', pageId, isPinned).catch(() => {
				toast.error('Не удалось обновить закрепление')
				queryClient.invalidateQueries({ queryKey: pagesKey(topicId) })
			})
		},
		reorderPages(topicId: string, nextPages: ILibraryPageMeta[]) {
			queryClient.setQueryData<ILibraryPageMeta[]>(pagesKey(topicId), nextPages)
			libraryService
				.reorder(
					'library_page',
					nextPages.map(item => item.id)
				)
				.catch(() => {
					toast.error('Не удалось изменить порядок листов')
					queryClient.invalidateQueries({ queryKey: pagesKey(topicId) })
				})
		}
	}
}

type TypeDeleteTarget =
	| { table: 'library_section'; id: string; title: string }
	| { table: 'library_topic'; id: string; title: string }
	| { table: 'library_page'; id: string; title: string }

type TypeUnpinTarget =
	| { table: 'library_section'; id: string; title: string }
	| { table: 'library_topic'; id: string; title: string }
	| { table: 'library_page'; id: string; topicId: string; title: string }

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
	const section = sections.find(
		item => item.id === (topic?.section_id ?? sectionId)
	)

	const [deleteTarget, setDeleteTarget] = useState<TypeDeleteTarget | null>(
		null
	)
	const [isDeleting, setIsDeleting] = useState(false)
	const [unpinTarget, setUnpinTarget] = useState<TypeUnpinTarget | null>(null)
	const actions = useTreeActions()

	const tabsState = useLibraryTabs()
	const {
		tabs,
		split,
		loaded: tabsLoaded,
		open: openTab,
		remove: removeTabs,
		setSplit,
		setTitle: setTabTitle
	} = tabsState
	const canSplit = useCanSplit()
	const [focusedRight, setFocusedRight] = useState(false)
	// Несохранённые правки в панели: уйти можно только через вопрос (регистрирует сам лист)
	const leftGuard = useRef<(action: () => void) => void>()
	const rightGuard = useRef<(action: () => void) => void>()
	const { ref: panesRef, height: panesHeight } = useFillHeight()
	const showSplit = canSplit && Boolean(split) && Boolean(pageId && topic)
	const rightId = showSplit ? split : null

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

	const refreshTree = () =>
		queryClient.invalidateQueries({ queryKey: TREE_KEY })

	// Открыли лист — у него появляется вкладка
	useEffect(() => {
		if (tabsLoaded && pageId && topicId) openTab(pageId, topicId)
	}, [tabsLoaded, pageId, topicId, openTab])

	// Тему удалили (в том числе на другом устройстве) — её вкладки больше некуда вести
	useEffect(() => {
		if (!tree || !tabsLoaded) return
		const gone = tabs
			.filter(tab => !tree.topics.some(item => item.id === tab.topicId))
			.map(tab => tab.pageId)
		if (gone.length) removeTabs(gone)
	}, [tree, tabs, tabsLoaded, removeTabs])

	const rightTab = tabs.find(tab => tab.pageId === split)
	const rightTopic = topics.find(item => item.id === rightTab?.topicId)

	useEffect(() => {
		if (!showSplit) setFocusedRight(false)
	}, [showSplit])

	/** Лист — в правую панель. Он уже открыт слева — панели не дублируем */
	const openBeside = (id: string, topic: string) => {
		openTab(id, topic)
		if (id === pageId) return
		const apply = () => {
			setSplit(id)
			setFocusedRight(true)
		}
		if (rightId && rightId !== EMPTY_PANE && rightGuard.current)
			rightGuard.current(apply)
		else apply()
	}

	const selectTab = (tab: ILibraryTab) => {
		if (tab.pageId === pageId) {
			setFocusedRight(false)
			return
		}
		if (tab.pageId === rightId) {
			setFocusedRight(true)
			return
		}
		if (showSplit && focusedRight) {
			openBeside(tab.pageId, tab.topicId)
			return
		}
		const go = () => navigate({ topic: tab.topicId, page: tab.pageId })
		if (pageId && leftGuard.current) leftGuard.current(go)
		else go()
	}

	const closeTab = (tab: ILibraryTab) => {
		if (tab.pageId === rightId) {
			const close = () => {
				removeTabs([tab.pageId])
				setFocusedRight(false)
			}
			if (rightGuard.current) rightGuard.current(close)
			else close()
			return
		}
		if (tab.pageId !== pageId) {
			removeTabs([tab.pageId])
			return
		}
		// Закрываем открытый лист — переходим на соседнюю вкладку или к его теме
		const close = () => {
			const index = tabs.findIndex(item => item.pageId === tab.pageId)
			const rest = tabs.filter(
				item => item.pageId !== tab.pageId && item.pageId !== rightId
			)
			const next = rest[Math.min(index, rest.length - 1)]
			removeTabs([tab.pageId])
			navigate(
				next
					? { topic: next.topicId, page: next.pageId }
					: { topic: tab.topicId }
			)
		}
		if (leftGuard.current) leftGuard.current(close)
		else close()
	}

	const closeAllTabs = () => {
		const close = () => {
			const current = tabs.find(tab => tab.pageId === pageId)
			removeTabs(tabs.map(tab => tab.pageId))
			setSplit(null)
			if (current) navigate({ topic: current.topicId })
		}
		const askRight = () =>
			rightId && rightId !== EMPTY_PANE && rightGuard.current
				? rightGuard.current(close)
				: close()
		if (pageId && leftGuard.current) leftGuard.current(askRight)
		else askRight()
	}

	const toggleSplit = () => {
		if (rightId) {
			const close = () => {
				setSplit(null)
				setFocusedRight(false)
			}
			if (rightId !== EMPTY_PANE && rightGuard.current) rightGuard.current(close)
			else close()
			return
		}
		if (!pageId) return
		const other = [...tabs].reverse().find(tab => tab.pageId !== pageId)
		setSplit(other?.pageId ?? EMPTY_PANE)
		setFocusedRight(true)
	}

	const tabBar = tabs.length > 0 && (
		<LibraryTabBar
			tabs={tabs}
			activeId={pageId}
			rightId={rightId === EMPTY_PANE ? null : rightId}
			focusedRight={focusedRight}
			canSplit={canSplit && Boolean(pageId)}
			onSelect={selectTab}
			onClose={closeTab}
			onCloseAll={closeAllTabs}
			onOpenBeside={tab => openBeside(tab.pageId, tab.topicId)}
			onToggleSplit={toggleSplit}
		/>
	)

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
				removeTabs([deleteTarget.id])
				if (deleteTarget.id === pageId) navigate({ topic: topicId })
			} else {
				await refreshTree()
				if (
					(deleteTarget.table === 'library_topic' &&
						deleteTarget.id === topicId) ||
					(deleteTarget.table === 'library_section' &&
						deleteTarget.id === section?.id)
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

	const confirmUnpin = () => {
		if (!unpinTarget) return
		if (unpinTarget.table === 'library_page') {
			actions.setPagePinned(unpinTarget.topicId, unpinTarget.id, false)
		} else {
			actions.setPinned(unpinTarget.table, unpinTarget.id, false)
		}
		setUnpinTarget(null)
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

	const unpinDialog = unpinTarget && (
		<ConfirmDialog
			open
			title={
				unpinTarget.table === 'library_section'
					? 'Открепить раздел?'
					: unpinTarget.table === 'library_topic'
						? 'Открепить тему?'
						: 'Открепить лист?'
			}
			description={
				unpinTarget.table === 'library_section'
					? `Раздел «${unpinTarget.title}» больше не будет закреплён в начале списка.`
					: unpinTarget.table === 'library_topic'
						? `Тема «${unpinTarget.title}» больше не будет закреплена в начале списка.`
						: `Лист «${unpinTarget.title || 'Без названия'}» больше не будет закреплён в начале темы.`
			}
			confirmLabel='Открепить'
			onConfirm={confirmUnpin}
			onClose={() => setUnpinTarget(null)}
		/>
	)

	// Открытый лист — как отдельная страница, без дерева и рамок
	if (pageId && topic) {
		const leftPage = (
			<PageView
				key={pageId}
				pageId={pageId}
				topic={topic}
				section={section}
				compact={showSplit}
				withTabs={tabs.length > 0}
				guardRef={leftGuard}
				onTitle={setTabTitle}
				onBack={() => navigate({ topic: topic.id })}
				onOpenRoot={() => navigate({})}
				onOpenSection={id => navigate({ section: id })}
				onOpenPage={(topic, page) => navigate({ topic, page })}
				onDelete={setDeleteTarget}
			/>
		)
		return (
			<>
				{tabBar}
				{showSplit ? (
					<div
						ref={panesRef}
						style={{ height: panesHeight }}
						className='-mx-4 grid grid-cols-2 divide-x divide-border sm:-mx-6 lg:-mx-8 xl:-mx-10 print:block'
					>
						<div
							data-scroll-root
							onMouseDownCapture={() => setFocusedRight(false)}
							onFocusCapture={() => setFocusedRight(false)}
							className='min-h-0 min-w-0 overflow-y-auto overscroll-contain px-5'
						>
							{leftPage}
						</div>
						<div
							data-scroll-root
							onMouseDownCapture={() => setFocusedRight(true)}
							onFocusCapture={() => setFocusedRight(true)}
							className='min-h-0 min-w-0 overflow-y-auto overscroll-contain px-5 print:hidden'
						>
							{rightTab && rightTopic ? (
								<PageView
									key={rightTab.pageId}
									pageId={rightTab.pageId}
									topic={rightTopic}
									section={sections.find(
										item => item.id === rightTopic.section_id
									)}
									compact
									withTabs
									guardRef={rightGuard}
									onTitle={setTabTitle}
									onBack={() => {
										setSplit(null)
										setFocusedRight(false)
									}}
									onOpenRoot={() => navigate({})}
									onOpenSection={id => navigate({ section: id })}
									onOpenPage={(topic, page) => openBeside(page, topic)}
									onDelete={setDeleteTarget}
								/>
							) : (
								<SplitPicker
									tabs={tabs.filter(tab => tab.pageId !== pageId)}
									sections={sections}
									topics={topics}
									onPick={(topic, page) => openBeside(page, topic)}
									onClose={() => {
										setSplit(null)
										setFocusedRight(false)
									}}
								/>
							)}
						</div>
					</div>
				) : (
					leftPage
				)}
				{deleteDialog}
				{unpinDialog}
			</>
		)
	}

	return (
		<div>
			{tabBar}
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
					<aside
						className={cn(
							'min-w-0',
							topicId || sectionId ? 'hidden lg:block' : 'block'
						)}
					>
						<LibraryTree
							sections={sections}
							topics={topics}
							isLoading={isLoading}
							activeTopicId={topicId}
							onOpenTopic={id => navigate({ topic: id })}
							onOpenSection={id => navigate({ section: id })}
							activeSectionId={!topicId ? sectionId : null}
							onDelete={setDeleteTarget}
							onRequestUnpin={setUnpinTarget}
						/>
					</aside>

					<main
						className={cn(
							'min-w-0',
							!topicId && !sectionId && 'hidden lg:block'
						)}
					>
						{!topic && section ? (
							<SectionView
								section={section}
								topics={topics.filter(item => item.section_id === section.id)}
								onBack={() => navigate({})}
								onOpenTopic={id => navigate({ topic: id })}
								onDelete={setDeleteTarget}
								onRequestUnpin={setUnpinTarget}
							/>
						) : topic ? (
							<TopicView
								topic={topic}
								section={section}
								onBack={() => navigate({})}
								onOpenPage={id => navigate({ topic: topic.id, page: id })}
								onDelete={setDeleteTarget}
								onRequestUnpin={setUnpinTarget}
							/>
						) : (
							<EmptyState hasSections={sections.length > 0} />
						)}
					</main>
				</div>
			)}
			{deleteDialog}
			{unpinDialog}
		</div>
	)
}

/** Вторая панель, пока в ней нет листа: открытые вкладки и поиск по архиву */
function SplitPicker({
	tabs,
	sections,
	topics,
	onPick,
	onClose
}: {
	tabs: ILibraryTab[]
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	onPick: (topicId: string, pageId: string) => void
	onClose: () => void
}) {
	return (
		<div className='mx-auto max-w-md py-10'>
			<div className='flex items-center justify-between gap-3'>
				<h2 className='text-base font-semibold text-fg'>Что открыть рядом?</h2>
				<button
					type='button'
					onClick={onClose}
					className='text-sm text-subtle transition-colors hover:text-fg'
				>
					Закрыть панель
				</button>
			</div>
			<div className='mt-4'>
				<LibrarySearch
					sections={sections}
					topics={topics}
					onOpenPage={onPick}
					onOpenTopic={() => {}}
					onOpenSection={() => {}}
				/>
			</div>
			{tabs.length > 0 && (
				<>
					<p className='eyebrow mb-2 mt-6'>Открытые вкладки</p>
					<ul className='border border-border'>
						{tabs.map(tab => (
							<li
								key={tab.pageId}
								className='border-b border-border last:border-b-0'
							>
								<button
									type='button'
									onClick={() => onPick(tab.topicId, tab.pageId)}
									className='w-full truncate px-3 py-2.5 text-left text-sm text-muted transition-colors hover:bg-white/[0.04] hover:text-fg'
								>
									{tab.title || 'Без названия'}
								</button>
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	)
}

function ViewTab({
	active,
	onClick,
	children
}: {
	active: boolean
	onClick: () => void
	children: ReactNode
}) {
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
	onDelete,
	onRequestUnpin
}: {
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	isLoading: boolean
	activeTopicId: string | null
	activeSectionId?: string | null
	onOpenTopic: (id: string) => void
	onOpenSection: (id: string) => void
	onDelete: (target: TypeDeleteTarget) => void
	onRequestUnpin: (target: TypeUnpinTarget) => void
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
	const sensors = useLibraryDndSensors()
	const sortedSections = sortByPinAndOrder(sections)

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

	const rename = (
		table: 'library_section' | 'library_topic',
		id: string,
		title: string
	) => {
		setRenaming(null)
		if (title) actions.rename(table, id, title)
	}

	const togglePin = (
		table: 'library_section' | 'library_topic',
		item: { id: string; title: string; is_pinned?: boolean }
	) => {
		if (item.is_pinned) {
			onRequestUnpin({ table, id: item.id, title: item.title })
		} else {
			actions.setPinned(table, item.id, true)
		}
	}

	const handleDragEnd = (event: DragEndEvent) => {
		const activeId = String(event.active.id)
		const overId = event.over ? String(event.over.id) : null
		if (!overId || activeId === overId) return

		// 1. Перетаскивание разделов
		if (sortedSections.some(item => item.id === activeId)) {
			const overSectionId =
				sortedSections.find(item => item.id === overId)?.id ??
				topics.find(item => item.id === overId)?.section_id
			if (!overSectionId || overSectionId === activeId) return
			const reordered = reorderWithinGroup(
				sortedSections,
				activeId,
				overSectionId
			)
			if (reordered) actions.reorderSections(reordered)
			return
		}

		// 2. Перетаскивание тем (внутри раздела или между разделами)
		const activeTopic = topics.find(item => item.id === activeId)
		if (!activeTopic) return

		const overTopic = topics.find(item => item.id === overId)
		const overSection = sortedSections.find(item => item.id === overId)

		if (overTopic && overTopic.section_id === activeTopic.section_id) {
			const sectionTopics = sortByPinAndOrder(
				topics.filter(item => item.section_id === activeTopic.section_id)
			)
			const reordered = reorderWithinGroup(
				sectionTopics,
				activeId,
				overTopic.id
			)
			if (reordered) actions.reorderTopics(activeTopic.section_id, reordered)
			return
		}

		const targetSectionId =
			overTopic && overTopic.section_id !== activeTopic.section_id
				? overTopic.section_id
				: overSection && overSection.id !== activeTopic.section_id
					? overSection.id
					: null

		if (targetSectionId) {
			const targetTopics = topics.filter(
				item => item.section_id === targetSectionId
			)
			setCollapsed(state => ({ ...state, [targetSectionId]: false }))
			actions.moveTopic(activeTopic.id, targetSectionId, targetTopics.length)
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

				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={sortedSections.map(item => item.id)}
						strategy={verticalListSortingStrategy}
					>
						{sortedSections.map((section, sectionIndex) => {
							const sectionTopics = sortByPinAndOrder(
								topics.filter(item => item.section_id === section.id)
							)
							const isCollapsed = collapsed[section.id]
							const prevSection = sortedSections[sectionIndex - 1]
							const showPinDivider =
								Boolean(prevSection?.is_pinned) && !section.is_pinned

							return (
								<SortableItem
									key={section.id}
									id={section.id}
									className='mb-1'
								>
									{dragHandleProps => (
										<>
											{showPinDivider && (
												<div className='my-1.5 border-t border-border/60' />
											)}
											{renaming === section.id ? (
												<InlineInput
													initial={section.title}
													onSubmit={title =>
														rename('library_section', section.id, title)
													}
												/>
											) : (
												<Row
													onClick={() => onOpenSection(section.id)}
													active={section.id === activeSectionId}
													pinned={Boolean(section.is_pinned)}
													onUnpin={() =>
														togglePin('library_section', section)
													}
													dragHandleProps={dragHandleProps}
													leading={
														<span
															role='button'
															tabIndex={0}
															aria-label={
																isCollapsed
																	? 'Развернуть раздел'
																	: 'Свернуть раздел'
															}
															onClick={event => {
																event.stopPropagation()
																setCollapsed(state => ({
																	...state,
																	[section.id]: !isCollapsed
																}))
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
																	setCollapsed(state => ({
																		...state,
																		[section.id]: false
																	}))
																	setAddingTopicTo(section.id)
																}}
															>
																<Plus size={14} />
															</IconButton>
															<KebabMenu
																label='Действия с разделом'
																items={[
																	{
																		label: section.is_pinned
																			? 'Открепить'
																			: 'Закрепить',
																		icon: <Pin size={14} />,
																		onClick: () =>
																			togglePin('library_section', section)
																	},
																	{
																		label: 'Переименовать',
																		icon: <Pencil size={14} />,
																		onClick: () => setRenaming(section.id)
																	},
																	{
																		label: 'Удалить',
																		icon: <Trash2 size={14} />,
																		danger: true,
																		onClick: () =>
																			onDelete({
																				table: 'library_section',
																				id: section.id,
																				title: section.title
																			})
																	}
																]}
															/>
														</>
													}
												/>
											)}

											{!isCollapsed && (
												<div className='ml-[1.4rem] border-l border-border'>
													<SortableContext
														items={sectionTopics.map(item => item.id)}
														strategy={verticalListSortingStrategy}
													>
														{sectionTopics.map((topic, topicIndex) => {
															const prevTopic = sectionTopics[topicIndex - 1]
															const showTopicDivider =
																Boolean(prevTopic?.is_pinned) &&
																!topic.is_pinned

															return renaming === topic.id ? (
																<InlineInput
																	key={topic.id}
																	initial={topic.title}
																	onSubmit={title =>
																		rename('library_topic', topic.id, title)
																	}
																/>
															) : (
																<SortableItem
																	key={topic.id}
																	id={topic.id}
																>
																	{topicDragHandleProps => (
																		<>
																			{showTopicDivider && (
																				<div className='my-1 border-t border-border/50' />
																			)}
																			<Row
																				active={topic.id === activeTopicId}
																				onClick={() => onOpenTopic(topic.id)}
																				title={topic.title}
																				pinned={Boolean(topic.is_pinned)}
																				onUnpin={() =>
																					togglePin('library_topic', topic)
																				}
																				dragHandleProps={topicDragHandleProps}
																				actions={
																					<KebabMenu
																						label='Действия с темой'
																						items={[
																							{
																								label: topic.is_pinned
																									? 'Открепить'
																									: 'Закрепить',
																								icon: <Pin size={14} />,
																								onClick: () =>
																									togglePin('library_topic', topic)
																							},
																							{
																								label: 'Переименовать',
																								icon: <Pencil size={14} />,
																								onClick: () =>
																									setRenaming(topic.id)
																							},
																							{
																								label: 'Удалить',
																								icon: <Trash2 size={14} />,
																								danger: true,
																								onClick: () =>
																									onDelete({
																										table: 'library_topic',
																										id: topic.id,
																										title: topic.title
																									})
																							}
																						]}
																					/>
																				}
																			/>
																		</>
																	)}
																</SortableItem>
															)
														})}
													</SortableContext>
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
										</>
									)}
								</SortableItem>
							)
						})}
					</SortableContext>
				</DndContext>

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
	pinned,
	onUnpin,
	dragHandleProps,
	onClick
}: {
	title: string
	titleClassName?: string
	leading?: ReactNode
	actions?: ReactNode
	active?: boolean
	pinned?: boolean
	onUnpin?: () => void
	dragHandleProps?: TypeDragHandleProps
	onClick: () => void
}) {
	return (
		<div
			className={cn(
				'group relative flex min-h-9 items-center gap-1.5 py-1 pl-1.5 pr-1 transition-colors',
				active
					? 'bg-white/[0.06] before:absolute before:inset-y-0 before:-left-px before:w-0.5 before:bg-primary'
					: 'hover:bg-white/[0.03]'
			)}
		>
			{dragHandleProps && (
				<button
					type='button'
					aria-label='Перетащить'
					{...dragHandleProps.attributes}
					{...dragHandleProps.listeners}
					onClick={event => event.stopPropagation()}
					className='-ml-0.5 -mr-0.5 grid h-6 w-4 shrink-0 touch-none place-items-center text-subtle opacity-0 transition-opacity cursor-grab active:cursor-grabbing group-hover:opacity-60 hover:!opacity-100 hover:text-fg [@media(hover:none)]:opacity-35'
				>
					<GripVertical size={13} />
				</button>
			)}
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
			{pinned && (
				<button
					type='button'
					title='Открепить'
					aria-label='Открепить'
					onClick={event => {
						event.stopPropagation()
						onUnpin?.()
					}}
					className='grid h-6 w-6 shrink-0 place-items-center text-primary/75 transition-opacity hover:text-primary [@media(hover:hover)]:group-hover:opacity-0'
				>
					<Pin
						size={12}
						className='fill-current'
					/>
				</button>
			)}
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
	active,
	children
}: {
	label: string
	onClick: () => void
	danger?: boolean
	active?: boolean
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
				'grid h-7 w-7 place-items-center transition-colors hover:bg-white/[0.06]',
				danger
					? 'text-subtle hover:text-danger'
					: active
						? 'text-primary hover:text-primary-hover'
						: 'text-subtle hover:text-fg'
			)}
		>
			{children}
		</button>
	)
}

type TypeMenuItem = {
	label: string
	icon: ReactNode
	onClick: () => void
	danger?: boolean
}

/** Меню «⋯»: открывается поверх страницы и не выходит за края экрана */
function KebabMenu({ label, items }: { label: string; items: TypeMenuItem[] }) {
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)

	useEffect(() => {
		if (!pos) return
		const close = () => setPos(null)
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') close()
		}
		window.addEventListener('keydown', onKey)
		window.addEventListener('resize', close)
		window.addEventListener('scroll', close, true)
		return () => {
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('resize', close)
			window.removeEventListener('scroll', close, true)
		}
	}, [pos])

	const open = () => {
		const rect = buttonRef.current?.getBoundingClientRect()
		if (!rect) return
		const width = 192
		const height = items.length * 36 + 8
		const left = Math.min(
			Math.max(8, rect.right - width),
			window.innerWidth - width - 8
		)
		const below = rect.bottom + 4
		const top =
			below + height > window.innerHeight - 8
				? Math.max(8, rect.top - height - 4)
				: below
		setPos({ top, left })
	}

	return (
		<>
			<button
				ref={buttonRef}
				type='button'
				title={label}
				aria-label={label}
				aria-haspopup='menu'
				aria-expanded={Boolean(pos)}
				onClick={event => {
					event.stopPropagation()
					if (pos) setPos(null)
					else open()
				}}
				className={cn(
					'grid h-7 w-7 place-items-center transition-colors hover:bg-white/[0.06] hover:text-fg',
					pos ? 'bg-white/[0.06] text-fg' : 'text-subtle'
				)}
			>
				<MoreHorizontal size={15} />
			</button>
			{pos &&
				createPortal(
					<div
						className='fixed inset-0 z-[130]'
						onMouseDown={() => setPos(null)}
						onContextMenu={event => {
							event.preventDefault()
							setPos(null)
						}}
					>
						<div
							role='menu'
							onMouseDown={event => event.stopPropagation()}
							style={{ top: pos.top, left: pos.left, width: 192 }}
							className='fixed animate-pop-in border border-border bg-elevated p-1 shadow-pop'
						>
							{items.map(item => (
								<button
									key={item.label}
									type='button'
									role='menuitem'
									onClick={event => {
										event.stopPropagation()
										setPos(null)
										item.onClick()
									}}
									className={cn(
										'flex h-9 w-full items-center gap-2.5 px-2.5 text-left text-sm transition-colors hover:bg-white/[0.06]',
										item.danger ? 'text-danger' : 'text-muted hover:text-fg'
									)}
								>
									{item.icon}
									{item.label}
								</button>
							))}
						</div>
					</div>,
					document.body
				)}
		</>
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
	onDelete,
	onRequestUnpin
}: {
	topic: ILibraryTopic
	section?: ILibrarySection
	onBack: () => void
	onOpenPage: (id: string) => void
	onDelete: (target: TypeDeleteTarget) => void
	onRequestUnpin: (target: TypeUnpinTarget) => void
}) {
	const queryClient = useQueryClient()
	const { data: pages, isLoading } = useQuery({
		queryKey: pagesKey(topic.id),
		queryFn: () => libraryService.getPages(topic.id),
		staleTime: 60 * 1000
	})
	const [isRenaming, setIsRenaming] = useState(false)

	const actions = useTreeActions()
	const sensors = useLibraryDndSensors()
	const sortedPages = sortByPinAndOrder(pages || [])

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
			is_pinned: false,
			updated_at: new Date().toISOString(),
			excerpt: '',
			contents: ''
		}
		queryClient.setQueryData(pageKey(id), page)
		queryClient.setQueryData<ILibraryPageMeta[]>(pagesKey(topic.id), old =>
			sortByPinAndOrder([...(old || []), page])
		)
		onOpenPage(id)
		libraryService.createPage(id, topic.id, order).catch(() => {
			toast.error('Не удалось создать лист')
			queryClient.invalidateQueries({ queryKey: pagesKey(topic.id) })
		})
	}

	const toggleTopicPin = () => {
		if (topic.is_pinned) {
			onRequestUnpin({
				table: 'library_topic',
				id: topic.id,
				title: topic.title
			})
		} else {
			actions.setPinned('library_topic', topic.id, true)
		}
	}

	const togglePagePin = (page: ILibraryPageMeta) => {
		if (page.is_pinned) {
			onRequestUnpin({
				table: 'library_page',
				id: page.id,
				topicId: topic.id,
				title: page.title
			})
		} else {
			actions.setPagePinned(topic.id, page.id, true)
		}
	}

	const handleDragEnd = (event: DragEndEvent) => {
		const activeId = String(event.active.id)
		const overId = event.over ? String(event.over.id) : null
		if (!overId || activeId === overId) return
		const reordered = reorderWithinGroup(sortedPages, activeId, overId)
		if (reordered) actions.reorderPages(topic.id, reordered)
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
								if (title && title !== topic.title)
									actions.rename('library_topic', topic.id, title)
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
						{pages
							? `${pages.length} ${plural(pages.length, 'лист', 'листа', 'листов')}`
							: ' '}
					</p>
				</div>
				<div className='flex items-center gap-1.5'>
					<IconButton
						label='Переименовать тему'
						onClick={() => setIsRenaming(true)}
					>
						<Pencil size={15} />
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
						<Trash2 size={15} />
					</IconButton>
					<button
						type='button'
						onClick={createPage}
						className='ml-1 flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
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
			) : sortedPages.length ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={sortedPages.map(item => item.id)}
						strategy={verticalListSortingStrategy}
					>
						<div>
							{sortedPages.map((page, index) => (
								<SortableItem
									key={page.id}
									id={page.id}
								>
									{dragHandleProps => (
										<PageCard
											page={page}
											index={index}
											dragHandleProps={dragHandleProps}
											onOpen={() => onOpenPage(page.id)}
											onTogglePin={() => togglePagePin(page)}
											onDelete={() =>
												onDelete({
													table: 'library_page',
													id: page.id,
													title: page.title
												})
											}
										/>
									)}
								</SortableItem>
							))}
						</div>
					</SortableContext>
				</DndContext>
			) : (
				<div className='mt-16 text-center'>
					<p className='text-sm text-muted'>В теме пока нет листов</p>
					<p className='mx-auto mt-1 max-w-sm text-xs leading-5 text-subtle'>
						Лист — это конспект: текст, формулы LaTeX, таблицы, фото, файлы и
						голосовые. Можно вставить готовый ответ нейросети — разметка
						сохранится.
					</p>
				</div>
			)}
		</div>
	)
}

function PageCard({
	page,
	index,
	dragHandleProps,
	onOpen,
	onTogglePin,
	onDelete
}: {
	page: ILibraryPageMeta
	index: number
	dragHandleProps?: TypeDragHandleProps
	onOpen: () => void
	onTogglePin: () => void
	onDelete: () => void
}) {
	return (
		<div className='lazy-paint group relative flex w-full items-start gap-1 border-b border-border px-1.5 py-5 transition-colors hover:bg-white/[0.02] sm:gap-2 sm:px-3'>
			{dragHandleProps && (
				<button
					type='button'
					aria-label='Перетащить лист'
					{...dragHandleProps.attributes}
					{...dragHandleProps.listeners}
					onClick={event => event.stopPropagation()}
					className='mt-1 grid h-6 w-5 shrink-0 touch-none place-items-center text-subtle opacity-0 transition-opacity cursor-grab active:cursor-grabbing group-hover:opacity-60 hover:!opacity-100 hover:text-fg [@media(hover:none)]:opacity-35'
				>
					<GripVertical size={14} />
				</button>
			)}
			<button
				type='button'
				onClick={onOpen}
				className='grid min-w-0 flex-1 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2 text-left sm:grid-cols-[2.75rem_minmax(0,1fr)_auto]'
			>
				<span className='pt-1 font-mono text-xs text-subtle'>
					{String(index + 1).padStart(2, '0')}
				</span>
				<span className='min-w-0'>
					<span className='flex items-center gap-2'>
						<span className='truncate text-lg font-medium text-fg transition-colors group-hover:text-primary'>
							{page.title || 'Без названия'}
						</span>
						{page.is_pinned && (
							<Pin
								size={13}
								className='shrink-0 fill-current text-primary/80'
							/>
						)}
					</span>
					<span className='mt-1 line-clamp-2 text-sm leading-6 text-subtle sm:line-clamp-3'>
						{page.excerpt ? (
							<MathExcerpt text={page.excerpt} />
						) : (
							page.contents || 'Пустой лист'
						)}
					</span>
				</span>
				<span className='col-start-2 mt-2 font-mono text-2xs uppercase tracking-wider text-subtle sm:col-start-3 sm:mt-1.5'>
					{dayjs(page.updated_at).locale('ru').format('D MMM, HH:mm')}
				</span>
			</button>
			<div className='mt-0.5 flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'>
				<KebabMenu
					label='Действия с листом'
					items={[
						{
							label: page.is_pinned ? 'Открепить' : 'Закрепить',
							icon: <Pin size={14} />,
							onClick: onTogglePin
						},
						{
							label: 'Удалить',
							icon: <Trash2 size={14} />,
							danger: true,
							onClick: onDelete
						}
					]}
				/>
			</div>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Лист: чтение по умолчанию, правка по кнопке                          */
/* ------------------------------------------------------------------ */

/** Уходим с несохранёнными правками: сохранить, выбросить или остаться */
function UnsavedDialog({
	onSave,
	onDiscard,
	onCancel
}: {
	onSave: () => void
	onDiscard: () => void
	onCancel: () => void
}) {
	useBackClose(true, onCancel)
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onCancel()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [onCancel])

	return createPortal(
		<div
			className='fixed inset-0 z-[110] flex animate-fade-in items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
			onMouseDown={event => {
				if (event.target === event.currentTarget) onCancel()
			}}
		>
			<section
				role='alertdialog'
				aria-modal='true'
				aria-labelledby='unsaved-title'
				className='w-full max-w-sm animate-pop-in rounded-2xl border border-border bg-elevated p-5 shadow-pop'
			>
				<h2
					id='unsaved-title'
					className='text-base font-semibold text-fg'
				>
					Сохранить изменения?
				</h2>
				<p className='mt-1.5 text-sm text-muted'>
					В листе есть правки, которые ещё не сохранены.
				</p>
				<div className='mt-5 flex flex-wrap justify-end gap-2'>
					<button
						type='button'
						onClick={onCancel}
						className='h-9 px-3 text-sm text-subtle transition-colors hover:text-fg'
					>
						Остаться
					</button>
					<button
						type='button'
						onClick={onDiscard}
						className='h-9 border border-border px-3 text-sm text-danger transition-colors hover:bg-danger/10'
					>
						Не сохранять
					</button>
					<button
						type='button'
						autoFocus
						onClick={onSave}
						className='h-9 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
					>
						Сохранить
					</button>
				</div>
			</section>
		</div>,
		document.body
	)
}

function PageView({
	pageId,
	topic,
	section,
	onBack,
	onOpenRoot,
	onOpenSection,
	onOpenPage,
	onDelete,
	compact = false,
	withTabs = false,
	guardRef,
	onTitle
}: {
	pageId: string
	topic: ILibraryTopic
	section?: ILibrarySection
	/** В панели рядом с другим листом: узкая шапка, без оглавления сбоку */
	compact?: boolean
	/** Над листом закреплены вкладки — шапка прилипает под ними */
	withTabs?: boolean
	guardRef?: MutableRefObject<((action: () => void) => void) | undefined>
	onTitle?: (pageId: string, title: string) => void
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
	const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
		'idle'
	)
	const loaded = useRef(false)
	// Правки копятся здесь и уходят в базу только по «Сохранить» (или Ctrl+S)
	const dirty = useRef<{ title?: string; content?: string }>({})
	const [isDirty, setIsDirty] = useState(false)
	// Куда хотели уйти с несохранёнными правками — спрашиваем, что с ними делать
	const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null)
	const [draft, setDraft] = useState<{
		title?: string
		content?: string
		at: number
	} | null>(null)
	const router = useRouter()
	const draftKey = `planner:draft:${pageId}`

	useEffect(() => {
		if (!page || loaded.current) return
		loaded.current = true
		setTitle(page.title)
		setContent(page.content)
		// новый пустой лист сразу открываем на правку
		if (!page.title && !page.content) setIsEditing(true)
		// Черновик, который не сохранили в прошлый раз
		try {
			const saved = JSON.parse(localStorage.getItem(draftKey) || 'null')
			if (
				saved &&
				((saved.content !== undefined && saved.content !== page.content) ||
					(saved.title !== undefined && saved.title !== page.title))
			)
				setDraft(saved)
			else localStorage.removeItem(draftKey)
		} catch {}
	}, [page, draftKey])

	const flush = useCallback(async () => {
		const patch = dirty.current
		if (!Object.keys(patch).length) return
		dirty.current = {}
		setIsDirty(false)
		try {
			localStorage.removeItem(draftKey)
		} catch {}
		setStatus('saving')
		try {
			const saved = await libraryService.updatePage(pageId, patch)
			setStatus('saved')
			queryClient.setQueryData(pageKey(pageId), (old: any) =>
				old ? { ...old, ...patch, updated_at: saved.updated_at } : old
			)
			queryClient.setQueryData(
				pagesKey(topic.id),
				(old: ILibraryPageMeta[] | undefined) =>
					old?.map(item =>
						item.id === pageId
							? {
									...item,
									...(patch.title !== undefined && { title: patch.title }),
									...(patch.content !== undefined && {
										excerpt: toExcerpt(patch.content.slice(0, 1500)),
										contents: describeContents(patch.content)
									}),
									updated_at: saved.updated_at
								}
							: item
					)
			)
		} catch {
			dirty.current = { ...patch, ...dirty.current }
			setIsDirty(true)
			setStatus('error')
		}
	}, [pageId, queryClient, topic.id, draftKey])

	const schedule = (patch: { title?: string; content?: string }) => {
		const saved = queryClient.getQueryData<{ title: string; content: string }>(
			pageKey(pageId)
		)
		const next: typeof dirty.current = { ...dirty.current, ...patch }
		// Вернули как было — правок больше нет
		if (saved && next.title === saved.title) delete next.title
		if (saved && next.content === saved.content) delete next.content
		dirty.current = next
		setIsDirty(Object.keys(next).length > 0)
		setStatus('idle')
	}

	/** Отменить правки: вернуть текст из базы */
	const discard = () => {
		dirty.current = {}
		setIsDirty(false)
		try {
			localStorage.removeItem(draftKey)
		} catch {}
		const saved =
			queryClient.getQueryData<{ title: string; content: string }>(
				pageKey(pageId)
			) ?? page
		if (saved) {
			setTitle(saved.title)
			setContent(saved.content)
		}
	}

	/** Уйти со страницы: с несохранёнными правками — сначала спросить */
	const leave = (action: () => void) => {
		if (Object.keys(dirty.current).length) setPendingLeave(() => action)
		else action()
	}

	// Вкладки над листом уходят через тот же вопрос
	useEffect(() => {
		if (!guardRef) return
		guardRef.current = (action: () => void) => {
			if (Object.keys(dirty.current).length) setPendingLeave(() => action)
			else action()
		}
		return () => {
			guardRef.current = undefined
		}
	}, [guardRef])

	// Название — на вкладку
	useEffect(() => {
		if (loaded.current) onTitle?.(pageId, title)
	}, [pageId, title, onTitle])

	// Ушли без ответа (жест «назад», закрытие) — правки не теряем: черновик в браузере
	useEffect(
		() => () => {
			if (!Object.keys(dirty.current).length) return
			try {
				localStorage.setItem(
					draftKey,
					JSON.stringify({ ...dirty.current, at: Date.now() })
				)
			} catch {}
		},
		[draftKey]
	)

	// Закрытие вкладки — браузер переспросит; ссылки в меню — наш вопрос; Ctrl+S — сохранить
	useEffect(() => {
		if (!isDirty) return
		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		const onClick = (event: MouseEvent) => {
			const link = (event.target as HTMLElement).closest?.(
				'a[href]'
			) as HTMLAnchorElement | null
			if (!link || link.target === '_blank' || event.ctrlKey || event.metaKey)
				return
			if (link.closest('.rich-editor-content')) return
			const url = new URL(link.href, window.location.href)
			if (url.origin !== window.location.origin) return
			event.preventDefault()
			event.stopPropagation()
			setPendingLeave(() => () => router.push(url.pathname + url.search))
		}
		window.addEventListener('beforeunload', onBeforeUnload)
		document.addEventListener('click', onClick, true)
		return () => {
			window.removeEventListener('beforeunload', onBeforeUnload)
			document.removeEventListener('click', onClick, true)
		}
	}, [isDirty, router])

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.code === 'KeyS') {
				event.preventDefault()
				void flush()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [flush])

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

	// Вернулись на вкладку — на то же место листа
	const hasPage = Boolean(page)
	useEffect(() => {
		if (!hasPage) return
		const scroller = articleRef.current?.closest<HTMLElement>(
			'[data-scroll-root], main'
		)
		if (!scroller) return
		const saved = scrollPositions.get(pageId) ?? 0
		const restore = () => {
			scroller.scrollTop = saved
		}
		restore()
		// Текст дорисовывается не сразу — длинному листу нужна ещё попытка
		const timers = [120, 400].map(delay => setTimeout(restore, delay))
		// Человек сам начал листать — больше не возвращаем
		const stopRestoring = () => timers.forEach(clearTimeout)
		const remember = () => scrollPositions.set(pageId, scroller.scrollTop)
		scroller.addEventListener('wheel', stopRestoring, { passive: true })
		scroller.addEventListener('touchstart', stopRestoring, { passive: true })
		scroller.addEventListener('scroll', remember, { passive: true })
		return () => {
			stopRestoring()
			scroller.removeEventListener('wheel', stopRestoring)
			scroller.removeEventListener('touchstart', stopRestoring)
			scroller.removeEventListener('scroll', remember)
		}
	}, [hasPage, pageId])

	const headings = useHeadings(
		articleRef,
		`${isEditing}:${Boolean(page)}:${isFocus}`
	)

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
					'sticky z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-bg print:hidden',
					compact
						? '-mx-5 px-5'
						: '-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10',
					isFocus || compact
						? 'top-0'
						: withTabs
							? 'top-[calc(2.5rem-max(0.5rem,env(safe-area-inset-top)))] lg:top-7'
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
						leave(onBack)
					}}
					className='flex shrink-0 items-center gap-1.5 text-sm text-subtle transition-colors hover:text-fg sm:hidden'
				>
					<ArrowLeft
						size={15}
						className='shrink-0'
					/>
					<span className='max-w-[26vw] truncate'>{topic.title}</span>
				</button>
				<nav
					aria-label='Путь'
					className='hidden min-w-0 items-center gap-2 text-sm text-subtle sm:flex'
				>
					{!compact && (
						<button
							type='button'
							onClick={async () => {
								if (isFocus) exitFocus()
								leave(onOpenRoot)
							}}
							className='shrink-0 transition-colors hover:text-fg'
						>
							Архив
						</button>
					)}
					{section && !compact && (
						<>
							<span className='text-white/15'>/</span>
							<button
								type='button'
								onClick={async () => {
									if (isFocus) exitFocus()
									leave(() => onOpenSection(section.id))
								}}
								className='truncate transition-colors hover:text-fg'
							>
								{section.title}
							</button>
						</>
					)}
					{!compact && <span className='text-white/15'>/</span>}
					<button
						type='button'
						onClick={async () => {
							if (isFocus) exitFocus()
							leave(onBack)
						}}
						className='truncate transition-colors hover:text-fg'
					>
						{topic.title}
					</button>
				</nav>
				<div className='flex shrink-0 items-center gap-2'>
					<span
						className={cn(
							'font-mono text-2xs uppercase tracking-wider text-subtle',
							compact ? 'hidden 2xl:inline' : 'hidden sm:inline'
						)}
					>
						{status === 'saving'
							? 'Сохранение…'
							: status === 'error'
								? 'Ошибка сохранения'
								: isDirty
									? 'Не сохранено'
									: status === 'saved'
										? 'Сохранено'
										: ''}
					</span>
					{isDirty && (
						<button
							type='button'
							onClick={() => {
								discard()
								setIsEditing(false)
							}}
							title='Отменить все несохранённые правки'
							className='h-9 border border-border px-3 text-sm text-muted transition-colors hover:text-fg'
						>
							Отменить
						</button>
					)}
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
					{headings.length > 1 && !compact && (
						<button
							type='button'
							onClick={() => setShowOutline(value => !value)}
							title={showOutline ? 'Скрыть содержание' : 'Показать содержание'}
							aria-label={
								showOutline ? 'Скрыть содержание' : 'Показать содержание'
							}
							className={cn(
								'hidden h-9 w-9 place-items-center border border-border transition-colors xl:grid',
								showOutline
									? 'bg-white/[0.06] text-fg'
									: 'text-subtle hover:text-fg'
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
						showOutline={
								headings.length > 1 && !compact ? showOutline : undefined
							}
							onToggleOutline={
								headings.length > 1 && !compact
									? () => setShowOutline(value => !value)
								: undefined
						}
						onShare={() => setShareOpen(true)}
						onSpeak={
							isSpeechSupported()
								? () => {
										const content = articleRef.current?.querySelector(
											'.library-page .rich-editor-content'
										)
										const text = content ? speechFromNode(content) : ''
										if (
											!speak(
												`${title}.
${text}`,
												title || 'Лист'
											)
										)
											toast.error('На листе нечего читать')
									}
								: undefined
						}
						onDelete={() =>
							onDelete({ table: 'library_page', id: page.id, title })
						}
					/>
					<button
						type='button'
						onClick={async () => {
							if (isDirty) {
								await flush()
								// Не сохранилось — остаёмся в правке, текст не теряем
								if (Object.keys(dirty.current).length) return
								setIsEditing(false)
							} else setIsEditing(!isEditing)
							setSelfCheck(false)
						}}
						title={isDirty ? 'Сохранить (Ctrl+S)' : undefined}
						className={cn(
							'flex h-9 items-center gap-2 px-3.5 text-sm font-medium transition-colors',
							isEditing || isDirty
								? 'bg-primary text-white hover:bg-primary-hover'
								: 'border border-border text-fg hover:bg-white/[0.05]'
						)}
					>
						{isEditing || isDirty ? <Check size={15} /> : <Pencil size={14} />}
						{isDirty ? 'Сохранить' : isEditing ? 'Готово' : 'Править'}
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
					headings.length > 1 &&
						showOutline &&
						!compact &&
						'xl:grid-cols-[minmax(0,1fr)_13rem]'
				)}
			>
				<div className='min-w-0'>
					{draft && (
						<div className='mb-6 mt-4 flex flex-wrap items-center gap-3 border border-warning/40 bg-warning/[0.06] px-4 py-3 text-sm'>
							<span className='min-w-0 flex-1 text-fg'>
								Есть несохранённые правки от{' '}
								{dayjs(draft.at).locale('ru').format('D MMMM, HH:mm')}
							</span>
							<button
								type='button'
								onClick={() => {
									try {
										localStorage.removeItem(draftKey)
									} catch {}
									setDraft(null)
								}}
								className='h-8 px-3 text-muted transition-colors hover:text-fg'
							>
								Удалить
							</button>
							<button
								type='button'
								onClick={() => {
									const { at: _at, ...patch } = draft
									if (patch.title !== undefined) setTitle(patch.title)
									if (patch.content !== undefined) setContent(patch.content)
									schedule(patch)
									setIsEditing(true)
									setDraft(null)
								}}
								className='h-8 bg-primary px-3 font-medium text-white transition-colors hover:bg-primary-hover'
							>
								Вернуть правки
							</button>
						</div>
					)}
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
						contentClassName={cn(
							isEditing && 'min-h-[50vh]',
							!isEditing && 'library-reading'
						)}
						selfCheck={selfCheck && !isEditing}
					/>

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
				{headings.length > 1 && showOutline && !compact && (
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
					title={title}
					onClose={() => setShareOpen(false)}
				/>
			)}
			{pendingLeave && (
				<UnsavedDialog
					onSave={async () => {
						const action = pendingLeave
						setPendingLeave(null)
						await flush()
						if (!Object.keys(dirty.current).length) action()
					}}
					onDiscard={() => {
						const action = pendingLeave
						setPendingLeave(null)
						discard()
						action()
					}}
					onCancel={() => setPendingLeave(null)}
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
	onDelete,
	onRequestUnpin
}: {
	section: ILibrarySection
	topics: ILibraryTopic[]
	onBack: () => void
	onOpenTopic: (id: string) => void
	onDelete: (target: TypeDeleteTarget) => void
	onRequestUnpin: (target: TypeUnpinTarget) => void
}) {
	const [isAdding, setIsAdding] = useState(false)
	const [isRenamingSection, setIsRenamingSection] = useState(false)
	const [renamingTopicId, setRenamingTopicId] = useState<string | null>(null)

	const actions = useTreeActions()
	const sensors = useLibraryDndSensors()
	const sortedTopics = sortByPinAndOrder(topics)

	const createTopic = (title: string) => {
		setIsAdding(false)
		if (title) onOpenTopic(actions.addTopic(section.id, title, topics.length))
	}

	const toggleTopicPin = (topic: ILibraryTopic) => {
		if (topic.is_pinned) {
			onRequestUnpin({
				table: 'library_topic',
				id: topic.id,
				title: topic.title
			})
		} else {
			actions.setPinned('library_topic', topic.id, true)
		}
	}

	const handleDragEnd = (event: DragEndEvent) => {
		const activeId = String(event.active.id)
		const overId = event.over ? String(event.over.id) : null
		if (!overId || activeId === overId) return
		const reordered = reorderWithinGroup(sortedTopics, activeId, overId)
		if (reordered) actions.reorderTopics(section.id, reordered)
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
					{isRenamingSection ? (
						<input
							autoFocus
							defaultValue={section.title}
							maxLength={200}
							onBlur={event => {
								setIsRenamingSection(false)
								const title = event.target.value.trim()
								if (title && title !== section.title)
									actions.rename('library_section', section.id, title)
							}}
							onKeyDown={event => {
								if (event.key === 'Enter') event.currentTarget.blur()
							}}
							className='mt-2 w-full bg-transparent text-3xl font-semibold tracking-[-0.02em] text-fg outline-none'
						/>
					) : (
						<h1
							onDoubleClick={() => setIsRenamingSection(true)}
							className='mt-2 break-words text-3xl font-semibold tracking-[-0.02em] text-fg'
						>
							{section.title}
						</h1>
					)}
					<p className='mt-2 font-mono text-xs text-subtle'>
						{topics.length} {plural(topics.length, 'тема', 'темы', 'тем')}
					</p>
				</div>
				<div className='flex items-center gap-1.5'>
					<IconButton
						label='Переименовать раздел'
						onClick={() => setIsRenamingSection(true)}
					>
						<Pencil size={15} />
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
						<Trash2 size={15} />
					</IconButton>
					<button
						type='button'
						onClick={() => setIsAdding(true)}
						className='ml-1 flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
					>
						<Plus size={15} />
						Новая тема
					</button>
				</div>
			</div>

			{isAdding && (
				<div className='border-b border-border py-3'>
					<InlineInput
						placeholder='Название темы'
						onSubmit={createTopic}
					/>
				</div>
			)}

			{sortedTopics.length ? (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<SortableContext
						items={sortedTopics.map(item => item.id)}
						strategy={verticalListSortingStrategy}
					>
						<div>
							{sortedTopics.map((topic, index) =>
								renamingTopicId === topic.id ? (
									<div
										key={topic.id}
										className='border-b border-border py-3'
									>
										<InlineInput
											initial={topic.title}
											onSubmit={title => {
												setRenamingTopicId(null)
												if (title && title !== topic.title)
													actions.rename('library_topic', topic.id, title)
											}}
										/>
									</div>
								) : (
									<SortableItem
										key={topic.id}
										id={topic.id}
									>
										{dragHandleProps => (
											<div className='group flex w-full items-center gap-1 border-b border-border px-1.5 py-4 transition-colors hover:bg-white/[0.02] sm:gap-2 sm:px-3'>
												<button
													type='button'
													aria-label='Перетащить тему'
													{...dragHandleProps.attributes}
													{...dragHandleProps.listeners}
													onClick={event => event.stopPropagation()}
													className='grid h-6 w-5 shrink-0 touch-none place-items-center text-subtle opacity-0 transition-opacity cursor-grab active:cursor-grabbing group-hover:opacity-60 hover:!opacity-100 hover:text-fg [@media(hover:none)]:opacity-35'
												>
													<GripVertical size={14} />
												</button>
												<button
													type='button'
													onClick={() => onOpenTopic(topic.id)}
													className='grid min-w-0 flex-1 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-2 text-left sm:grid-cols-[2.75rem_minmax(0,1fr)]'
												>
													<span className='font-mono text-xs text-subtle'>
														{String(index + 1).padStart(2, '0')}
													</span>
													<span className='flex min-w-0 items-center gap-2'>
														<span className='truncate text-lg font-medium text-fg transition-colors group-hover:text-primary'>
															{topic.title}
														</span>
														{topic.is_pinned && (
															<Pin
																size={13}
																className='shrink-0 fill-current text-primary/80'
															/>
														)}
													</span>
												</button>
												<div className='flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100'>
													<KebabMenu
														label='Действия с темой'
														items={[
															{
																label: topic.is_pinned ? 'Открепить' : 'Закрепить',
																icon: <Pin size={14} />,
																onClick: () => toggleTopicPin(topic)
															},
															{
																label: 'Переименовать',
																icon: <Pencil size={14} />,
																onClick: () => setRenamingTopicId(topic.id)
															},
															{
																label: 'Удалить',
																icon: <Trash2 size={14} />,
																danger: true,
																onClick: () =>
																	onDelete({
																		table: 'library_topic',
																		id: topic.id,
																		title: topic.title
																	})
															}
														]}
													/>
												</div>
												<ChevronRight
													size={16}
													className='mr-1 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 sm:mr-0'
												/>
											</div>
										)}
									</SortableItem>
								)
							)}
						</div>
					</SortableContext>
				</DndContext>
			) : (
				<p className='py-16 text-center text-sm text-subtle'>
					В разделе пока нет тем
				</p>
			)}
		</div>
	)
}

function EmptyState({ hasSections }: { hasSections: boolean }) {
	return (
		<div className='flex min-h-[22rem] flex-col items-center justify-center px-6 text-center lg:items-start lg:pt-10 lg:text-left'>
			<p className='eyebrow'>Архив</p>
			<h2 className='mt-3 text-2xl font-semibold tracking-[-0.02em] text-fg'>
				{hasSections
					? 'Выберите тему слева'
					: 'Соберите свою библиотеку знаний'}
			</h2>
			<p className='mt-3 max-w-md text-sm leading-6 text-subtle'>
				Разделы — для больших направлений («Подготовка к экзамену»,
				«Английский», «Личный проект»), внутри — темы, в темах — конспекты с
				формулами, таблицами, фото и файлами.
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
