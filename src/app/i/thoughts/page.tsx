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
import { BookOpen, Check, ChevronLeft, ChevronRight } from 'lucide-react'
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
	const selectedHasEntry = Boolean(entries[selectedKey]?.trim())

	return (
		<div className='max-w-5xl pb-8'>
			<div className='flex items-start gap-3 border-b border-white/10 pb-5'>
				<div>
					<h1 className='text-2xl font-semibold text-white'>
						Мысли на каждый день
					</h1>
					<p className='mt-1 text-sm text-white/50'>
						Записывайте события, идеи и то, что хочется запомнить.
					</p>
				</div>
			</div>
			<div className='mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_1.2fr]'>
				<section className='border border-white/10 bg-[#141516] p-4 sm:p-5'>
					<div className='mb-5 flex items-center justify-between'>
						<button
							className='p-2 text-white/60 hover:text-white transition-colors'
							aria-label='Предыдущий месяц'
							onClick={() => changeMonth(-1)}
						>
							<ChevronLeft size={18} />
						</button>
						<h2 className='font-medium capitalize text-white'>
							{format(month, 'LLLL yyyy', { locale: ru })}
						</h2>
						<button
							className='p-2 text-white/60 hover:text-white transition-colors'
							aria-label='Следующий месяц'
							onClick={() => changeMonth(1)}
						>
							<ChevronRight size={18} />
						</button>
					</div>
					<div className='grid grid-cols-7 gap-px bg-white/10 text-center'>
						{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
							<div
								key={day}
								className='bg-[#141516] py-2 text-xs text-white/40'
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
									aria-label={`${format(day, 'd MMMM yyyy', { locale: ru })}${isToday ? ', сегодня' : ''}`}
									className={`group relative flex aspect-square flex-col items-center justify-center bg-[#141516] text-sm transition-colors hover:bg-white/[0.06] ${!isCurrentMonth ? 'text-white/20' : 'text-white/80'} ${isSelected ? 'bg-primary/20 text-white outline outline-1 -outline-offset-1 outline-primary font-medium shadow-sm' : ''}`}
								>
									<span
										className={`leading-none ${isToday && !isSelected ? 'font-semibold text-emerald-300' : ''}`}
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
													className='block h-2 w-2 shrink-0 rounded-full bg-emerald-400'
												/>
											)}
											{hasEntry && (
												<span
													title='Есть мысль'
													className='block h-2 w-2 shrink-0 rounded-full bg-amber-400'
												/>
											)}
										</span>
									)}
								</button>
							)
						})}
					</div>
					<div className='mt-3.5 flex flex-wrap items-center justify-between gap-2 text-xs text-white/50'>
						<div className='flex items-center gap-3.5'>
							<span className='flex items-center gap-1.5'>
								<span className='block h-2 w-2 shrink-0 rounded-full bg-emerald-400' />
								Сегодня
							</span>
							<span className='flex items-center gap-1.5'>
								<span className='block h-2 w-2 shrink-0 rounded-full bg-amber-400' />
								Есть мысль
							</span>
						</div>
						{loading && <span className='text-white/40'>Загружаем записи…</span>}
					</div>
				</section>

				<section className='flex min-h-[420px] flex-col bg-[#141516] p-4 sm:p-5 border border-white/10'>
					<div className='mb-4 border-b border-white/10 pb-3'>
						<label
							htmlFor='daily-thought'
							className='text-sm font-medium capitalize text-white/90'
						>
							{format(selected, 'EEEE, d MMMM yyyy', { locale: ru })}
						</label>
					</div>

					<textarea
						id='daily-thought'
						value={draft}
						onChange={event => setDraft(event.target.value)}
						maxLength={70000}
						placeholder='Запишите, как прошёл день, что запомнилось или о чём хочется подумать…'
						className='min-h-[300px] flex-1 resize-y border-0 bg-transparent p-0 text-sm leading-7 text-white outline-none placeholder:text-white/30 focus:ring-0'
					/>

					<div className='mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-3'>
						<span className='text-xs text-white/40'>
							{draft.length.toLocaleString('ru-RU')} из 70 000 знаков
						</span>
						<button
							onClick={save}
							disabled={saving || (entries[iso(selected)] || '') === draft}
							className='border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-white transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40'
						>
							{saving ? 'Сохраняем…' : 'Сохранить запись'}
						</button>
					</div>
				</section>
			</div>
		</div>
	)
}
