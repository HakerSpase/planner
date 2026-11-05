'use client'

import cn from 'clsx'
import {
	ArrowLeft,
	ArrowRight,
	ChevronDown,
	FileText,
	FolderPlus,
	Menu,
	X
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { extractFlashcards } from '@/components/editor/study'
import { ErrorScreen } from '@/components/ui/ErrorScreen'

import { useBackClose } from '@/hooks/useBackClose'

import { ModeSwitch } from '../../[token]/SharedPage'
import { SharedCards } from '../../[token]/SharedCards'
import { AddToLibraryDialog } from '../../AddToLibraryDialog'

import {
	type IBundle,
	type ISharedContent,
	libraryShareService
} from '@/services/library-share.service'

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{ ssr: false, loading: () => <div className='h-64 animate-pulse bg-white/[0.02]' /> }
)

const noop = () => {}

function Tree({
	bundle,
	activeId,
	onPick
}: {
	bundle: IBundle
	activeId: string | null
	onPick: (pageId: string) => void
}) {
	const [closed, setClosed] = useState<Set<string>>(new Set())
	return (
		<nav aria-label='Содержание ссылки'>
			{bundle.kind === 'section' && (
				<p className='mb-3 px-2 text-sm font-semibold text-fg'>
					{bundle.section_title}
				</p>
			)}
			<ul className='space-y-1'>
				{bundle.topics.map(topic => {
					const isClosed = closed.has(topic.id)
					return (
						<li key={topic.id}>
							<button
								type='button'
								aria-expanded={!isClosed}
								onClick={() =>
									setClosed(current => {
										const next = new Set(current)
										if (isClosed) next.delete(topic.id)
										else next.add(topic.id)
										return next
									})
								}
								className='flex min-h-9 w-full items-center gap-1.5 px-2 py-1.5 text-left text-sm font-medium text-muted transition-colors hover:text-fg'
							>
								<ChevronDown
									size={14}
									className={cn(
										'shrink-0 transition-transform',
										isClosed && '-rotate-90'
									)}
								/>
								<span className='min-w-0 flex-1 break-words'>{topic.title}</span>
							</button>
							{!isClosed && (
								<ul className='ml-[0.95rem] border-l border-border'>
									{topic.pages.map(page => (
										<li key={page.id}>
											<button
												type='button'
												onClick={() => onPick(page.id)}
												className={cn(
													'-ml-px flex min-h-9 w-full items-center gap-2 border-l-2 py-1.5 pl-3 pr-2 text-left text-[13px] leading-5 transition-colors',
													page.id === activeId
														? 'border-primary bg-white/[0.05] text-fg'
														: 'border-transparent text-subtle hover:text-fg'
												)}
											>
												<FileText
													size={13}
													className='shrink-0'
												/>
												<span className='min-w-0 flex-1 break-words'>
													{page.title || 'Без названия'}
												</span>
											</button>
										</li>
									))}
									{!topic.pages.length && (
										<li className='py-1.5 pl-3 text-xs text-subtle'>
											Листов нет
										</li>
									)}
								</ul>
							)}
						</li>
					)
				})}
			</ul>
		</nav>
	)
}

