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
	BookOpen,
	Calendar as CalendarIcon,
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileText,
	Loader2,
	Sparkles
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

	const goToToday = () => {
		const today = currentDate()
		setMonth(today)
		setSelected(today)
		hasUserSelectedRef.current = true
	}

	const selectedKey = iso(selected)
	const selectedSavedContent = entries[selectedKey] || ''
	const isDirty = selectedSavedContent !== draft
	const wordsCount = draft.trim() ? draft.trim().split(/\s+/).length : 0
	const readingTimeMinutes = Math.max(1, Math.ceil(wordsCount / 180))

	const isTodaySelected = isSameDay(selected, currentDate())

	// Filter and sort entries for the current month feed
	const monthEntries = useMemo(() => {
		const monthPrefix = format(month, 'yyyy-MM')
		return Object.entries(entries)
			.filter(
				([dateKey, content]) =>
					dateKey.startsWith(monthPrefix) && Boolean(content?.trim())
			)
			.sort((a, b) => b[0].localeCompare(a[0]))
	}, [entries, month])

	return (
		<div className='w-full min-w-0 max-w-[1550px] pb-12'>
			{/* Page Header */}
			<div className='flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5'>
				<div>
					<h1 className='text-2xl sm:text-3xl font-semibold text-white tracking-tight flex items-center gap-3'>
						<BookOpen className='text-primary shrink-0' size={28} />
						Мысли на каждый день
					</h1>
					<p className='mt-1 text-sm text-white/50 max-w-2xl'>
						Ваш личный дневник для заметок, идей, рефлексии и событий. Все записи привязаны к датам и сохраняются в облаке.
					</p>
				</div>

				<div className='flex items-center gap-2.5'>
					<button
						type='button'
						onClick={goToToday}
						className={`flex items-center gap-2 border px-3.5 py-1.5 text-xs font-medium transition-colors ${
							isTodaySelected
								? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
								: 'border-white/15 bg-white/[0.03] text-white/70 hover:bg-white/[0.08] hover:text-white'
						}`}
					>
						<CalendarIcon size={14} />
						Сегодня
					</button>

					<div className='hidden sm:flex items-center gap-1.5 border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs text-white/50'>
						<FileText size={13} className='text-amber-400' />
						<span>{monthEntries.length} {monthEntries.length === 1 ? 'запись' : monthEntries.length >= 2 && monthEntries.length <= 4 ? 'записи' : 'записей'} за {format(month, 'LLLL', { locale: ru })}</span>
					</div>
				</div>
			</div>

			{/* Main Content Grid: Balanced wide PC proportions */}
			<div className='mt-6 grid gap-6 lg:grid-cols-[380px_1fr] xl:grid-cols-[420px_1fr] items-start'>
				{/* Left Sidebar: Calendar & Monthly Entries Feed */}
				<div className='flex flex-col gap-6 min-w-0'>
					{/* Calendar Card */}
					<section className='border border-white/10 bg-[#141516] p-4 sm:p-5 shadow-lg'>
						<div className='mb-4 flex items-center justify-between'>
							<button
								className='p-2 text-white/60 hover:text-white transition-colors rounded-sm hover:bg-white/[0.06]'
								aria-label='Предыдущий месяц'
								onClick={() => changeMonth(-1)}
							>
								<ChevronLeft size={18} />
							</button>

							<h2 className='font-semibold text-base capitalize text-white tracking-wide'>
								{format(month, 'LLLL yyyy', { locale: ru })}
							</h2>

							<button
								className='p-2 text-white/60 hover:text-white transition-colors rounded-sm hover:bg-white/[0.06]'
								aria-label='Следующий месяц'
								onClick={() => changeMonth(1)}
							>
								<ChevronRight size={18} />
							</button>
						</div>

						{/* Day of Week Headers */}
						<div className='grid grid-cols-7 gap-px bg-white/10 text-center mb-1'>
							{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
								<div
									key={day}
									className='bg-[#141516] py-2 text-xs font-medium text-white/40'
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
										className={`group relative flex aspect-square flex-col items-center justify-center bg-[#141516] text-sm transition-all hover:bg-white/[0.06] ${
											!isCurrentMonth ? 'text-white/20' : 'text-white/80'
										} ${
											isSelected
												? 'bg-primary/20 text-white outline outline-1 -outline-offset-1 outline-primary font-semibold shadow-sm'
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
														className='block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 ring-2 ring-[#141516]'
													/>
												)}
												{hasEntry && (
													<span
														title='Есть мысль'
														className='block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 ring-2 ring-[#141516]'
													/>
												)}
											</span>
										)}
									</button>
								)
							})}
						</div>

						{/* Legend */}
						<div className='mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs text-white/50'>
							<div className='flex items-center gap-4'>
								<span className='flex items-center gap-1.5'>
									<span className='block h-2 w-2 shrink-0 rounded-full bg-emerald-400' />
									Сегодня
								</span>
								<span className='flex items-center gap-1.5'>
									<span className='block h-2 w-2 shrink-0 rounded-full bg-amber-400' />
									Есть запись
								</span>
							</div>
							{loading && (
								<span className='text-white/40 text-[11px] animate-pulse'>
									Загружаем…
								</span>
							)}
						</div>
					</section>

					{/* Feed of Month's Entries */}
					<section className='border border-white/10 bg-[#141516] p-4 sm:p-5 shadow-lg flex flex-col'>
						<div className='mb-3 flex items-center justify-between border-b border-white/[0.08] pb-3'>
							<h3 className='text-sm font-semibold text-white/90 flex items-center gap-2'>
								<FileText size={15} className='text-primary' />
								Записи месяца ({monthEntries.length})
							</h3>
							<span className='text-[11px] text-white/40 capitalize'>
								{format(month, 'LLLL', { locale: ru })}
							</span>
						</div>

						{monthEntries.length === 0 ? (
							<div className='py-8 text-center px-3'>
								<Sparkles size={20} className='mx-auto text-white/20 mb-2' />
								<p className='text-xs text-white/50 font-medium'>
									В этом месяце пока нет записей
								</p>
								<p className='text-[11px] text-white/35 mt-1 leading-relaxed'>
									Выберите любой день в календаре выше и начните писать свои мысли.
								</p>
							</div>
						) : (
							<div className='max-h-[360px] overflow-y-auto space-y-2 pr-1'>
								{monthEntries.map(([dateKey, text]) => {
									const [y, m, d] = dateKey.split('-').map(Number)
									const entryDate = new Date(y, m - 1, d)
									const isEntrySelected = dateKey === selectedKey

									return (
										<button
											key={dateKey}
											type='button'
											onClick={() => {
												setSelected(entryDate)
												hasUserSelectedRef.current = true
											}}
											className={`w-full text-left p-2.5 transition-all border ${
												isEntrySelected
													? 'bg-primary/10 border-primary/50 text-white'
													: 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/15 text-white/80'
											}`}
										>
											<div className='flex items-center justify-between gap-2 mb-1'>
												<span className='text-xs font-semibold text-white capitalize'>
													{format(entryDate, 'd MMMM, EEE', { locale: ru })}
												</span>
												<span className='text-[10px] font-mono text-white/40'>
													{text.length} зн.
												</span>
											</div>
											<p className='text-xs text-white/50 line-clamp-2 leading-relaxed'>
												{text}
											</p>
										</button>
									)
								})}
							</div>
						)}
					</section>
				</div>

				{/* Right Column: Spacious Journal Studio Editor */}
				<section className='flex min-h-[580px] xl:min-h-[660px] flex-col bg-[#141516] p-5 sm:p-7 border border-white/10 shadow-xl'>
					{/* Editor Header */}
					<div className='mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4'>
						<div className='min-w-0'>
							<div className='flex items-center gap-2.5'>
								<h2 className='text-lg sm:text-xl font-semibold capitalize text-white'>
									{format(selected, 'EEEE, d MMMM yyyy', { locale: ru })}
								</h2>
								{isTodaySelected && (
									<span className='border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300'>
										Сегодня
									</span>
								)}
							</div>
							<p className='mt-0.5 text-xs text-white/40 flex items-center gap-3'>
								<span>{wordsCount} {wordsCount === 1 ? 'слово' : wordsCount >= 2 && wordsCount <= 4 ? 'слова' : 'слов'}</span>
								<span>•</span>
								<span className='flex items-center gap-1'>
									<Clock size={12} />
									~{readingTimeMinutes} мин чтения
								</span>
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
									<span className='block h-1.5 w-1.5 rounded-full bg-amber-400' />
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
						className='min-h-[380px] xl:min-h-[460px] flex-1 resize-y border-0 bg-transparent p-0 text-base leading-8 text-white/90 outline-none placeholder:text-white/25 focus:ring-0 selection:bg-primary/30 font-normal tracking-wide'
					/>

					{/* Editor Footer Toolbar */}
					<div className='mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] pt-4'>
						<div className='flex items-center gap-3 text-xs text-white/40 font-mono'>
							<span>
								{draft.length.toLocaleString('ru-RU')} / 70 000 знаков
							</span>
							<span className='hidden sm:inline text-white/20'>|</span>
							<span className='hidden sm:inline text-white/35 font-sans text-[11px]'>
								Нажмите <kbd className='px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60'>Ctrl</kbd> + <kbd className='px-1.5 py-0.5 bg-white/10 rounded text-[10px] text-white/60'>Enter</kbd> для сохранения
							</span>
						</div>

						<button
							onClick={save}
							disabled={saving || !isDirty}
							className='flex items-center gap-2 border border-primary/50 bg-primary/20 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 shadow-sm'
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
