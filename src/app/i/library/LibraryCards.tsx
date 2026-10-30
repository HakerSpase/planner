'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import cn from 'clsx'
import { ArrowLeft, Brain, Check, ChevronDown, ChevronRight, FileText, Folder, Layers, RotateCcw, Sparkles, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { MathExcerpt } from '@/components/editor/MathExcerpt'
import { stripAnnotations } from '@/components/editor/annotations'

import type { ILibrarySection, ILibraryTopic } from '@/services/library.service'
import {
	type IDeckCard,
	type TypeGrade,
	flashcardsService,
	formatInterval,
	isDue,
	isLearned
} from '@/services/flashcards.service'

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{ ssr: false, loading: () => <div className='h-8 animate-pulse bg-white/[0.03]' /> }
)

export const DECK_KEY = ['library', 'flashcards']

const GRADES: { grade: TypeGrade; label: string; key: string; className: string }[] = [
	{ grade: 'again', label: 'Снова', key: '1', className: 'border-danger/50 text-danger hover:bg-danger/10' },
	{ grade: 'hard', label: 'Трудно', key: '2', className: 'border-warning/50 text-warning hover:bg-warning/10' },
	{ grade: 'good', label: 'Хорошо', key: '3', className: 'border-success/50 text-success hover:bg-success/10' },
	{ grade: 'easy', label: 'Легко', key: '4', className: 'border-primary/60 text-primary hover:bg-primary/10' }
]

const noop = () => {}

/** Сторона карточки — тем же редактором, что и лист: формулы, цвета, разбор */
function CardSide({ markdown }: { markdown: string }) {
	return (
		<RichEditor
			value={markdown}
			onChange={noop}
			editable={false}
			contentClassName='library-reading card-side'
		/>
	)
}

