'use client'

import cn from 'clsx'
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	getDayOfYear,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek,
	subYears
} from 'date-fns'
import { ru } from 'date-fns/locale'
import {
	ChevronLeft,
	ChevronRight,
	Clock,
	History,
	Loader2,
	Maximize2,
	Minimize2,
	Search
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { MathExcerpt } from '@/components/editor/MathExcerpt'
import { useProfile } from '@/hooks/useProfile'
import { dateKeyInTimeZone } from '@/lib/time-zone'

import { toExcerpt } from '@/services/library.service'
import { thoughtsService } from '@/services/thoughts.service'

import { MoodScale, moodColor } from './MoodScale'

// Редактор тяжёлый (Tiptap + ProseMirror) — грузим его только когда он нужен
const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{
		ssr: false,
		loading: () => <div className='min-h-[240px] animate-pulse bg-white/[0.02]' />
	}
)

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

// Вопрос-подсказка на пустом дне — свой на каждый день года
const PROMPTS = [
	'Что сегодня получилось лучше всего?',
	'За что хочется сказать себе спасибо?',
	'Что заняло больше всего мыслей?',
	'Чему ты сегодня научился?',
	'Что бы ты сделал иначе, если бы начал день заново?',
	'Какой момент дня хочется запомнить?',
	'Что сегодня дало энергию, а что забрало?',
	'Какой маленький шаг ты сделал к большой цели?',
	'Что тебя удивило?',
	'О чём ты думаешь перед сном?',
	'Что можно отпустить и не нести в завтра?',
	'Кто сегодня помог тебе — или кому помог ты?'
]

type TypeView = 'day' | 'feed'

