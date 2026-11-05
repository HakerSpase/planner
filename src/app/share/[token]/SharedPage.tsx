'use client'

import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import {
	Eye,
	FileText,
	FolderPlus,
	Layers,
	ListTree,
	Printer
} from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import { extractFlashcards } from '@/components/editor/study'
import { ErrorScreen } from '@/components/ui/ErrorScreen'

import { AddToLibraryDialog } from '../AddToLibraryDialog'

import { SharedCards } from './SharedCards'
import { libraryShareService } from '@/services/library-share.service'
import {
	OutlineSheet,
	PageOutline,
	ReadingProgress,
	useHeadings
} from '@/app/i/library/PageTools'
import { createClient } from '@/lib/supabase/client'

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{
		ssr: false,
		loading: () => <div className='h-64 animate-pulse bg-white/[0.02]' />
	}
)

interface ISharedPage {
	title: string
	content: string
	updated_at: string
	topic: string | null
	section: string | null
}

const noop = () => {}

/** Лист архива по публичной ссылке — только чтение, без входа */
export function SharedPage({ token }: { token: string }) {
	const [page, setPage] = useState<ISharedPage | null | undefined>(undefined)
	const [selfCheck, setSelfCheck] = useState(false)
	const [showOutline, setShowOutline] = useState(true)
	const [outlineOpen, setOutlineOpen] = useState(false)
	// Лист или его карточки; ссылка с ?cards открывается сразу карточками
	const [mode, setMode] = useState<'page' | 'cards'>('page')
	const [allowCopy, setAllowCopy] = useState(false)
	const [adding, setAdding] = useState(false)
	const articleRef = useRef<HTMLElement>(null)
	const headings = useHeadings(articleRef, Boolean(page) && mode === 'page')
	const cards = useMemo(
		() => (page ? extractFlashcards(token, page.content || '') : []),
		[page, token]
	)
	const showCards = mode === 'cards' && cards.length > 0

	useEffect(() => {
		if (new URLSearchParams(window.location.search).has('cards'))
			setMode('cards')
		libraryShareService.getSharedPageAllowCopy(token).then(setAllowCopy)
	}, [token])

	const switchMode = (next: 'page' | 'cards') => {
		setMode(next)
		const url = new URL(window.location.href)
		if (next === 'cards') url.searchParams.set('cards', '')
		else url.searchParams.delete('cards')
		window.history.replaceState(
			window.history.state,
			'',
			url.toString().replace('cards=', 'cards')
		)
		document.querySelector('[data-scroll-root]')?.scrollTo({ top: 0 })
	}

	useEffect(() => {
		createClient()
			.rpc('get_shared_page', { p_token: token })
			.then(({ data }) => {
				const row = (data as ISharedPage[] | null)?.[0] ?? null
				setPage(row)
				if (row?.title) document.title = `${row.title} | Planner`
			})
	}, [token])

	if (page === null)
		return (
			<ErrorScreen
				code='404'
				title='Ссылка не работает'
				description='Владелец закрыл доступ к листу или ссылка скопирована не полностью.'
			/>
		)

	return (
		<div
			data-scroll-root
			className='h-[100dvh] overflow-y-auto bg-bg text-fg'
		>
			<header className='sticky top-0 z-20 border-b border-border bg-bg print:hidden'>
				<ReadingProgress anchorRef={articleRef} />
				<div className='flex h-14 w-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8 xl:px-10'>
					<div className='flex min-w-0 items-center gap-2 text-sm'>
						<Link
							href='/'
							className='shrink-0 font-display font-semibold tracking-tight text-fg'
						>
							Planner
						</Link>
					</div>
					<div className='flex shrink-0 items-center gap-2'>
						{allowCopy && page && (
							<button
								type='button'
								onClick={() => setAdding(true)}
								title='Добавить к себе'
								className='flex h-9 items-center gap-2 bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
							>
								<FolderPlus size={15} />
								<span className='hidden sm:inline'>Добавить к себе</span>
							</button>
						)}
						{!showCards && (
							<>
								<button
									type='button'
									onClick={() => setSelfCheck(value => !value)}
									aria-pressed={selfCheck}
									className={`flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors ${selfCheck ? 'border-primary/60 text-fg' : 'border-border text-muted hover:text-fg'}`}
								>
									<Eye size={14} />
									Проверка
								</button>
								{headings.length > 1 && (
									<>
										<button
											type='button'
											onClick={() => setShowOutline(value => !value)}
											title={
												showOutline
													? 'Скрыть содержание'
													: 'Показать содержание'
											}
											aria-label={
												showOutline
													? 'Скрыть содержание'
													: 'Показать содержание'
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
										<button
											type='button'
											onClick={() => setOutlineOpen(true)}
											title='Содержание'
											aria-label='Содержание'
											className='grid h-9 w-9 place-items-center border border-border text-muted transition-colors hover:text-fg xl:hidden'
										>
											<ListTree size={15} />
										</button>
									</>
								)}
								<button
									type='button'
									onClick={() => window.print()}
									aria-label='Печать или PDF'
									title='Печать или PDF'
									className='grid h-9 w-9 place-items-center border border-border text-muted transition-colors hover:text-fg'
								>
									<Printer size={15} />
								</button>
							</>
						)}
					</div>
				</div>
			</header>

			{showCards ? (
				<main className='w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-10'>
					<div className='mx-auto max-w-2xl'>
						<h1 className='break-words text-2xl font-semibold leading-tight tracking-[-0.02em] sm:text-3xl'>
							{page?.title || 'Без названия'}
						</h1>
						<ModeSwitch
							mode={mode}
							count={cards.length}
							onChange={switchMode}
						/>
					</div>
					<SharedCards cards={cards} />
				</main>
			) : (
				<main
					ref={articleRef}
					className='library-article w-full px-4 pb-24 pt-10 sm:px-6 sm:pt-14 lg:px-8 xl:px-10'
				>
					{page === undefined ? (
						<div className='space-y-4'>
							<div className='h-9 w-2/3 animate-pulse bg-white/[0.05]' />
							<div className='h-4 w-full animate-pulse bg-white/[0.04]' />
							<div className='h-4 w-5/6 animate-pulse bg-white/[0.04]' />
						</div>
					) : (
						<div
							className={cn(
								'grid w-full grid-cols-[minmax(0,1fr)] gap-10',
								headings.length > 1 &&
									showOutline &&
									'xl:grid-cols-[minmax(0,1fr)_13rem]'
							)}
						>
							<div className='min-w-0'>
								<h1 className='break-words text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl'>
									{page.title || 'Без названия'}
								</h1>
								<p className='mt-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
									{dayjs(page.updated_at)
										.locale('ru')
										.format('D MMMM YYYY, HH:mm')}
								</p>
								{cards.length > 0 ? (
									<div className='mb-8 max-w-sm print:hidden'>
										<ModeSwitch
											mode={mode}
											count={cards.length}
											onChange={switchMode}
										/>
									</div>
								) : (
									<div className='mb-8' />
								)}
								<RichEditor
									value={page.content}
									onChange={noop}
									editable={false}
									selfCheck={selfCheck}
									contentClassName='library-reading'
								/>
							</div>

							{headings.length > 1 && showOutline && (
								<aside className='hidden print:hidden xl:block'>
									<div className='sticky top-20 max-h-[calc(100dvh-7rem)] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
										<p className='eyebrow mb-3'>Содержание</p>
										<PageOutline headings={headings} />
									</div>
								</aside>
							)}
						</div>
					)}
				</main>
			)}

			{selfCheck && !showCards && (
				<p className='fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 border border-primary/40 bg-elevated px-4 py-2 text-xs text-muted shadow-pop print:hidden'>
					Режим проверки: нажмите на размытое, чтобы открыть
				</p>
			)}
			{adding && page && (
				<AddToLibraryDialog
					page={{ title: page.title, content: page.content }}
					onClose={() => setAdding(false)}
				/>
			)}
			{outlineOpen && (
				<OutlineSheet
					headings={headings}
					onClose={() => setOutlineOpen(false)}
				/>
			)}
		</div>
	)
}

export function ModeSwitch({
	mode,
	count,
	onChange
}: {
	mode: 'page' | 'cards'
	count: number
	onChange: (mode: 'page' | 'cards') => void
}) {
	const items = [
		{ id: 'page' as const, label: 'Конспект', icon: FileText },
		{ id: 'cards' as const, label: `Карточки · ${count}`, icon: Layers }
	]
	return (
		<div
			role='tablist'
			className='mb-4 mt-4 grid grid-cols-2 border border-border bg-surface p-1 sm:mb-6'
		>
			{items.map(({ id, label, icon: Icon }) => (
				<button
					key={id}
					type='button'
					role='tab'
					aria-selected={mode === id}
					onClick={() => onChange(id)}
					className={cn(
						'flex h-10 items-center justify-center gap-2 text-sm transition-colors',
						mode === id
							? 'bg-white/[0.08] font-medium text-fg'
							: 'text-muted hover:text-fg'
					)}
				>
					<Icon size={15} />
					{label}
				</button>
			))}
		</div>
	)
}
