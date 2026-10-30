'use client'

import cn from 'clsx'
import { FileText, Folder, Hash, Search } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'

import {
	type ILibrarySection,
	type ILibraryTopic,
	libraryService
} from '@/services/library.service'

interface ISearchPage {
	id: string
	topic_id: string
	title: string
	text: string
}

type TypeResult =
	| {
			kind: 'page'
			id: string
			topicId: string
			title: string
			path: string
			snippet: ReactNode
			score: number
	  }
	| { kind: 'topic'; id: string; title: string; path: string; score: number }
	| { kind: 'section'; id: string; title: string; score: number }

// Нормализация: регистр, ё → е, лишние знаки
export const normalize = (value: string) =>
	value
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[^0-9a-zа-я\s]/g, ' ')

export const tokenize = (value: string) =>
	normalize(value).split(/\s+/).filter(Boolean)

// Расстояние Левенштейна с ранним выходом — для опечаток в словах от 5 букв
function withinOneEdit(a: string, b: string) {
	if (Math.abs(a.length - b.length) > 1) return false
	let i = 0
	let j = 0
	let edits = 0
	while (i < a.length && j < b.length) {
		if (a[i] === b[j]) {
			i++
			j++
			continue
		}
		if (++edits > 1) return false
		if (a.length > b.length) i++
		else if (b.length > a.length) j++
		else {
			i++
			j++
		}
	}
	return edits + (a.length - i) + (b.length - j) <= 1
}

// Насколько текст подходит под слово запроса: точное вхождение, начало слова или опечатка
export function matchToken(token: string, text: string, words: string[]) {
	if (text.includes(token))
		return words.some(word => word.startsWith(token)) ? 2 : 1
	if (
		token.length >= 5 &&
		words.some(word => withinOneEdit(token, word.slice(0, token.length + 1)))
	)
		return 0.6
	return 0
}

export function highlight(text: string, tokens: string[]) {
	const normalized = normalize(text)
	const first = tokens
		.map(token => normalized.indexOf(token))
		.filter(index => index >= 0)
		.sort((a, b) => a - b)[0]
	const from = Math.max(0, (first ?? 0) - 50)
	const slice = text.slice(from, from + 170)
	const normalizedSlice = normalize(slice)

	const marks: [number, number][] = []
	for (const token of tokens) {
		let index = normalizedSlice.indexOf(token)
		while (index >= 0) {
			marks.push([index, index + token.length])
			index = normalizedSlice.indexOf(token, index + token.length)
		}
	}
	marks.sort((a, b) => a[0] - b[0])

	const parts: ReactNode[] = []
	let cursor = 0
	marks.forEach(([start, end], key) => {
		if (start < cursor) return
		parts.push(slice.slice(cursor, start))
		parts.push(
			<mark
				key={key}
				className='bg-primary/25 text-fg'
			>
				{slice.slice(start, end)}
			</mark>
		)
		cursor = end
	})
	parts.push(slice.slice(cursor))
	return (
		<>
			{from > 0 && '…'}
			{parts}
			{from + 170 < text.length && '…'}
		</>
	)
}