export default function ThoughtsPage() {
	const { data: profile } = useProfile()
	const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
	const timeZone = profile?.user.timeZone || deviceTimeZone
	const currentDate = () => {
		const [year, month, day] = dateKeyInTimeZone(new Date(), timeZone)
			.split('-')
			.map(Number)
		return new Date(year, month - 1, day)
	}

	const [month, setMonth] = useState(currentDate)
	const [selected, setSelected] = useState(currentDate)
	const [entries, setEntries] = useState<Record<string, string>>({})
	const [moods, setMoods] = useState<Record<string, number | null>>({})
	const [draft, setDraft] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const [view, setView] = useState<TypeView>('day')
	const [isFocus, setIsFocus] = useState(false)
	const hasUserSelectedRef = useRef(false)
	const [query, setQuery] = useState('')
	const [archive, setArchive] = useState<Array<{ thought_date: string; content: string }> | null>(
		null
	)
	const [yearAgo, setYearAgo] = useState<Record<string, string | null>>({})

	const monthStart = startOfMonth(month)
	const todayKey = dateKeyInTimeZone(new Date(), timeZone)
	const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
	const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
	const startKey = iso(gridStart)
	const endKey = iso(gridEnd)

	const days = useMemo(
		() => eachDayOfInterval({ start: gridStart, end: gridEnd }),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[startKey, endKey]
	)

	useEffect(() => {
		let active = true
		setLoading(true)
		thoughtsService
			.getRange(startKey, endKey)
			.then(rows => {
				if (!active) return
				const contents: Record<string, string> = {}
				const moodMap: Record<string, number | null> = {}
				for (const row of rows) {
					const key = row.thought_date.slice(0, 10)
					contents[key] = row.content || ''
					moodMap[key] = row.mood ?? null
				}
				setEntries(contents)
				setMoods(moodMap)
			})
			.catch(() => toast.error('Не удалось загрузить записи за этот месяц'))
			.finally(() => active && setLoading(false))
		return () => {
			active = false
		}
	}, [startKey, endKey])

	useEffect(() => {
		if (!hasUserSelectedRef.current) {
			const today = currentDate()
			setMonth(today)
			setSelected(today)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [timeZone])

	// Черновик берём из сохранённого только при смене дня или после загрузки месяца —
	// иначе ответ автосохранения затирал бы текст, набранный во время запроса
	useEffect(() => {
		if (loading) return
		setDraft(entries[iso(selected)] ?? '')
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selected, loading])

	const save = useCallback(
		async (dateKey: string, content: string, silent = true) => {
			const previous = entries[dateKey]
			setEntries(current => ({ ...current, [dateKey]: content }))
			setSaving(true)
			try {
				await thoughtsService.save(dateKey, content)
				if (!silent) toast.success('Запись сохранена')
			} catch {
				setEntries(current => {
					const updated = { ...current }
					if (previous === undefined) delete updated[dateKey]
					else updated[dateKey] = previous
					return updated
				})
				toast.error('Не удалось сохранить запись')
			} finally {
				setSaving(false)
			}
		},
		[entries]
	)

	const selectedKey = iso(selected)
	const isDirty = (entries[selectedKey] || '') !== draft

	// Перед уходом на другой день досохраняем текущий черновик
	const flushDraft = () => {
		if (isDirty) save(selectedKey, draft)
	}

	const openDay = (day: Date) => {
		flushDraft()
		hasUserSelectedRef.current = true
		if (!isSameMonth(day, month)) setMonth(day)
		setSelected(day)
		setView('day')
	}

	const changeMonth = (direction: -1 | 1) => {
		flushDraft()
		const next = addMonths(month, direction)
		setMonth(next)
		setSelected(startOfMonth(next))
		hasUserSelectedRef.current = true
	}

	// Автосохранение через 1,5 с после последней правки
	useEffect(() => {
		if (!isDirty || saving || loading) return
		const timer = setTimeout(() => save(selectedKey, draft), 1500)
		return () => clearTimeout(timer)
	}, [draft, isDirty, saving, loading, selectedKey, save])

	const changeMood = async (mood: number | null) => {
		const previous = moods[selectedKey] ?? null
		setMoods(current => ({ ...current, [selectedKey]: mood }))
		try {
			await thoughtsService.saveMood(selectedKey, mood)
			setEntries(current => ({ ...current, [selectedKey]: current[selectedKey] ?? '' }))
		} catch {
			setMoods(current => ({ ...current, [selectedKey]: previous }))
			toast.error('Не удалось сохранить настроение')
		}
	}

	// Менеджер загрузок дописал файл в запись, пока она была закрыта
	useEffect(() => {
		const onPatched = (event: Event) => {
			const { context, content } = (event as CustomEvent).detail
			if (context.type !== 'thought') return
			setEntries(current => ({ ...current, [context.date]: content }))
			if (context.date === selectedKey) setDraft(content)
		}
		window.addEventListener('planner:note-patched', onPatched)
		return () => window.removeEventListener('planner:note-patched', onPatched)
	}, [selectedKey])

	// «В этот день год назад»
	const yearAgoKey = iso(subYears(selected, 1))
	useEffect(() => {
		if (yearAgo[yearAgoKey] !== undefined) return
		thoughtsService
			.getRange(yearAgoKey, yearAgoKey)
			.then(rows => setYearAgo(current => ({ ...current, [yearAgoKey]: rows[0]?.content || null })))
			.catch(() => setYearAgo(current => ({ ...current, [yearAgoKey]: null })))
	}, [yearAgoKey, yearAgo])
	const yearAgoText = yearAgo[yearAgoKey]

	// Поиск по всем записям: архив грузим один раз, при первом запросе
	useEffect(() => {
		if (!query.trim() || archive) return
		thoughtsService
			.getRange('2000-01-01', todayKey)
			.then(rows => setArchive(rows))
			.catch(() => setArchive([]))
	}, [query, archive, todayKey])

	const searchResults = useMemo(() => {
		const needle = query.trim().toLowerCase()
		if (!needle || !archive) return []
		return archive
			.map(row => {
				const date = row.thought_date.slice(0, 10)
				return { date, text: toExcerpt(entries[date] ?? row.content, 20000) }
			})
			.filter(row => row.text.toLowerCase().includes(needle))
			.reverse()
			.slice(0, 20)
			.map(row => {
				const index = row.text.toLowerCase().indexOf(needle)
				const from = Math.max(0, index - 40)
				return { date: row.date, snippet: (from ? '…' : '') + row.text.slice(from, from + 120) }
			})
	}, [query, archive, entries])

	const openKey = (key: string) => {
		const [year, monthIndex, day] = key.split('-').map(Number)
		openDay(new Date(year, monthIndex - 1, day))
		setQuery('')
	}

	// Режим «только писать»: на весь экран, выход по Esc
	const enterFocus = () => {
		setIsFocus(true)
		document.documentElement.requestFullscreen?.().catch(() => {})
	}
	const exitFocus = useCallback(() => {
		setIsFocus(false)
		if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
	}, [])
	useEffect(() => {
		if (!isFocus) return
		const onKey = (event: KeyboardEvent) => {
			if (event.key === 'Escape') exitFocus()
		}
		// Esc в полноэкранном режиме браузер забирает себе — ловим выход из fullscreen
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

	const wordsCount = draft.trim() ? toExcerpt(draft).split(/\s+/).filter(Boolean).length : 0
	const prompt = PROMPTS[getDayOfYear(selected) % PROMPTS.length]
	const placeholder = `${prompt} Пишите свободно — # заголовок, - список, $формулы$, фото и голосовые.`

	const feed = Object.keys(entries)
		.filter(key => entries[key]?.trim() && key.startsWith(format(month, 'yyyy-MM')))
		.sort()
		.reverse()

	const status = saving ? 'Сохранение…' : isDirty ? 'Не сохранено' : entries[selectedKey] ? 'Сохранено' : ''

	return (
		<div className='w-full min-w-0 pb-12'>
			<div className='mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5 sm:mb-8 sm:pb-6'>
				<div>
					<h1 className='text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-4xl'>Мысли</h1>
					<p className='mt-1.5 text-sm text-muted'>Дневник по дням: мысли, настроение, итоги</p>
				</div>
				<div
					role='tablist'
					className='flex divide-x divide-border border border-border'
				>
					{(
						[
							['day', 'День'],
							['feed', 'Лента']
						] as const
					).map(([value, label]) => (
						<button
							key={value}
							type='button'
							role='tab'
							aria-selected={view === value}
							onClick={() => {
								flushDraft()
								setView(value)
							}}
							className={cn(
								'h-9 px-4 text-sm font-medium transition-colors',
								view === value ? 'bg-white/[0.06] text-fg' : 'text-muted hover:text-fg'
							)}
						>
							{label}
						</button>
					))}
				</div>
			</div>

			<div className='grid items-start gap-6 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[350px_minmax(0,1fr)]'>
				{/* Слева: поиск и календарь */}
				<div className='flex min-w-0 flex-col gap-4'>
					<div className='relative'>
						<Search
							size={15}
							className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle'
						/>
						<input
							type='search'
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder='Поиск по всем записям'
							className='h-10 w-full border border-border bg-surface pl-9 pr-3 text-sm text-fg outline-none placeholder:text-subtle focus:border-primary/70'
						/>
						{query.trim() && (
							<div className='absolute inset-x-0 top-full z-20 mt-1 max-h-96 animate-pop-in overflow-y-auto border border-border bg-elevated shadow-pop'>
								{!archive ? (
									<p className='px-4 py-3 text-sm text-subtle'>Ищем…</p>
								) : searchResults.length === 0 ? (
									<p className='px-4 py-3 text-sm text-subtle'>Ничего не найдено</p>
								) : (
									searchResults.map(result => (
										<button
											key={result.date}
											type='button'
											onClick={() => openKey(result.date)}
											className='block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04]'
										>
											<span className='eyebrow'>
												{format(new Date(`${result.date}T12:00:00`), 'd MMMM yyyy', { locale: ru })}
											</span>
											<span className='mt-1 line-clamp-2 block text-sm text-muted'>
												<MathExcerpt text={result.snippet} />
											</span>
										</button>
									))
								)}
							</div>
						)}
					</div>

					<section className='border border-border bg-surface p-4'>
						<div className='mb-3 flex items-center justify-between'>
							<button
								className='grid h-8 w-8 place-items-center text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
								aria-label='Предыдущий месяц'
								onClick={() => changeMonth(-1)}
							>
								<ChevronLeft size={18} />
							</button>
							<h2 className='text-sm font-semibold capitalize text-fg'>
								{format(month, 'LLLL yyyy', { locale: ru })}
							</h2>
							<button
								className='grid h-8 w-8 place-items-center text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
								aria-label='Следующий месяц'
								onClick={() => changeMonth(1)}
							>
								<ChevronRight size={18} />
							</button>
						</div>

						<div className='grid grid-cols-7 text-center'>
							{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
								<div
									key={day}
									className='py-2 font-mono text-2xs uppercase text-subtle'
								>
									{day}
								</div>
							))}
							{days.map(day => {
								const key = iso(day)
								const isToday = key === todayKey
								const hasEntry = Boolean(entries[key]?.trim())
								const mood = moodColor(moods[key])
								const isSelected = view === 'day' && isSameDay(day, selected)
								return (
									<button
										key={key}
										onClick={() => openDay(day)}
										aria-pressed={isSelected}
										aria-label={`${format(day, 'd MMMM yyyy', { locale: ru })}${isToday ? ', сегодня' : ''}${hasEntry ? ', есть запись' : ''}`}
										className={cn(
											'relative flex aspect-square flex-col items-center justify-center text-sm transition-colors hover:bg-white/[0.06]',
											!isSameMonth(day, month) ? 'text-subtle/60' : 'text-fg',
											isSelected && 'bg-white/[0.08] outline outline-1 -outline-offset-1 outline-primary'
										)}
									>
										<span className={cn('leading-none', isToday && 'font-semibold text-primary')}>
											{format(day, 'd')}
										</span>
										{hasEntry && !mood && (
											<span className='absolute bottom-1.5 h-1 w-1 bg-white/40' />
										)}
										{mood && (
											<span
												className='absolute bottom-1 h-1 w-4'
												style={{ backgroundColor: mood }}
											/>
										)}
									</button>
								)
							})}
						</div>

						<div className='mt-3 flex items-center justify-between border-t border-border pt-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
							<span className='flex items-center gap-1.5'>
								<span className='h-1 w-3 bg-gradient-to-r from-[#f46363] via-[#e9c46a] to-[#34c780]' />
								настроение
							</span>
							{loading && <span className='animate-pulse'>загрузка…</span>}
						</div>
					</section>
				</div>

				{/* Справа: день или лента */}
				{view === 'day' ? (
					<section className='flex min-h-[580px] flex-col border border-border bg-surface p-5 sm:p-7'>
						<div className='mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5'>
							<div className='min-w-0'>
								<h2 className='text-lg font-semibold capitalize text-fg sm:text-xl'>
									{format(selected, 'EEEE, d MMMM yyyy', { locale: ru })}
								</h2>
								<p className='mt-1 flex items-center gap-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
									<span>{wordsCount} сл.</span>
									{wordsCount > 0 && (
										<span className='flex items-center gap-1'>
											<Clock size={11} />~{Math.max(1, Math.ceil(wordsCount / 180))} мин
										</span>
									)}
									{status && (
										<span className={cn(isDirty && !saving && 'text-warning')}>
											{saving && <Loader2 size={11} className='mr-1 inline animate-spin' />}
											{status}
										</span>
									)}
								</p>
							</div>
							<div className='flex items-center gap-4'>
								<MoodScale
									value={moods[selectedKey]}
									onChange={changeMood}
								/>
								<button
									type='button'
									onClick={enterFocus}
									title='Только писать (выход — Esc)'
									aria-label='Режим «только писать»'
									className='grid h-9 w-9 place-items-center border border-border text-subtle transition-colors hover:text-fg'
								>
									<Maximize2 size={15} />
								</button>
							</div>
						</div>

						{yearAgoText && (
							<button
								type='button'
								onClick={() => openKey(yearAgoKey)}
								className='mb-5 flex w-full items-start gap-3 border-l-2 border-primary/60 bg-white/[0.02] px-4 py-3 text-left transition-colors hover:bg-white/[0.04]'
							>
								<History
									size={15}
									className='mt-0.5 shrink-0 text-primary'
								/>
								<span className='min-w-0'>
									<span className='eyebrow'>
										Год назад · {format(subYears(selected, 1), 'd MMMM yyyy', { locale: ru })}
									</span>
									<span className='mt-1 line-clamp-2 block text-sm text-muted'>
										{toExcerpt(yearAgoText) ? (
											<MathExcerpt text={toExcerpt(yearAgoText)} />
										) : (
											'Запись без текста'
										)}
									</span>
								</span>
							</button>
						)}

						{!isFocus && (
							<RichEditor
								value={draft}
								uploadContext={{ type: 'thought', date: selectedKey }}
								onChange={setDraft}
								onSubmitShortcut={() => isDirty && save(selectedKey, draft, false)}
								placeholder={placeholder}
								className='flex-1 bg-surface'
								contentClassName='min-h-[380px] xl:min-h-[460px]'
							/>
						)}
					</section>
				) : (
					<section className='min-w-0'>
						{feed.length === 0 ? (
							<div className='border border-border bg-surface px-6 py-16 text-center'>
								<p className='text-sm text-muted'>
									В {format(month, 'LLLL', { locale: ru })} записей пока нет
								</p>
							</div>
						) : (
							<div className='space-y-4'>
								{feed.map(key => {
									const date = new Date(`${key}T12:00:00`)
									const mood = moods[key]
									return (
										<article
											key={key}
											className='border border-border bg-surface p-5 sm:p-7'
										>
											<header className='mb-4 flex items-center justify-between gap-3 border-b border-border pb-3'>
												<button
													type='button'
													onClick={() => openDay(date)}
													className='text-left text-base font-semibold capitalize text-fg transition-colors hover:text-primary'
												>
													{format(date, 'EEEE, d MMMM', { locale: ru })}
												</button>
												{mood && (
													<span
														className='flex items-center gap-2 text-xs'
														style={{ color: moodColor(mood) }}
													>
														<span
															className='h-1.5 w-4'
															style={{ backgroundColor: moodColor(mood) }}
														/>
														{mood} из 5
													</span>
												)}
											</header>
											<RichEditor
												value={entries[key]}
												onChange={() => {}}
												editable={false}
												contentClassName='library-reading'
											/>
										</article>
									)
								})}
							</div>
						)}
					</section>
				)}
			</div>

			{/* Только писать: весь экран, ничего лишнего */}
			{/* В body, а не внутри <main>: иначе сайдбар перекрывает окно */}
			{isFocus &&
				createPortal(
				<div className='fixed inset-0 z-[120] flex animate-fade-in flex-col overflow-y-auto overscroll-contain bg-bg'>
					<header className='sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-border bg-bg px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-10'>
						<p className='eyebrow capitalize'>{format(selected, 'EEEE, d MMMM', { locale: ru })}</p>
						<div className='flex items-center gap-4'>
							<span className='hidden font-mono text-2xs uppercase tracking-wider text-subtle sm:inline'>
								{status}
							</span>
							<button
								type='button'
								onClick={exitFocus}
								className='flex h-9 items-center gap-2 border border-border px-3 text-sm text-muted transition-colors hover:text-fg'
							>
								<Minimize2 size={14} />
								Выйти · Esc
							</button>
						</div>
					</header>
					<div className='w-full flex-1 px-5 pb-24 pt-6 sm:px-10 sm:pt-10 lg:px-16'>
						<div className='mb-8'>
							<MoodScale
								value={moods[selectedKey]}
								onChange={changeMood}
								size='lg'
							/>
						</div>
						<RichEditor
							value={draft}
							uploadContext={{ type: 'thought', date: selectedKey }}
							onChange={setDraft}
							autoFocus
							placeholder={placeholder}
							className='bg-bg [&_[role=toolbar]]:top-[4.25rem]'
							contentClassName='library-reading min-h-[60vh]'
						/>
					</div>
				</div>,
				document.body
			)}
		</div>
	)
}
