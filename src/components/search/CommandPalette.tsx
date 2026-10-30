'use client'

import { useQuery } from '@tanstack/react-query'
import cn from 'clsx'
import {
	CheckSquare2,
	CornerDownLeft,
	FileText,
	Folder,
	Hash,
	type LucideIcon,
	Search
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { MENU } from '@/components/dashboard-layout/sidebar/menu.data'

import { DASHBOARD_PAGES } from '@/config/pages-url.config'

import { useBackClose } from '@/hooks/useBackClose'

import { PROTOCOLS } from '@/app/i/breathing/breathing-protocols'
import {
	highlight,
	matchToken,
	normalize,
	toPlainText,
	tokenize
} from '@/app/i/library/LibrarySearch'
import { libraryService } from '@/services/library.service'
import { taskService } from '@/services/task.service'

interface IResult {
	key: string
	group: string
	icon: LucideIcon
	title: string
	path?: string
	snippet?: ReactNode
	done?: boolean
	href: string
	score: number
}

/** Открыть общий поиск из любого места: кнопка в шапке, Ctrl+K */
export const openSearch = () =>
	window.dispatchEvent(new Event('planner:search'))

// Насколько строка подходит под все слова запроса; 0 — не подходит
function scoreText(tokens: string[], text: string) {
	const normalized = normalize(text)
	const words = normalized.split(/\s+/)
	let score = 0
	for (const token of tokens) {
		const value = matchToken(token, normalized, words)
		if (!value) return 0
		score += value
	}
	return score
}

const GROUP_ORDER = [
	'Разделы приложения',
	'Дыхание',
	'Задачи',
	'Листы архива',
	'Темы и разделы архива'
]

export function CommandPalette() {
	const router = useRouter()
	const [open, setOpen] = useState(false)
	const [query, setQuery] = useState('')
	const [active, setActive] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			// По физической клавише, а не по букве: на русской раскладке key — «л»
			if (event.code === 'KeyK' && (event.ctrlKey || event.metaKey) && !event.altKey) {
				event.preventDefault()
				setOpen(value => !value)
			}
		}
		const onOpen = () => setOpen(true)
		window.addEventListener('keydown', onKey)
		window.addEventListener('planner:search', onOpen)
		return () => {
			window.removeEventListener('keydown', onKey)
			window.removeEventListener('planner:search', onOpen)
		}
	}, [])

	useEffect(() => {
		if (!open) return
		setQuery('')
		setActive(0)
		requestAnimationFrame(() => inputRef.current?.focus())
	}, [open])

	useBackClose(open, () => setOpen(false))

	// Данные грузим только когда поиск открыт; повторно — из кэша
	const { data: tree } = useQuery({
		queryKey: ['library', 'tree'],
		queryFn: libraryService.getTree,
		staleTime: 5 * 60 * 1000,
		enabled: open
	})
	const { data: pages } = useQuery({
		queryKey: ['library', 'search-index'],
		queryFn: async () =>
			(await libraryService.getSearchIndex()).map(row => ({
				...row,
				text: toPlainText(row.content)
			})),
		staleTime: 60 * 1000,
		enabled: open
	})
	const { data: tasks } = useQuery({
		queryKey: ['tasks'],
		queryFn: () => taskService.getTasks(),
		enabled: open,
		select: response => response.data
	})

	const results = useMemo<IResult[]>(() => {
		const tokens = tokenize(query)
		const menu = MENU.map(item => ({
			key: `menu:${item.link}`,
			group: 'Разделы приложения',
			icon: item.icon,
			title: item.name,
			href: item.link,
			score: tokens.length ? scoreText(tokens, item.name) * 3 : 1
		}))
		if (!tokens.length) return menu

		const out: IResult[] = menu.filter(item => item.score)

		for (const protocol of PROTOCOLS) {
			const score = scoreText(
				tokens,
				`${protocol.name} ${protocol.shortName} дыхание`
			)
			if (score)
				out.push({
					key: `breath:${protocol.id}`,
					group: 'Дыхание',
					icon: protocol.icon,
					title: protocol.name,
					path: protocol.tagline,
					href: `${DASHBOARD_PAGES.BREATHING}?program=${protocol.id}`,
					score
				})
		}

		for (const task of tasks || []) {
			const score = scoreText(
				tokens,
				`${task.name} ${task.note ? toPlainText(task.note) : ''}`
			)
			if (!score) continue
			out.push({
				key: `task:${task.id}`,
				group: 'Задачи',
				icon: CheckSquare2,
				title: task.name || 'Без названия',
				path: task.dueAt
					? new Date(task.dueAt).toLocaleDateString('ru-RU', {
							day: 'numeric',
							month: 'long'
						})
					: undefined,
				done: task.isCompleted,
				href: `${DASHBOARD_PAGES.TASKS}#task-${task.id}`,
				// невыполненные — выше
				score: score + (task.isCompleted ? 0 : 2)
			})
		}

		const topics = tree?.topics || []
		const sections = tree?.sections || []
		const topicById = new Map(topics.map(topic => [topic.id, topic]))
		const sectionById = new Map(sections.map(section => [section.id, section]))
		const pathOf = (topicId: string) => {
			const topic = topicById.get(topicId)
			const section = topic && sectionById.get(topic.section_id)
			return [section?.title, topic?.title].filter(Boolean).join(' / ')
		}

		for (const page of pages || []) {
			const inTitle = scoreText(tokens, page.title)
			const score =
				inTitle * 4 +
				scoreText(tokens, `${page.title} ${pathOf(page.topic_id)} ${page.text}`)
			if (!score) continue
			out.push({
				key: `page:${page.id}`,
				group: 'Листы архива',
				icon: FileText,
				title: page.title || 'Без названия',
				path: pathOf(page.topic_id),
				snippet: inTitle ? undefined : highlight(page.text, tokens),
				href: `${DASHBOARD_PAGES.LIBRARY}?topic=${page.topic_id}&page=${page.id}`,
				score
			})
		}
		for (const topic of topics) {
			const score = scoreText(tokens, topic.title)
			if (score)
				out.push({
					key: `topic:${topic.id}`,
					group: 'Темы и разделы архива',
					icon: Hash,
					title: topic.title,
					path: sectionById.get(topic.section_id)?.title,
					href: `${DASHBOARD_PAGES.LIBRARY}?topic=${topic.id}`,
					score
				})
		}
		for (const section of sections) {
			const score = scoreText(tokens, section.title)
			if (score)
				out.push({
					key: `section:${section.id}`,
					group: 'Темы и разделы архива',
					icon: Folder,
					title: section.title,
					href: `${DASHBOARD_PAGES.LIBRARY}?section=${section.id}`,
					score
				})
		}

		// Внутри группы — по релевантности, не больше 6 на группу
		return GROUP_ORDER.flatMap(group =>
			out
				.filter(item => item.group === group)
				.sort((a, b) => b.score - a.score)
				.slice(0, 6)
		)
	}, [query, tasks, pages, tree])

	useEffect(() => setActive(0), [query])
	useEffect(() => {
		listRef.current
			?.querySelector(`[data-index="${active}"]`)
			?.scrollIntoView({ block: 'nearest' })
	}, [active])

	const go = (result?: IResult) => {
		if (!result) return
		setOpen(false)
		router.push(result.href)
		// Уже на странице задач — переход по #якорю не перерисует её, подсветим сами
		if (result.href.includes('#task-'))
			setTimeout(
				() => window.dispatchEvent(new Event('planner:flash-task')),
				120
			)
	}

	if (!open) return null

	const loading = query.trim() && (!pages || !tasks)
	let lastGroup = ''

	return createPortal(
		<div
			className='fixed inset-0 z-[140] flex animate-fade-in items-start justify-center bg-black/55 px-3 pt-[max(1rem,10vh)] backdrop-blur-[2px]'
			onMouseDown={event =>
				event.target === event.currentTarget && setOpen(false)
			}
		>
			<div
				role='dialog'
				aria-modal='true'
				aria-label='Поиск'
				className='flex max-h-[min(36rem,80dvh)] w-full max-w-xl animate-pop-in flex-col border border-border bg-elevated shadow-pop'
			>
				<div className='flex items-center gap-3 border-b border-border px-4'>
					<Search
						size={17}
						className='shrink-0 text-subtle'
					/>
					<input
						ref={inputRef}
						value={query}
						onChange={event => setQuery(event.target.value)}
						onKeyDown={event => {
							if (event.key === 'ArrowDown') {
								event.preventDefault()
								setActive(value => Math.min(results.length - 1, value + 1))
							} else if (event.key === 'ArrowUp') {
								event.preventDefault()
								setActive(value => Math.max(0, value - 1))
							} else if (event.key === 'Enter') {
								event.preventDefault()
								go(results[active])
							} else if (event.key === 'Escape') {
								event.preventDefault()
								setOpen(false)
							}
						}}
						placeholder='Листы, задачи, разделы…'
						className='h-14 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-subtle'
					/>
					<kbd className='key-hint hidden border border-border px-1.5 py-0.5 font-mono text-2xs text-subtle sm:block'>
						Esc
					</kbd>
				</div>

				<div
					ref={listRef}
					className='min-h-0 flex-1 overflow-y-auto p-1.5'
				>
					{results.length === 0 ? (
						<p className='px-4 py-10 text-center text-sm text-subtle'>
							{loading ? 'Ищу…' : 'Ничего не нашлось'}
						</p>
					) : (
						results.map((result, index) => {
							const header = result.group !== lastGroup
							lastGroup = result.group
							const Icon = result.icon
							return (
								<div key={result.key}>
									{header && (
										<p className='px-3 pb-1 pt-3 text-2xs font-medium uppercase tracking-wider text-subtle first:pt-1.5'>
											{result.group}
										</p>
									)}
									<button
										type='button'
										data-index={index}
										onMouseMove={() => setActive(index)}
										onClick={() => go(result)}
										className={cn(
											'flex w-full items-start gap-3 px-3 py-2 text-left transition-colors',
											index === active ? 'bg-white/[0.07]' : ''
										)}
									>
										<Icon
											size={15}
											className={cn(
												'mt-0.5 shrink-0',
												index === active ? 'text-primary' : 'text-subtle'
											)}
										/>
										<span className='min-w-0 flex-1'>
											<span
												className={cn(
													'block truncate text-sm',
													result.done ? 'text-subtle line-through' : 'text-fg'
												)}
											>
												{result.title}
											</span>
											{result.path && (
												<span className='block truncate text-xs text-subtle'>
													{result.path}
												</span>
											)}
											{result.snippet && (
												<span className='mt-0.5 line-clamp-2 block text-xs leading-5 text-muted'>
													{result.snippet}
												</span>
											)}
										</span>
										{index === active && (
											<CornerDownLeft
												size={13}
												className='mt-1 shrink-0 text-subtle'
											/>
										)}
									</button>
								</div>
							)
						})
					)}
				</div>
				<footer className='key-hint hidden items-center gap-4 border-t border-border px-4 py-2 text-2xs text-subtle sm:flex'>
					<span>↑ ↓ — выбрать</span>
					<span>Enter — открыть</span>
					<span className='ml-auto'>Ctrl + K — открыть из любого места</span>
				</footer>
			</div>
		</div>,
		document.body
	)
}