export function LibrarySearch({
	sections,
	topics,
	onOpenPage,
	onOpenTopic,
	onOpenSection
}: {
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	onOpenPage: (topicId: string, pageId: string) => void
	onOpenTopic: (topicId: string) => void
	onOpenSection: (sectionId: string) => void
}) {
	const inputRef = useRef<HTMLInputElement>(null)
	const [query, setQuery] = useState('')
	const [isOpen, setIsOpen] = useState(false)
	const [pages, setPages] = useState<ISearchPage[] | null>(null)
	const [active, setActive] = useState(0)

	// «/» — к поиску по архиву
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement
			const typing =
				target.isContentEditable ||
				['INPUT', 'TEXTAREA'].includes(target.tagName)
			// Ctrl+K — общий поиск приложения, здесь только «/»
			if (event.key === '/' && !typing) {
				event.preventDefault()
				inputRef.current?.focus()
			}
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [])

	// Индекс подгружаем при первом обращении к поиску
	const loadIndex = () => {
		if (pages) return
		libraryService
			.getSearchIndex()
			.then(rows =>
				setPages(rows.map(row => ({ ...row, text: toPlainText(row.content) })))
			)
			.catch(() => setPages([]))
	}

	const results = useMemo<TypeResult[]>(() => {
		const tokens = tokenize(query)
		if (!tokens.length) return []
		const topicById = new Map(topics.map(topic => [topic.id, topic]))
		const sectionById = new Map(sections.map(section => [section.id, section]))
		const pathOf = (topicId: string) => {
			const topic = topicById.get(topicId)
			const section = topic && sectionById.get(topic.section_id)
			return [section?.title, topic?.title].filter(Boolean).join(' / ')
		}

		const scored: TypeResult[] = []

		for (const page of pages || []) {
			const title = normalize(page.title)
			const path = normalize(pathOf(page.topic_id))
			const body = normalize(page.text)
			const titleWords = title.split(/\s+/)
			const pathWords = path.split(/\s+/)
			const bodyWords = body.split(/\s+/)
			let score = 0
			let matchedAll = true
			for (const token of tokens) {
				const inTitle = matchToken(token, title, titleWords)
				const inPath = matchToken(token, path, pathWords)
				const inBody = matchToken(token, body, bodyWords)
				if (!inTitle && !inPath && !inBody) {
					matchedAll = false
					break
				}
				score += inTitle * 6 + inPath * 2 + inBody
			}
			if (!matchedAll) continue
			if (title.includes(normalize(query).trim())) score += 8
			scored.push({
				kind: 'page',
				id: page.id,
				topicId: page.topic_id,
				title: page.title || 'Без названия',
				path: pathOf(page.topic_id),
				snippet: highlight(page.text || page.title, tokens),
				score
			})
		}

		for (const topic of topics) {
			const title = normalize(topic.title)
			const words = title.split(/\s+/)
			const score = tokens.reduce(
				(sum, token) => sum + matchToken(token, title, words),
				0
			)
			if (tokens.every(token => matchToken(token, title, words)))
				scored.push({
					kind: 'topic',
					id: topic.id,
					title: topic.title,
					path: sectionById.get(topic.section_id)?.title || '',
					score: score * 5
				})
		}

		for (const section of sections) {
			const title = normalize(section.title)
			const words = title.split(/\s+/)
			if (tokens.every(token => matchToken(token, title, words)))
				scored.push({
					kind: 'section',
					id: section.id,
					title: section.title,
					score: 4
				})
		}

		return scored.sort((a, b) => b.score - a.score).slice(0, 12)
	}, [query, pages, topics, sections])

	useEffect(() => setActive(0), [query])

	const open = (result: TypeResult) => {
		if (result.kind === 'page') onOpenPage(result.topicId, result.id)
		else if (result.kind === 'topic') onOpenTopic(result.id)
		else onOpenSection(result.id)
		setQuery('')
		setIsOpen(false)
		inputRef.current?.blur()
	}

	return (
		<div className='relative'>
			<Search
				size={15}
				className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle'
			/>
			<input
				ref={inputRef}
				value={query}
				onChange={event => {
					setQuery(event.target.value)
					setIsOpen(true)
				}}
				onFocus={() => {
					loadIndex()
					setIsOpen(true)
				}}
				onBlur={() => setTimeout(() => setIsOpen(false), 150)}
				onKeyDown={event => {
					if (event.key === 'ArrowDown') {
						event.preventDefault()
						setActive(index => Math.min(index + 1, results.length - 1))
					} else if (event.key === 'ArrowUp') {
						event.preventDefault()
						setActive(index => Math.max(index - 1, 0))
					} else if (event.key === 'Enter' && results[active]) {
						open(results[active])
					} else if (event.key === 'Escape') {
						setQuery('')
						inputRef.current?.blur()
					}
				}}
				placeholder='Поиск по архиву'
				className='h-10 w-full border-b border-border bg-transparent pl-9 pr-14 text-sm text-fg outline-none transition-colors placeholder:text-subtle focus:border-primary/70'
			/>
			<kbd className='pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 font-mono text-2xs text-subtle sm:block'>
				Ctrl K
			</kbd>

			{isOpen && query.trim() && (
				<div className='absolute inset-x-0 top-full z-30 mt-2 max-h-[60vh] animate-pop-in overflow-y-auto border border-border bg-elevated shadow-pop'>
					{!pages ? (
						<p className='px-4 py-3 text-sm text-subtle'>Ищем…</p>
					) : results.length === 0 ? (
						<p className='px-4 py-3 text-sm text-subtle'>Ничего не нашлось</p>
					) : (
						results.map((result, index) => {
							const Icon =
								result.kind === 'page'
									? FileText
									: result.kind === 'topic'
										? Hash
										: Folder
							return (
								<button
									key={`${result.kind}-${result.id}`}
									type='button'
									onMouseDown={event => event.preventDefault()}
									onMouseEnter={() => setActive(index)}
									onClick={() => open(result)}
									className={cn(
										'flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0',
										index === active && 'bg-white/[0.05]'
									)}
								>
									<Icon
										size={14}
										className='mt-0.5 shrink-0 text-subtle'
									/>
									<span className='min-w-0 flex-1'>
										<span className='block truncate text-sm text-fg'>
											{result.title}
										</span>
										{'path' in result && result.path && (
											<span className='block truncate font-mono text-2xs uppercase tracking-wider text-subtle'>
												{result.path}
											</span>
										)}
										{result.kind === 'page' && (
											<span className='mt-1 line-clamp-2 block text-xs leading-5 text-muted'>
												{result.snippet}
											</span>
										)}
									</span>
								</button>
							)
						})
					)}
				</div>
			)}
		</div>
	)
}

// Для поиска нужен весь текст без разметки (формулы оставляем — по ним тоже ищут)
export const toPlainText = (markdown: string) =>
	markdown
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/[#>*_~`|$\\]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