/** Раздел или подразделы по публичной ссылке: слева дерево, справа лист */
export function SharedBundle({ token }: { token: string }) {
	const [bundle, setBundle] = useState<IBundle | null | undefined>(undefined)
	const [activeId, setActiveId] = useState<string | null>(null)
	const [contents, setContents] = useState<Record<string, ISharedContent>>({})
	const [mode, setMode] = useState<'page' | 'cards'>('page')
	const [menuOpen, setMenuOpen] = useState(false)
	const [adding, setAdding] = useState(false)
	const scrollRef = useRef<HTMLElement>(null)
	useBackClose(menuOpen, () => setMenuOpen(false))

	const pages = useMemo(
		() => bundle?.topics.flatMap(topic => topic.pages) ?? [],
		[bundle]
	)

	useEffect(() => {
		libraryShareService
			.getBundle(token)
			.then(data => {
				setBundle(data)
				if (!data) return
				document.title = `${data.kind === 'section' ? data.section_title : data.topics[0]?.title || 'Конспекты'} | Planner`
				const all = data.topics.flatMap(topic => topic.pages)
				const wanted = new URLSearchParams(window.location.search).get('page')
				setActiveId(
					all.find(page => page.id === wanted)?.id ?? all[0]?.id ?? null
				)
			})
			.catch(() => setBundle(null))
	}, [token])

	// Текст листа — только когда его открыли
	useEffect(() => {
		if (!activeId || contents[activeId]) return
		libraryShareService
			.getBundlePages(token, [activeId])
			.then(([row]) => {
				if (row) setContents(current => ({ ...current, [row.id]: row }))
			})
			.catch(() => {})
	}, [activeId, contents, token])

	const pick = (pageId: string) => {
		setActiveId(pageId)
		setMode('page')
		setMenuOpen(false)
		const url = new URL(window.location.href)
		url.searchParams.set('page', pageId)
		window.history.replaceState(window.history.state, '', url)
		scrollRef.current?.scrollTo({ top: 0 })
	}

	const active = activeId ? contents[activeId] : undefined
	const cards = useMemo(
		() => (active ? extractFlashcards(active.id, active.content || '') : []),
		[active]
	)
	const index = pages.findIndex(page => page.id === activeId)
	const previous = index > 0 ? pages[index - 1] : null
	const next = index >= 0 ? pages[index + 1] : null

	if (bundle === null)
		return (
			<ErrorScreen
				code='404'
				title='Ссылка не работает'
				description='Владелец закрыл доступ или ссылка скопирована не полностью.'
			/>
		)

	return (
		<div className='flex h-[100dvh] flex-col bg-bg text-fg'>
			<header className='flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 print:hidden sm:px-6'>
				<div className='flex min-w-0 items-center gap-3'>
					<button
						type='button'
						onClick={() => setMenuOpen(true)}
						aria-label='Содержание'
						className='grid h-9 w-9 shrink-0 place-items-center border border-border text-muted lg:hidden'
					>
						<Menu size={16} />
					</button>
					<Link
						href='/'
						className='shrink-0 font-display font-semibold tracking-tight text-fg'
					>
						Planner
					</Link>
				</div>
				{bundle?.allow_copy && (
					<button
						type='button'
						onClick={() => setAdding(true)}
						className='flex h-9 shrink-0 items-center gap-2 bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
					>
						<FolderPlus size={15} />
						Добавить к себе
					</button>
				)}
			</header>

			<div className='flex min-h-0 flex-1'>
				<aside className='hidden w-72 shrink-0 overflow-y-auto border-r border-border p-3 print:hidden lg:block'>
					{bundle ? (
						<Tree
							bundle={bundle}
							activeId={activeId}
							onPick={pick}
						/>
					) : (
						<div className='space-y-2'>
							{[0, 1, 2, 3].map(item => (
								<div
									key={item}
									className='h-8 animate-pulse bg-white/[0.04]'
								/>
							))}
						</div>
					)}
				</aside>

				<main
					ref={scrollRef}
					data-scroll-root
					className='min-w-0 flex-1 overflow-y-auto px-4 pb-24 pt-8 sm:px-8 sm:pt-12'
				>
					<div className='mx-auto w-full max-w-4xl'>
						{bundle && !pages.length ? (
							<p className='py-20 text-center text-sm text-subtle'>
								Здесь пока нет листов
							</p>
						) : !active ? (
							<div className='space-y-4'>
								<div className='h-9 w-2/3 animate-pulse bg-white/[0.05]' />
								<div className='h-4 w-full animate-pulse bg-white/[0.04]' />
								<div className='h-4 w-5/6 animate-pulse bg-white/[0.04]' />
							</div>
						) : (
							<>
								<h1 className='break-words text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl'>
									{active.title || 'Без названия'}
								</h1>
								{cards.length > 0 && (
									<div className='max-w-sm print:hidden'>
										<ModeSwitch
											mode={mode}
											count={cards.length}
											onChange={setMode}
										/>
									</div>
								)}
								<div className='mt-8'>
									{mode === 'cards' && cards.length > 0 ? (
										<SharedCards
											key={active.id}
											cards={cards}
										/>
									) : (
										<RichEditor
											key={active.id}
											value={active.content}
											onChange={noop}
											editable={false}
											contentClassName='library-reading'
										/>
									)}
								</div>

								{(previous || next) && (
									<div className='mt-12 grid grid-cols-2 gap-2 border-t border-border pt-4 print:hidden'>
										{previous ? (
											<button
												type='button'
												onClick={() => pick(previous.id)}
												className='flex min-w-0 items-center gap-2 border border-border p-3 text-left text-sm text-muted transition-colors hover:text-fg'
											>
												<ArrowLeft
													size={15}
													className='shrink-0'
												/>
												<span className='truncate'>
													{previous.title || 'Без названия'}
												</span>
											</button>
										) : (
											<span />
										)}
										{next && (
											<button
												type='button'
												onClick={() => pick(next.id)}
												className='flex min-w-0 items-center justify-end gap-2 border border-border p-3 text-right text-sm text-muted transition-colors hover:text-fg'
											>
												<span className='truncate'>
													{next.title || 'Без названия'}
												</span>
												<ArrowRight
													size={15}
													className='shrink-0'
												/>
											</button>
										)}
									</div>
								)}
							</>
						)}
					</div>
				</main>
			</div>

			{/* Телефон: дерево — выезжающей панелью */}
			{menuOpen && bundle && (
				<div
					className='fixed inset-0 z-50 animate-fade-in bg-black/60 lg:hidden'
					onMouseDown={event =>
						event.target === event.currentTarget && setMenuOpen(false)
					}
				>
					<div className='h-full w-[85vw] max-w-xs overflow-y-auto border-r border-border bg-elevated p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]'>
						<div className='mb-2 flex justify-end'>
							<button
								type='button'
								onClick={() => setMenuOpen(false)}
								aria-label='Закрыть'
								className='grid h-9 w-9 place-items-center text-subtle hover:text-fg'
							>
								<X size={16} />
							</button>
						</div>
						<Tree
							bundle={bundle}
							activeId={activeId}
							onPick={pick}
						/>
					</div>
				</div>
			)}

			{adding && bundle && (
				<AddToLibraryDialog
					page={
						active ? { title: active.title, content: active.content } : undefined
					}
					bundle={{ token, data: bundle }}
					onClose={() => setAdding(false)}
				/>
			)}
		</div>
	)
}
