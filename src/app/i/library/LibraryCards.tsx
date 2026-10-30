'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import cn from 'clsx'
import { ArrowLeft, Brain, Check, FileText, RotateCcw, Sparkles } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
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
	const [sectionId, setSectionId] = useState<string>('all')
	const [session, setSession] = useState<IDeckCard[] | null>(null)

	const sectionOfTopic = useMemo(() => new Map(topics.map(topic => [topic.id, topic.section_id])), [topics])
	const filtered = useMemo(
		() =>
			(deck || []).filter(card => sectionId === 'all' || sectionOfTopic.get(card.topicId) === sectionId),
		[deck, sectionId, sectionOfTopic]
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

			<div className='flex flex-wrap items-center gap-2 border-y border-border p-3'>
				<select
					value={sectionId}
					onChange={event => setSectionId(event.target.value)}
					className='h-10 min-w-0 flex-1 border border-border bg-surface-2 px-3 text-sm text-fg outline-none [color-scheme:dark] sm:flex-none'
				>
					<option value='all'>Все разделы</option>
					{sections.map(section => (
						<option
							key={section.id}
							value={section.id}
						>
							{section.title}
						</option>
					))}
				</select>
				<button
					type='button'
					disabled={!due.length}
					onClick={() => start(due)}
					className='flex h-10 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40'
				>
					<Brain size={16} />
					{due.length ? `Повторить (${due.length})` : 'На сегодня всё'}
				</button>
				{filtered.length > 0 && (
					<button
						type='button'
						onClick={() => start(filtered)}
						className='h-10 border border-border px-4 text-sm text-muted transition-colors hover:text-fg'
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