export function LibraryCards({
	sections,
	topics,
	onOpenPage
}: {
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
	onOpenPage: (topicId: string, pageId: string) => void
}) {
	const queryClient = useQueryClient()
	const { data: deck, isLoading } = useQuery({
		queryKey: DECK_KEY,
		queryFn: flashcardsService.getDeck,
		staleTime: 30_000
	})
	// Что повторяем: всё, раздел (s:), подраздел (t:) или один лист (p:)
	const [scope, setScope] = useState<string>('all')
	const [session, setSession] = useState<IDeckCard[] | null>(null)

	const sectionOfTopic = useMemo(() => new Map(topics.map(topic => [topic.id, topic.section_id])), [topics])
	const filtered = useMemo(
		() => (deck || []).filter(card => matchesScope(scope, card, sectionOfTopic)),
		[deck, scope, sectionOfTopic]
	)
	const due = filtered.filter(card => isDue(card))
	const fresh = due.filter(card => !card.state).length
	const learned = filtered.filter(isLearned).length

	const start = (cards: IDeckCard[]) => {
		// Сначала просроченные, потом новые — вперемешку внутри групп
		const shuffled = [...cards].sort(() => Math.random() - 0.5)
		setSession([...shuffled.filter(card => card.state), ...shuffled.filter(card => !card.state)])
	}

	if (session)
		return (
			<ReviewSession
				initial={session}
				onExit={() => {
					setSession(null)
					queryClient.invalidateQueries({ queryKey: DECK_KEY })
				}}
				onOpenPage={onOpenPage}
			/>
		)

	return (
		<div className='border border-border bg-surface'>
			<div className='grid gap-px bg-border sm:grid-cols-3'>
				<Stat
					label='К повторению сейчас'
					value={due.length}
					hint={fresh ? `из них новых: ${fresh}` : 'новых нет'}
					accent
				/>
				<Stat
					label='Всего карточек'
					value={filtered.length}
					hint='строки «вопрос :: ответ» в листах'
				/>
				<Stat
					label='Выучено'
					value={learned}
					hint='интервал больше 3 недель'
				/>
			</div>

			<div className='grid grid-cols-2 gap-2 border-y border-border p-3 sm:flex sm:items-center'>
				<ScopePicker
					scope={scope}
					onChange={setScope}
					deck={deck || []}
					sections={sections}
					topics={topics}
				/>
				<button
					type='button'
					disabled={!due.length}
					onClick={() => start(due)}
					className={cn(
						'flex h-10 items-center justify-center gap-2 whitespace-nowrap bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40',
						!filtered.length && 'col-span-2'
					)}
				>
					<Brain size={16} />
					{due.length ? `Повторить (${due.length})` : 'На сегодня всё'}
				</button>
				{filtered.length > 0 && (
					<button
						type='button'
						onClick={() => start(filtered)}
						className='h-10 whitespace-nowrap border border-border px-4 text-sm text-muted transition-colors hover:text-fg'
					>
						Пройти все
					</button>
				)}
			</div>

			{isLoading ? (
				<div className='space-y-2 p-4'>
					{[0, 1, 2].map(item => (
						<div
							key={item}
							className='h-12 animate-pulse bg-white/[0.03]'
						/>
					))}
				</div>
			) : filtered.length ? (
				<ul>
					{filtered.map(card => (
						<li
							key={card.id}
							className='flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0'
						>
							<span
								className={cn(
									'h-2 w-2 shrink-0 rounded-full',
									!card.state ? 'bg-primary' : isDue(card) ? 'bg-warning' : isLearned(card) ? 'bg-success' : 'bg-white/25'
								)}
								title={!card.state ? 'Новая' : isDue(card) ? 'Пора повторить' : 'Ждёт своего дня'}
							/>
							<span className='min-w-0 flex-1'>
								<span className='block truncate text-sm text-fg'>
									<MathExcerpt text={stripAnnotations(card.front)} />
								</span>
								<button
									type='button'
									onClick={() => onOpenPage(card.topicId, card.pageId)}
									className='flex items-center gap-1 truncate text-xs text-subtle transition-colors hover:text-primary'
								>
									<FileText size={11} />
									{card.pageTitle}
								</button>
							</span>
							<span className='shrink-0 font-mono text-2xs text-subtle'>
								{!card.state
									? 'новая'
									: isDue(card)
										? 'сейчас'
										: new Date(card.state.due_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
							</span>
						</li>
					))}
				</ul>
			) : (
				<div className='px-6 py-14 text-center'>
					<Sparkles
						size={22}
						className='mx-auto text-primary'
					/>
					<p className='mt-3 text-sm text-fg'>Карточек пока нет</p>
					<p className='mx-auto mt-1 max-w-md text-xs leading-5 text-subtle'>
						Напишите в любом листе строку «Вопрос :: Ответ» — она станет карточкой. Можно с формулами:
						<span className='font-mono text-muted'> Формула дискриминанта :: $D = b^2 - 4ac$</span>. Или вставьте
						кнопкой «Выноска → Карточка» в редакторе.
					</p>
				</div>
			)}
		</div>
	)
}

function matchesScope(scope: string, card: IDeckCard, sectionOfTopic: Map<string, string>) {
	if (scope === 'all') return true
	const id = scope.slice(2)
	if (scope.startsWith('s:')) return sectionOfTopic.get(card.topicId) === id
	if (scope.startsWith('t:')) return card.topicId === id
	return card.pageId === id
}

interface ICounts {
	total: number
	due: number
}

const countCards = (cards: IDeckCard[]): ICounts => ({
	total: cards.length,
	due: cards.filter(card => isDue(card)).length
})

/** Выбор, что повторять: раздел → подраздел → лист, со счётчиками карточек */
function ScopePicker({
	scope,
	onChange,
	deck,
	sections,
	topics
}: {
	scope: string
	onChange: (scope: string) => void
	deck: IDeckCard[]
	sections: ILibrarySection[]
	topics: ILibraryTopic[]
}) {
	const [open, setOpen] = useState(false)
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}
		const escape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setOpen(false)
		}
		document.addEventListener('pointerdown', close)
		document.addEventListener('keydown', escape)
		return () => {
			document.removeEventListener('pointerdown', close)
			document.removeEventListener('keydown', escape)
		}
	}, [open])

	// Счётчики: всего и к повторению — для каждого раздела, подраздела и листа
	const tree = useMemo(
		() =>
			sections
				.map(section => {
					const sectionTopics = topics
						.filter(topic => topic.section_id === section.id)
						.map(topic => {
							const cards = deck.filter(card => card.topicId === topic.id)
							const pages = Array.from(new Map(cards.map(card => [card.pageId, card.pageTitle]))).map(
								([id, title]) => ({ id, title, ...countCards(cards.filter(card => card.pageId === id)) })
							)
							return { ...topic, pages, ...countCards(cards) }
						})
						.filter(topic => topic.total)
					const cards = deck.filter(card => sectionTopics.some(topic => topic.id === card.topicId))
					return { ...section, topics: sectionTopics, ...countCards(cards) }
				})
				.filter(section => section.total),
		[deck, sections, topics]
	)

	const label = useMemo(() => {
		const id = scope.slice(2)
		for (const section of tree) {
			if (section.id === id) return section.title
			for (const topic of section.topics) {
				if (topic.id === id) return `${section.title} · ${topic.title}`
				const page = topic.pages.find(item => item.id === id)
				if (page) return page.title
			}
		}
		return 'Все карточки'
	}, [scope, tree])

	const toggle = (id: string) =>
		setExpanded(value => {
			const next = new Set(value)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})

	const pick = (value: string) => {
		onChange(value)
		setOpen(false)
	}

	const row = (value: string, title: string, counts: ICounts, depth: number, icon: React.ReactNode, expandId?: string) => (
		<div
			key={value}
			className={cn(
				'flex items-center transition-colors',
				scope === value ? 'bg-primary/10 text-fg' : 'text-muted hover:bg-white/[0.04] hover:text-fg'
			)}
			style={{ paddingLeft: `${depth * 1.1 + 0.25}rem` }}
		>
			{expandId ? (
				<button
					type='button'
					aria-label={expanded.has(expandId) ? 'Свернуть' : 'Развернуть'}
					onClick={() => toggle(expandId)}
					className='grid h-10 w-8 shrink-0 place-items-center text-subtle hover:text-fg'
				>
					<ChevronRight
						size={15}
						className={cn('transition-transform', expanded.has(expandId) && 'rotate-90')}
					/>
				</button>
			) : (
				<span className='w-8 shrink-0' />
			)}
			<button
				type='button'
				onClick={() => pick(value)}
				className='flex min-w-0 flex-1 items-center gap-2 py-2.5 pr-3 text-left text-sm'
			>
				<span className='shrink-0 text-subtle'>{icon}</span>
				<span className='min-w-0 flex-1 truncate'>{title}</span>
				{counts.due > 0 && (
					<span
						className='shrink-0 rounded-full bg-primary/15 px-1.5 font-mono text-2xs text-primary'
						title='К повторению'
					>
						{counts.due}
					</span>
				)}
				<span
					className='w-6 shrink-0 text-right font-mono text-2xs text-subtle'
					title='Всего карточек'
				>
					{counts.total}
				</span>
				<Check
					size={14}
					className={cn('shrink-0 text-primary', scope !== value && 'invisible')}
				/>
			</button>
		</div>
	)

	return (
		<div
			ref={rootRef}
			className='relative col-span-2 min-w-0 sm:w-72 sm:flex-none'
		>
			<button
				type='button'
				onClick={() => setOpen(value => !value)}
				aria-expanded={open}
				className={cn(
					'flex h-10 w-full items-center gap-2 border bg-surface-2 px-3 text-left text-sm text-fg transition-colors',
					open ? 'border-primary/60' : 'border-border hover:border-white/20'
				)}
			>
				<Layers
					size={15}
					className='shrink-0 text-primary'
				/>
				<span className='min-w-0 flex-1 truncate'>{label}</span>
				<ChevronDown
					size={15}
					className={cn('shrink-0 text-subtle transition-transform', open && 'rotate-180')}
				/>
			</button>

			{open && (
				<>
					{/* На телефоне — шторка снизу, на компьютере — выпадающий список */}
					<div
						className='fixed inset-0 z-40 bg-black/50 sm:hidden'
						onClick={() => setOpen(false)}
					/>
					<div className='fixed inset-x-0 bottom-0 z-50 max-h-[75dvh] overflow-y-auto border-t border-border bg-surface pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-1 sm:max-h-[60vh] sm:w-[24rem] sm:border sm:pb-1'>
						<div className='sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:hidden'>
							<span className='text-sm font-medium text-fg'>Что повторять</span>
							<button
								type='button'
								aria-label='Закрыть'
								onClick={() => setOpen(false)}
								className='text-subtle hover:text-fg'
							>
								<X size={18} />
							</button>
						</div>
						<div className='py-1'>
							{row('all', 'Все карточки', countCards(deck), 0, <Layers size={14} />)}
							{tree.map(section => (
								<div key={section.id}>
									{row(`s:${section.id}`, section.title, section, 0, <Folder size={14} />, section.id)}
									{expanded.has(section.id) &&
										section.topics.map(topic => (
											<div key={topic.id}>
												{row(
													`t:${topic.id}`,
													topic.title,
													topic,
													1,
													<Folder size={13} />,
													topic.pages.length > 1 ? topic.id : undefined
												)}
												{expanded.has(topic.id) &&
													topic.pages.map(page => row(`p:${page.id}`, page.title, page, 2, <FileText size={13} />))}
											</div>
										))}
								</div>
							))}
						</div>
					</div>
				</>
			)}
		</div>
	)
}

