'use client'

import dynamic from 'next/dynamic'
import {
	addMonths,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	format,
	isSameDay,
	isSameMonth,
	startOfMonth,
	startOfWeek
} from 'date-fns'
import { ru } from 'date-fns/locale'
import {
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	Loader2,
	Search
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useProfile } from '@/hooks/useProfile'
import { dateKeyInTimeZone } from '@/lib/time-zone'

import { thoughtsService } from '@/services/thoughts.service'

// Редактор тяжёлый (Tiptap + ProseMirror) — грузим его только когда он нужен
const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{
		ssr: false,
		loading: () => <div className='min-h-[240px] animate-pulse bg-white/[0.02]' />
	}
)

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

export default function ThoughtsPage() {
	const { data: profile } = useProfile()
	const deviceTimeZone =
		Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
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
	const [draft, setDraft] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const hasUserSelectedRef = useRef(false)
	const [query, setQuery] = useState('')
	const [archive, setArchive] = useState<
		Array<{ thought_date: string; content: string }> | null
	>(null)

	const monthStart = startOfMonth(month)
	const todayKey = dateKeyInTimeZone(new Date(), timeZone)
	const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
	const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })

	const startKey = iso(gridStart)
	const endKey = iso(gridEnd)

	const days = useMemo(
		() => eachDayOfInterval({ start: gridStart, end: gridEnd }),
		[startKey, endKey]
	)

	const loadEntries = async (start: string, end: string) => {
		setLoading(true)
		try {
			const rows = await thoughtsService.getRange(start, end)
			const map: Record<string, string> = {}
			for (const row of rows || []) {
				if (row.thought_date) {
					const dateStr = row.thought_date.slice(0, 10)
					map[dateStr] = row.content || ''
				}
			}
			setEntries(map)
		} catch (err) {
			console.error(err)
			toast.error('Не удалось загрузить мысли за этот месяц')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadEntries(startKey, endKey)
	}, [startKey, endKey])

	useEffect(() => {
		if (!hasUserSelectedRef.current) {
			const today = currentDate()
			setMonth(today)
			setSelected(today)
		}
	}, [timeZone])

	// Черновик берём из сохранённого только при смене дня или после загрузки месяца.
	// Если синхронизировать на каждое изменение entries, ответ автосохранения
	// затирал бы текст, набранный, пока шёл запрос.
	useEffect(() => {
		if (loading) return
		setDraft(entries[iso(selected)] ?? '')
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selected, loading])

	const save = async (
		dateKey = iso(selected),
		content = draft,
		silent = false
	) => {
		const previousContent = entries[dateKey]
		setEntries(current => ({ ...current, [dateKey]: content }))
		setSaving(true)
		try {
			const saved = await thoughtsService.save(dateKey, content)
			const savedDate = (saved.thought_date || dateKey).slice(0, 10)
			setEntries(current => ({
				...current,
				[savedDate]: saved.content
			}))
			if (!silent) toast.success('Запись сохранена')
		} catch {
			setEntries(current => {
				const updated = { ...current }
				if (previousContent === undefined) delete updated[dateKey]
				else updated[dateKey] = previousContent
				return updated
			})
			toast.error('Не удалось сохранить запись')
		} finally {
			setSaving(false)
		}
	}

	// Перед уходом на другой день досохраняем текущий черновик
	const flushDraft = () => {
		const key = iso(selected)
		if ((entries[key] || '') !== draft) save(key, draft, true)
	}

	const selectDay = (day: Date) => {
		flushDraft()
		hasUserSelectedRef.current = true
		setSelected(day)
	}

	const changeMonth = (direction: -1 | 1) => {
		flushDraft()
		const next = addMonths(month, direction)
		setMonth(next)
		setSelected(startOfMonth(next))
		hasUserSelectedRef.current = true
	}

	const selectedKey = iso(selected)
	const selectedSavedContent = entries[selectedKey] || ''
	const isDirty = selectedSavedContent !== draft
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
			.map(row => ({
				date: row.thought_date.slice(0, 10),
				// свежая версия текущего месяца важнее архивной
				content: entries[row.thought_date.slice(0, 10)] ?? row.content
			}))
			.filter(row => row.content.toLowerCase().includes(needle))
			.reverse()
			.slice(0, 20)
			.map(row => {
				const plain = row.content.replace(/[#>*_`~[]()!-]/g, '').replace(/s+/g, ' ')
				const index = plain.toLowerCase().indexOf(needle)
				const from = Math.max(0, index - 40)
				return {
					date: row.date,
					snippet: (from ? '…' : '') + plain.slice(from, from + 120)
				}
			})
	}, [query, archive, entries])

	const openDate = (key: string) => {
		const [year, monthIndex, day] = key.split('-').map(Number)
		const date = new Date(year, monthIndex - 1, day)
		flushDraft()
		hasUserSelectedRef.current = true
		setMonth(date)
		setSelected(date)
		setQuery('')
	}

	// Автосохранение через 1,5 с после последней правки
	useEffect(() => {
		if (!isDirty || saving || loading) return
		const timer = setTimeout(() => save(selectedKey, draft, true), 1500)
		return () => clearTimeout(timer)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [draft, isDirty, saving, loading, selectedKey])

	const wordsCount = draft.trim() ? draft.trim().split(/\s+/).length : 0
	const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 180))

	return (
		<div className='w-full min-w-0 pb-12'>
			{/* Page Header */}
			<div className='mb-6 border-b border-border pb-5 sm:mb-8 sm:pb-6'>
				<h1 className='text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-4xl'>
					Мысли на каждый день
				</h1>
				<p className='mt-1 text-sm text-subtle max-w-2xl'>
					Ваш личный дневник для заметок, идей, рефлексии и событий. Все записи привязаны к датам и сохраняются в облаке.
				</p>
			</div>

			{/* Main Content Grid: Balanced wide PC proportions */}
			<div className='grid items-start gap-4 lg:grid-cols-[340px_1fr] lg:gap-6 xl:grid-cols-[360px_1fr]'>
				{/* Left Sidebar: Calendar & Monthly Entries Feed */}
				<div className='flex flex-col gap-6 min-w-0'>
					{/* Поиск по всем записям */}
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
											onClick={() => openDate(result.date)}
											className='block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.04]'
										>
											<span className='eyebrow'>
												{format(new Date(`${result.date}T12:00:00`), 'd MMMM yyyy', { locale: ru })}
											</span>
											<span className='mt-1 line-clamp-2 block text-sm text-muted'>
												{result.snippet}
											</span>
										</button>
									))
								)}
							</div>
						)}
					</div>

					{/* Calendar Card */}
					<section className='card-padded'>
						<div className='mb-4 flex items-center justify-between'>
							<button
								className='grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
								aria-label='Предыдущий месяц'
								onClick={() => changeMonth(-1)}
							>
								<ChevronLeft size={18} />
							</button>

							<h2 className='text-sm font-semibold capitalize text-fg'>
								{format(month, 'LLLL yyyy', { locale: ru })}
							</h2>

							<button
								className='grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
								aria-label='Следующий месяц'
								onClick={() => changeMonth(1)}
							>
								<ChevronRight size={18} />
							</button>
						</div>

						{/* Day of Week Headers */}
						<div className='mb-1 grid grid-cols-7 text-center'>
							{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
								<div
									key={day}
									className='py-2 text-xs font-medium text-subtle'
								>
									{day}
								</div>
							))}
							{days.map(day => {
								const key = iso(day)
								const now = new Date()
								const isToday =
									(day.getDate() === now.getDate() &&
										day.getMonth() === now.getMonth() &&
										day.getFullYear() === now.getFullYear()) ||
									key === todayKey ||
									isSameDay(day, now)
								const hasEntry = Boolean(entries[key]?.trim())
								const isSelected = isSameDay(day, selected)
								const isCurrentMonth = isSameMonth(day, month)

								return (
									<button
										key={key}
										onClick={() => selectDay(day)}
										aria-pressed={isSelected}
										aria-label={`${format(day, 'd MMMM yyyy', { locale: ru })}${isToday ? ', сегодня' : ''}${hasEntry ? ', есть мысль' : ''}`}
										className={`group relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors hover:bg-white/[0.06] ${
											!isCurrentMonth ? 'text-subtle' : 'text-fg'
										} ${
											isSelected
												? 'bg-primary/20 text-fg outline outline-1 -outline-offset-1 outline-primary font-semibold shadow-sm'
												: ''
										}`}
									>
										<span
											className={`leading-none ${
												isToday && !isSelected
													? 'font-bold text-emerald-400'
													: ''
											}`}
										>
											{format(day, 'd')}
										</span>

										{(isToday || hasEntry) && (
											<span
												aria-hidden='true'
												className='pointer-events-none absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1.5'
											>
												{isToday && (
													<span
														title='Сегодня'
														className='block h-1.5 w-1.5 shrink-0 bg-emerald-400 ring-2 ring-surface'
													/>
												)}
												{hasEntry && (
													<span
														title='Есть мысль'
														className='block h-1.5 w-1.5 shrink-0 bg-amber-400 ring-2 ring-surface'
													/>
												)}
											</span>
										)}
									</button>
								)
							})}
						</div>

						{/* Legend */}
						<div className='mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs text-subtle'>
							<div className='flex items-center gap-4'>
								<span className='flex items-center gap-1.5'>
									<span className='block h-2 w-2 shrink-0 bg-emerald-400' />
									Сегодня
								</span>
								<span className='flex items-center gap-1.5'>
									<span className='block h-2 w-2 shrink-0 bg-warning' />
									Есть запись
								</span>
							</div>
							{loading && (
								<span className='text-subtle text-[11px] animate-pulse'>
									Загружаем…
								</span>
							)}
						</div>
					</section>
				</div>

				{/* Right Column: Spacious Journal Studio Editor */}
				<section className='card flex min-h-[580px] flex-col p-5 sm:p-7 xl:min-h-[660px]'>
					{/* Editor Header */}
					<div className='mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4'>
						<div className='min-w-0'>
							<h2 className='text-lg font-semibold capitalize text-fg sm:text-xl'>
								{format(selected, 'EEEE, d MMMM yyyy', { locale: ru })}
							</h2>
							<p className='mt-0.5 text-xs text-subtle flex items-center gap-3'>
								<span>{wordsCount} {wordsCount === 1 ? 'слово' : wordsCount >= 2 && wordsCount <= 4 ? 'слова' : 'слов'}</span>
								{wordsCount > 0 && (
									<>
										<span>•</span>
										<span className='flex items-center gap-1'>
											<Clock size={12} />
											~{readingTimeMinutes} мин чтения
										</span>
									</>
								)}
							</p>
						</div>

						{/* Saving Status Badge */}
						<div className='flex items-center gap-3'>
							{saving ? (
								<span className='flex items-center gap-1.5 text-xs text-primary animate-pulse font-medium'>
									<Loader2 size={13} className='animate-spin' />
									Сохранение…
								</span>
							) : isDirty ? (
								<span className='flex items-center gap-1.5 text-xs text-warning font-medium'>
									<span className='block h-1.5 w-1.5 bg-amber-400' />
									Не сохранено
								</span>
							) : selectedSavedContent ? (
								<span className='flex items-center gap-1 text-xs text-success'>
									<Check size={13} />
									Сохранено
								</span>
							) : null}
						</div>
					</div>

					{/* Writing Space */}
					<RichEditor
						value={draft}
						onChange={setDraft}
						onSubmitShortcut={() => {
							if (!saving && isDirty) save()
						}}
						placeholder='Как прошёл день? Markdown работает: # заголовок, - список, > цитата, [ ] чек-лист. Фото — вставьте или перетащите.'
						className='flex-1 bg-surface'
						contentClassName='min-h-[380px] xl:min-h-[460px]'
					/>

					{/* Editor Footer Toolbar */}
					<div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4'>
						<div className='flex items-center gap-3 text-xs text-subtle font-mono'>
							<span>
								{draft.length.toLocaleString('ru-RU')} / 70 000 знаков
							</span>
							<span className='hidden sm:inline text-subtle'>|</span>
							<span className='hidden sm:inline text-subtle font-sans text-[11px]'>
								Нажмите <kbd className='border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted'>Ctrl</kbd> + <kbd className='border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted'>Enter</kbd> для сохранения
							</span>
						</div>

						<button
							onClick={() => save()}
							disabled={saving || !isDirty}
							className='flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40'
						>
							{saving ? (
								<>
									<Loader2 size={15} className='animate-spin' />
									Сохраняем…
								</>
							) : !isDirty && selectedSavedContent ? (
								<>
									<Check size={15} />
									Сохранено
								</>
							) : (
								'Сохранить мысль'
							)}
						</button>
					</div>
				</section>
			</div>
		</div>
	)
}
