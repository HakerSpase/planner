'use client'

import cn from 'clsx'
import { Bell, Clock, Plus, Repeat, X } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

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

	useEffect(() => {
		getPushState().then(setPush).catch(() => setPush('unsupported'))
	}, [])

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
						onClick={() => onChange({ dueAt: null, reminders: null })}
						className='text-xs text-subtle transition-colors hover:text-danger'
					>
						Убрать время
					</button>
				)}
			</div>

			<div className='flex flex-wrap items-center gap-3'>
				<label className='flex h-10 items-center gap-2 border border-border bg-surface-2 px-3 focus-within:border-primary/70'>
					<Clock
						size={15}
						className='text-subtle'
					/>
					<input
						type='time'
						value={time}
						onChange={event => {
							const value = event.target.value
							if (!value) return onChange({ dueAt: null, reminders: null })
							onChange({
								dueAt: combineDateTime(day, value),
								// Первое время — «в момент» и «за 15 минут»; при смене времени
								// «в момент» есть всегда, чтобы уведомление пришло ко времени события
								reminders: !list.length ? [15, 0] : list.includes(0) ? list : [...list, 0]
							})
						}}
						className='bg-transparent font-mono text-base text-fg outline-none [color-scheme:dark]'
					/>
				</label>
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
						<select
							value={customUnit}
							onChange={event => setCustomUnit(Number(event.target.value))}
							className='h-8 border border-border bg-surface-2 px-2 text-sm text-fg outline-none [color-scheme:dark]'
						>
							{UNITS.map(([value, label]) => (
								<option
									key={value}
									value={value}
								>
									{label}
								</option>
							))}
						</select>
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