function Stat({ label, value, hint, accent }: { label: string; value: number; hint: string; accent?: boolean }) {
	return (
		<div className='bg-surface px-4 py-4'>
			<p className='eyebrow'>{label}</p>
			<p className={cn('mt-1 font-mono text-3xl tabular-nums', accent && value ? 'text-primary' : 'text-fg')}>{value}</p>
			<p className='mt-0.5 text-xs text-subtle'>{hint}</p>
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Тренировка                                                           */
/* ------------------------------------------------------------------ */

function ReviewSession({
	initial,
	onExit,
	onOpenPage
}: {
	initial: IDeckCard[]
	onExit: () => void
	onOpenPage: (topicId: string, pageId: string) => void
}) {
	const [queue, setQueue] = useState(initial)
	const [revealed, setRevealed] = useState(false)
	const [done, setDone] = useState(0)
	const [again, setAgain] = useState(0)
	const total = initial.length
	const card = queue[0]

	const answer = useCallback(
		async (grade: TypeGrade) => {
			if (!card) return
			setRevealed(false)
			try {
				const state = await flashcardsService.grade(card, grade)
				setQueue(current => {
					const rest = current.slice(1)
					// «Снова» — карточка вернётся в конце этой же тренировки
					return grade === 'again' ? [...rest, { ...card, state }] : rest
				})
				if (grade === 'again') setAgain(value => value + 1)
				else setDone(value => value + 1)
			} catch {
				toast.error('Не удалось сохранить ответ')
				setRevealed(true)
			}
		},
		[card]
	)

	// Пробел — показать ответ, 1–4 — оценка
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.target as HTMLElement).closest('input, textarea, [contenteditable=true]')) return
			if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
				event.preventDefault()
				setRevealed(true)
				return
			}
			const grade = GRADES.find(item => item.key === event.key)
			if (revealed && grade) answer(grade.grade)
			if (event.key === 'Escape') onExit()
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [revealed, answer, onExit])

	const progress = total ? Math.min(100, (done / total) * 100) : 100

	return (
		<div className='mx-auto max-w-2xl'>
			<div className='mb-4 flex items-center justify-between gap-3'>
				<button
					type='button'
					onClick={onExit}
					className='flex items-center gap-1.5 text-sm text-subtle transition-colors hover:text-fg'
				>
					<ArrowLeft size={15} />
					К списку
				</button>
				<span className='font-mono text-xs tabular-nums text-muted'>
					{Math.min(done, total)} / {total}
					{again > 0 && <span className='text-danger'> · повторов {again}</span>}
				</span>
			</div>
			<div className='mb-5 h-1 bg-white/[0.06]'>
				<div
					className='h-full bg-primary transition-[width] duration-300'
					style={{ width: `${progress}%` }}
				/>
			</div>

			{card ? (
				<div
					key={`${card.id}:${card.state?.reps ?? 0}:${queue.length}`}
					className='animate-fade-in border border-border bg-surface'
				>
					<div className='border-b border-border px-5 py-6 sm:px-8 sm:py-8'>
						<p className='eyebrow mb-3'>Вопрос</p>
						<div className='text-lg'>
							<CardSide markdown={card.front} />
						</div>
					</div>

					{revealed ? (
						<>
							<div className='border-b border-border bg-bg/40 px-5 py-6 sm:px-8'>
								<p className='eyebrow mb-3'>Ответ</p>
								<CardSide markdown={card.back} />
								<button
									type='button'
									onClick={() => onOpenPage(card.topicId, card.pageId)}
									className='mt-4 flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-primary'
								>
									<FileText size={12} />
									{card.pageTitle}
								</button>
							</div>
							<div className='grid grid-cols-4 gap-1.5 p-3'>
								{GRADES.map(({ grade, label, key, className }) => (
									<button
										key={grade}
										type='button'
										onClick={() => answer(grade)}
										className={cn('flex flex-col items-center border px-1 py-2.5 transition-colors', className)}
									>
										<span className='text-sm font-medium'>{label}</span>
										<span className='mt-0.5 font-mono text-2xs opacity-80'>
											{formatInterval(card.state, grade)}
											<span className='hidden sm:inline'> · {key}</span>
										</span>
									</button>
								))}
							</div>
						</>
					) : (
						<div className='p-3'>
							<button
								type='button'
								onClick={() => setRevealed(true)}
								className='h-12 w-full bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover'
							>
								Показать ответ
								<span className='ml-2 hidden font-mono text-xs opacity-70 sm:inline'>пробел</span>
							</button>
						</div>
					)}
				</div>
			) : (
				<div className='animate-fade-in border border-border bg-surface px-6 py-14 text-center'>
					<Check
						size={26}
						className='mx-auto text-success'
					/>
					<p className='mt-3 text-lg font-semibold text-fg'>Тренировка закончена</p>
					<p className='mt-1 text-sm text-muted'>
						Карточек пройдено: {done}
						{again > 0 && `, повторено после ошибки: ${again}`}. Следующие вернутся в свой день.
					</p>
					<div className='mt-6 flex justify-center gap-2'>
						<button
							type='button'
							onClick={onExit}
							className='flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover'
						>
							<RotateCcw size={14} />
							К карточкам
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
