'use client'

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
	Loader2
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useProfile } from '@/hooks/useProfile'
import { dateKeyInTimeZone } from '@/lib/time-zone'

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
			const res = await fetch(
				`/api/user/thoughts?start=${start}&end=${end}`,
				{
					cache: 'no-store',
					credentials: 'include'
				}
			)
			if (!res.ok) throw new Error('Не удалось загрузить записи')
			const rows: Array<{ thought_date: string; content: string }> =
				await res.json()
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

	useEffect(() => {
		const key = iso(selected)
		setDraft(entries[key] ?? '')
	}, [selected, entries])

	const save = async () => {
		const dateKey = iso(selected)
		const previousContent = entries[dateKey]
		setEntries(current => ({ ...current, [dateKey]: draft }))
		setSaving(true)
		try {
			const res = await fetch('/api/user/thoughts', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					date: dateKey,
					content: draft
				})
			})
			if (!res.ok) throw new Error()
			const saved = await res.json()
			const savedDate = (saved.thought_date || dateKey).slice(0, 10)
			setEntries(current => ({
				...current,
				[savedDate]: saved.content
			}))
			toast.success('Запись сохранена')
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

	const changeMonth = (direction: -1 | 1) => {
		const next = addMonths(month, direction)
		setMonth(next)
		setSelected(startOfMonth(next))
		hasUserSelectedRef.current = true
	}

	const selectedKey = iso(selected)
	const selectedSavedContent = entries[selectedKey] || ''
	const isDirty = selectedSavedContent !== draft
	const wordsCount = draft.trim() ? draft.trim().split(/\s+/).length : 0
	const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 180))

	return (
		<div className='w-full min-w-0 max-w-[1550px] pb-12'>
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
										onClick={() => {
											hasUserSelectedRef.current = true
											setSelected(day)
										}}
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
									<span className='block h-2 w-2 shrink-0 bg-amber-400' />
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
								<span className='flex items-center gap-1.5 text-xs text-amber-400/90 font-medium'>
									<span className='block h-1.5 w-1.5 bg-amber-400' />
									Не сохранено
								</span>
							) : selectedSavedContent ? (
								<span className='flex items-center gap-1 text-xs text-emerald-400/80'>
									<Check size={13} />
									Сохранено
								</span>
							) : null}
						</div>
					</div>

					{/* Writing Space */}
					<textarea
						id='daily-thought'
						value={draft}
						onChange={event => setDraft(event.target.value)}
						onKeyDown={e => {
							if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
								e.preventDefault()
								if (!saving && isDirty) {
									save()
								}
							}
						}}
						maxLength={70000}
						placeholder='Запишите, как прошёл день, какие мысли возникли, что вдохновило или о чём хочется подумать… (Ctrl + Enter для сохранения)'
						className='min-h-[380px] xl:min-h-[460px] flex-1 resize-y border-0 bg-transparent p-0 text-base leading-7 text-fg outline-none placeholder:text-subtle focus:ring-0 focus-visible:ring-0'
					/>

					{/* Editor Footer Toolbar */}
					<div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4'>
						<div className='flex items-center gap-3 text-xs text-subtle font-mono'>
							<span>
								{draft.length.toLocaleString('ru-RU')} / 70 000 знаков
							</span>
							<span className='hidden sm:inline text-subtle'>|</span>
							<span className='hidden sm:inline text-subtle font-sans text-[11px]'>
								Нажмите <kbd className='px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-muted'>Ctrl</kbd> + <kbd className='px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-muted'>Enter</kbd> для сохранения
							</span>
						</div>

						<button
							onClick={save}
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
									<Check size={15} className='text-emerald-400' />
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
