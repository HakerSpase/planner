'use client'

import cn from 'clsx'
import { Bell, Clock, Plus, Repeat, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { type TypePushState, getPushState } from '@/lib/push'

/*
 * Время события и напоминания, как в Google Календаре: несколько «за N минут»,
 * своё значение и серия — «начать за час и напомнить 4 раза».
 */

const PRESETS: [number, string][] = [
	[0, 'В момент'],
	[5, '5 мин'],
	[10, '10 мин'],
	[15, '15 мин'],
	[30, '30 мин'],
	[60, '1 ч'],
	[120, '2 ч'],
	[1440, '1 день']
]

const UNITS: [number, string][] = [
	[1, 'мин'],
	[60, 'ч'],
	[1440, 'дн']
]

const QUICK_TIMES = ['09:00', '12:00', '15:00', '18:00', '21:00']
const HOURS_LIST = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES_STEP_LIST = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

export function formatOffset(minutes: number) {
	if (minutes === 0) return 'В момент'
	if (minutes % 1440 === 0) return `За ${minutes / 1440} дн`
	if (minutes % 60 === 0) return `За ${minutes / 60} ч`
	if (minutes > 60) return `За ${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
	return `За ${minutes} мин`
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Время события в формате «ЧЧ:ММ» по часам устройства */
export const timeOf = (dueAt?: string | null) => {
	if (!dueAt) return ''
	const date = new Date(dueAt)
	return Number.isNaN(date.getTime()) ? '' : `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Собрать момент события из дня задачи и времени */
export function combineDateTime(day: string | null | undefined, time: string) {
	const base = day ? new Date(day) : new Date()
	const [hours, minutes] = time.split(':').map(Number)
	const date = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0)
	return date.toISOString()
}

export function TaskReminders({
	day,
	dueAt,
	reminders,
	onChange
}: {
	day?: string | null
	dueAt?: string | null
	reminders?: number[] | null
	onChange: (patch: { dueAt?: string | null; reminders?: number[] | null }) => void
}) {
	const time = timeOf(dueAt)
	const list = reminders || []
	const [customValue, setCustomValue] = useState('20')
	const [customUnit, setCustomUnit] = useState(1)
	const [seriesOpen, setSeriesOpen] = useState(false)
	const [seriesStart, setSeriesStart] = useState('60')
	const [seriesCount, setSeriesCount] = useState('4')
	const [push, setPush] = useState<TypePushState | null>(null)

	const [pickerOpen, setPickerOpen] = useState(false)
	const [hoursText, setHoursText] = useState('')
	const [minutesText, setMinutesText] = useState('')
	const pickerRef = useRef<HTMLDivElement>(null)
	const hoursInputRef = useRef<HTMLInputElement>(null)
	const minutesInputRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		const [h = '', m = ''] = (time || '').split(':')
		setHoursText(h)
		setMinutesText(m)
	}, [time])

	useEffect(() => {
		if (!pickerOpen) return
		const onDown = (event: PointerEvent) => {
			if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false)
		}
		document.addEventListener('pointerdown', onDown)
		return () => document.removeEventListener('pointerdown', onDown)
	}, [pickerOpen])

	useEffect(() => {
		getPushState().then(setPush).catch(() => setPush('unsupported'))
	}, [])

	const applyTime = (nextHours: number, nextMinutes: number) => {
		const clampedH = Math.max(0, Math.min(23, nextHours))
		const clampedM = Math.max(0, Math.min(59, nextMinutes))
		const formatted = `${pad(clampedH)}:${pad(clampedM)}`
		setHoursText(pad(clampedH))
		setMinutesText(pad(clampedM))
		onChange({
			dueAt: combineDateTime(day, formatted),
			// Первое время — «в момент» и «за 15 минут»; при смене времени
			// «в момент» есть всегда, чтобы уведомление пришло ко времени события
			reminders: !list.length ? [15, 0] : list.includes(0) ? list : [...list, 0]
		})
	}

	const currentHoursNum = () => {
		const parsed = parseInt(hoursText || time.split(':')[0] || '9', 10)
		return Number.isFinite(parsed) ? Math.max(0, Math.min(23, parsed)) : 9
	}

	const currentMinutesNum = () => {
		const parsed = parseInt(minutesText || time.split(':')[1] || '0', 10)
		return Number.isFinite(parsed) ? Math.max(0, Math.min(59, parsed)) : 0
	}

	const setList = (next: number[]) =>
		onChange({ reminders: next.length ? Array.from(new Set(next)).sort((a, b) => b - a) : null })

	const toggle = (minutes: number) =>
		setList(list.includes(minutes) ? list.filter(item => item !== minutes) : [...list, minutes])

	const seriesOffsets = (() => {
		const start = Math.max(1, Math.min(7 * 1440, Number(seriesStart) || 0))
		const count = Math.max(2, Math.min(20, Number(seriesCount) || 0))
		return Array.from({ length: count }, (_, index) => Math.round(start - (start * index) / (count - 1)))
	})()

	const dueDate = dueAt ? new Date(dueAt) : null
	const isPast = dueDate ? dueDate.getTime() < Date.now() : false

	return (
		<section className='border-b border-border px-5 py-5'>
			<div className='mb-3 flex items-center justify-between'>
				<h3 className='eyebrow'>Время и напоминания</h3>
				{time && (
					<button
						type='button'
						onClick={() => {
							setPickerOpen(false)
							onChange({ dueAt: null, reminders: null })
						}}
						className='text-xs text-subtle transition-colors hover:text-danger'
					>
						Убрать время
					</button>
				)}
			</div>

			<div className='flex flex-wrap items-center gap-3'>
				<div
					ref={pickerRef}
					className='relative'
				>
					<div
						onClick={event => {
							setPickerOpen(true)
							if (event.target === event.currentTarget) {
								hoursInputRef.current?.focus()
								hoursInputRef.current?.select()
							}
						}}
						className={cn(
							'flex h-10 items-center gap-1 border bg-surface-2 px-3 transition-colors',
							pickerOpen ? 'border-primary/70' : 'border-border focus-within:border-primary/70'
						)}
					>
						<Clock
							size={15}
							className='mr-1 shrink-0 text-subtle'
						/>
						<input
							ref={hoursInputRef}
							type='text'
							inputMode='numeric'
							aria-label='Часы'
							placeholder='--'
							value={hoursText}
							onFocus={event => {
								setPickerOpen(true)
								event.currentTarget.select()
							}}
							onChange={event => {
								const raw = event.target.value.replace(/\D/g, '').slice(0, 2)
								setHoursText(raw)
								if (!raw) return
								const num = parseInt(raw, 10)
								if (raw.length === 2 || num > 2) {
									const validH = Math.min(23, num)
									applyTime(validH, currentMinutesNum())
									minutesInputRef.current?.focus()
									minutesInputRef.current?.select()
								}
							}}
							onBlur={() => {
								if (!hoursText && !time) return
								applyTime(currentHoursNum(), currentMinutesNum())
							}}
							onKeyDown={event => {
								if (event.key === ':' || event.key === 'ArrowRight') {
									event.preventDefault()
									applyTime(currentHoursNum(), currentMinutesNum())
									minutesInputRef.current?.focus()
									minutesInputRef.current?.select()
								} else if (event.key === 'ArrowUp') {
									event.preventDefault()
									applyTime((currentHoursNum() + 1) % 24, currentMinutesNum())
								} else if (event.key === 'ArrowDown') {
									event.preventDefault()
									applyTime((currentHoursNum() + 23) % 24, currentMinutesNum())
								} else if (event.key === 'Enter' || event.key === 'Escape') {
									event.preventDefault()
									applyTime(currentHoursNum(), currentMinutesNum())
									setPickerOpen(false)
									event.currentTarget.blur()
								}
							}}
							className='w-7 bg-transparent text-center font-mono text-base text-fg outline-none placeholder:text-subtle'
						/>
						<span className='font-mono text-base text-subtle'>:</span>
						<input
							ref={minutesInputRef}
							type='text'
							inputMode='numeric'
							aria-label='Минуты'
							placeholder='--'
							value={minutesText}
							onFocus={event => {
								setPickerOpen(true)
								event.currentTarget.select()
							}}
							onChange={event => {
								const raw = event.target.value.replace(/\D/g, '').slice(0, 2)
								setMinutesText(raw)
								if (!raw) return
								const num = parseInt(raw, 10)
								if (raw.length === 2 || num > 5) {
									const validM = Math.min(59, num)
									applyTime(currentHoursNum(), validM)
								}
							}}
							onBlur={() => {
								if (!minutesText && !time) return
								applyTime(currentHoursNum(), currentMinutesNum())
							}}
							onKeyDown={event => {
								if (
									(event.key === 'Backspace' && !minutesText) ||
									(event.key === 'ArrowLeft' && event.currentTarget.selectionStart === 0)
								) {
									event.preventDefault()
									hoursInputRef.current?.focus()
									hoursInputRef.current?.select()
								} else if (event.key === 'ArrowUp') {
									event.preventDefault()
									applyTime(currentHoursNum(), (currentMinutesNum() + 1) % 60)
								} else if (event.key === 'ArrowDown') {
									event.preventDefault()
									applyTime(currentHoursNum(), (currentMinutesNum() + 59) % 60)
								} else if (event.key === 'Enter' || event.key === 'Escape') {
									event.preventDefault()
									applyTime(currentHoursNum(), currentMinutesNum())
									setPickerOpen(false)
									event.currentTarget.blur()
								}
							}}
							className='w-7 bg-transparent text-center font-mono text-base text-fg outline-none placeholder:text-subtle'
						/>
					</div>

					{pickerOpen && (
						<div className='absolute left-0 top-full z-40 mt-1.5 w-64 animate-pop-in border border-border bg-elevated p-2.5 shadow-pop'>
							<div className='mb-2 flex flex-wrap gap-1 border-b border-border pb-2'>
								{QUICK_TIMES.map(preset => (
									<button
										key={preset}
										type='button'
										onClick={() => {
											const [h, m] = preset.split(':').map(Number)
											applyTime(h, m)
											setPickerOpen(false)
										}}
										className={cn(
											'h-7 flex-1 border font-mono text-xs transition-colors',
											time === preset
												? 'border-primary bg-primary/20 text-fg'
												: 'border-border bg-surface text-muted hover:text-fg'
										)}
									>
										{preset}
									</button>
								))}
							</div>
							<div className='grid grid-cols-2 gap-2'>
								<div>
									<p className='mb-1 px-1 font-mono text-2xs uppercase tracking-wider text-subtle'>
										Часы
									</p>
									<div className='grid max-h-44 grid-cols-3 gap-0.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
										{HOURS_LIST.map(h => {
											const active = time && pad(currentHoursNum()) === h
											return (
												<button
													key={h}
													type='button'
													onClick={() => applyTime(Number(h), currentMinutesNum())}
													className={cn(
														'h-7 font-mono text-xs transition-colors',
														active
															? 'bg-primary text-white'
															: 'text-muted hover:bg-white/[0.06] hover:text-fg'
													)}
												>
													{h}
												</button>
											)
										})}
									</div>
								</div>
								<div>
									<p className='mb-1 px-1 font-mono text-2xs uppercase tracking-wider text-subtle'>
										Минуты
									</p>
									<div className='grid max-h-44 grid-cols-3 gap-0.5 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
										{MINUTES_STEP_LIST.map(m => {
											const active = time && pad(currentMinutesNum()) === m
											return (
												<button
													key={m}
													type='button'
													onClick={() => {
														applyTime(currentHoursNum(), Number(m))
														setPickerOpen(false)
													}}
													className={cn(
														'h-7 font-mono text-xs transition-colors',
														active
															? 'bg-primary text-white'
															: 'text-muted hover:bg-white/[0.06] hover:text-fg'
													)}
												>
													{m}
												</button>
											)
										})}
									</div>
								</div>
							</div>
						</div>
					)}
				</div>
				{dueDate && (
					<span className={cn('text-sm', isPast ? 'text-danger' : 'text-muted')}>
						{dueDate.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' })}
						{isPast && ' · уже прошло'}
					</span>
				)}
			</div>
			{!day && time && (
				<p className='mt-2 text-xs text-subtle'>У задачи нет даты — время отнесено к сегодняшнему дню.</p>
			)}

			{time && (
				<>
					<p className='mb-2 mt-5 flex items-center gap-2 text-xs text-muted'>
						<Bell size={13} />
						Напомнить
					</p>
					<div className='flex flex-wrap gap-1.5'>
						{PRESETS.map(([minutes, label]) => (
							<button
								key={minutes}
								type='button'
								aria-pressed={list.includes(minutes)}
								onClick={() => toggle(minutes)}
								className={cn(
									'h-8 border px-3 text-sm transition-colors',
									list.includes(minutes)
										? 'border-primary bg-primary/15 text-fg'
										: 'border-border text-muted hover:text-fg'
								)}
							>
								{label}
							</button>
						))}
					</div>

					{/* Свои значения, которых нет среди готовых */}
					{list.some(minutes => !PRESETS.some(([preset]) => preset === minutes)) && (
						<div className='mt-2 flex flex-wrap gap-1.5'>
							{list
								.filter(minutes => !PRESETS.some(([preset]) => preset === minutes))
								.map(minutes => (
									<span
										key={minutes}
										className='flex h-8 items-center gap-1 border border-primary bg-primary/15 pl-3 pr-1 text-sm text-fg'
									>
										{formatOffset(minutes)}
										<button
											type='button'
											aria-label='Убрать напоминание'
											onClick={() => toggle(minutes)}
											className='grid h-6 w-6 place-items-center text-subtle hover:text-fg'
										>
											<X size={13} />
										</button>
									</span>
								))}
						</div>
					)}

					<div className='mt-3 flex flex-wrap items-center gap-2'>
						<span className='text-xs text-subtle'>Своё:</span>
						<input
							type='number'
							inputMode='numeric'
							min={1}
							value={customValue}
							onChange={event => setCustomValue(event.target.value)}
							className='h-8 w-16 border border-border bg-surface-2 px-2 text-center font-mono text-sm text-fg outline-none focus:border-primary/70'
						/>
						<div
							role='group'
							aria-label='Единица времени'
							className='flex h-8 divide-x divide-border border border-border bg-surface-2'
						>
							{UNITS.map(([value, label]) => (
								<button
									key={value}
									type='button'
									onClick={() => setCustomUnit(value)}
									className={cn(
										'px-2.5 text-xs transition-colors',
										customUnit === value ? 'bg-primary/20 text-fg' : 'text-muted hover:text-fg'
									)}
								>
									{label}
								</button>
							))}
						</div>
						<button
							type='button'
							onClick={() => {
								const minutes = Math.round((Number(customValue) || 0) * customUnit)
								if (minutes > 0 && minutes <= 7 * 1440) setList([...list, minutes])
							}}
							className='flex h-8 items-center gap-1 border border-border px-2.5 text-sm text-muted transition-colors hover:text-fg'
						>
							<Plus size={13} />
							Добавить
						</button>
						<button
							type='button'
							aria-expanded={seriesOpen}
							onClick={() => setSeriesOpen(value => !value)}
							className={cn(
								'flex h-8 items-center gap-1.5 border px-2.5 text-sm transition-colors',
								seriesOpen ? 'border-primary/60 text-fg' : 'border-border text-muted hover:text-fg'
							)}
						>
							<Repeat size={13} />
							Серия
						</button>
					</div>

					{seriesOpen && (
						<div className='mt-3 border border-border bg-bg p-3'>
							<div className='flex flex-wrap items-center gap-2 text-sm text-muted'>
								Начать за
								<input
									type='number'
									inputMode='numeric'
									min={1}
									value={seriesStart}
									onChange={event => setSeriesStart(event.target.value)}
									className='h-8 w-16 border border-border bg-surface-2 px-2 text-center font-mono text-fg outline-none focus:border-primary/70'
								/>
								мин и напомнить
								<input
									type='number'
									inputMode='numeric'
									min={2}
									max={20}
									value={seriesCount}
									onChange={event => setSeriesCount(event.target.value)}
									className='h-8 w-14 border border-border bg-surface-2 px-2 text-center font-mono text-fg outline-none focus:border-primary/70'
								/>
								раз
							</div>
							<p className='mt-2 text-xs leading-5 text-subtle'>
								{seriesOffsets.map(formatOffset).join(' · ')}
							</p>
							<button
								type='button'
								onClick={() => {
									setList(seriesOffsets)
									setSeriesOpen(false)
								}}
								className='mt-2 h-8 bg-primary px-3 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
							>
								Поставить серию
							</button>
						</div>
					)}

					{(() => {
						// Напоминания, время которых уже прошло, не придут — честно говорим об этом
						const passed = dueDate && !isPast
							? list.filter(minutes => minutes > 0 && dueDate.getTime() - minutes * 60_000 < Date.now())
							: []
						return passed.length ? (
							<p className='mt-3 text-xs leading-5 text-muted'>
								{passed.map(formatOffset).join(', ')} — уже прошло, это напоминание не придёт.
								{!list.includes(0) && ' Добавьте «В момент», чтобы получить уведомление ко времени.'}
							</p>
						) : null
					})()}

					{list.length > 0 && push && push !== 'on' && (
						<p className='mt-3 text-xs leading-5 text-warning'>
							На этом устройстве уведомления не включены.{' '}
							<Link
								href='/i/settings'
								className='underline underline-offset-2'
							>
								Включить в настройках
							</Link>
						</p>
					)}
				</>
			)}
		</section>
	)
}
