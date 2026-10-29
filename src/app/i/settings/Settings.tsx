'use client'

import { Check, ChevronDown, LocateFixed, Minus, Plus, Search } from 'lucide-react'
import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

import { AppBackground } from '@/components/dashboard-layout/AppBackground'
import { Button } from '@/components/ui/buttons/Button'

import { BACKGROUNDS, useBackground } from '@/lib/background-preference'

import { TypeUserForm } from '@/types/auth.types'

import { useInitialData } from './useInitialData'
import { useUpdateSettings } from './useUpdateSettings'

const FALLBACK_TIME_ZONES = [
	'UTC',
	'Europe/London',
	'Europe/Moscow',
	'Europe/Berlin',
	'Europe/Istanbul',
	'Asia/Dubai',
	'Asia/Kolkata',
	'Asia/Almaty',
	'Asia/Bangkok',
	'Asia/Singapore',
	'Asia/Tokyo',
	'Asia/Seoul',
	'Australia/Sydney',
	'Pacific/Auckland',
	'America/Los_Angeles',
	'America/Denver',
	'America/Chicago',
	'America/New_York',
	'America/Toronto',
	'America/Sao_Paulo'
]

function getTimeZones() {
	const intl = Intl as typeof Intl & {
		supportedValuesOf?: (key: 'timeZone') => string[]
	}
	return Array.from(
		new Set([
			'UTC',
			...(intl.supportedValuesOf?.('timeZone') || FALLBACK_TIME_ZONES)
		])
	)
}

function getUtcOffset(timeZone: string) {
	try {
		const offset = new Intl.DateTimeFormat('en-US', {
			timeZone,
			timeZoneName: 'longOffset'
		})
			.formatToParts(new Date())
			.find(part => part.type === 'timeZoneName')?.value
		if (!offset || offset === 'GMT') return 'UTC+00:00'
		return offset.replace(/^GMT/, 'UTC')
	} catch {
		return 'UTC+00:00'
	}
}

const formatMinutes = (minutes: number) => {
	const h = Math.floor(minutes / 60)
	const m = minutes % 60
	return h ? `${h} ч${m ? ` ${m} мин` : ''}` : `${m} мин`
}

const LIMITS = {
	workInterval: { min: 1, max: 180, step: 5 },
	breakInterval: { min: 1, max: 60, step: 1 },
	intervalsCount: { min: 1, max: 10, step: 1 }
} as const

type TypeNumberField = keyof typeof LIMITS

export function Settings() {
	const {
		register,
		handleSubmit,
		reset,
		watch,
		setValue,
		formState: { isDirty }
	} = useForm<TypeUserForm>({
		mode: 'onChange'
	})

	useInitialData(reset)
	const [background, setBackground] = useBackground()

	const { isPending, mutate } = useUpdateSettings()
	const timeZoneMenuRef = useRef<HTMLDivElement>(null)
	const [timeZoneMenuOpen, setTimeZoneMenuOpen] = useState(false)
	const [timeZoneSearch, setTimeZoneSearch] = useState('')
	const selectedTimeZone = watch('timeZone') || ''
	const deviceTimeZone =
		typeof Intl !== 'undefined'
			? Intl.DateTimeFormat().resolvedOptions().timeZone
			: 'UTC'
	const timeZones = useMemo(() => {
		const zones = getTimeZones()
		if (selectedTimeZone && !zones.includes(selectedTimeZone))
			zones.push(selectedTimeZone)
		return zones.map(zone => ({
			zone,
			label: zone.replaceAll('_', ' '),
			offset: getUtcOffset(zone)
		}))
	}, [selectedTimeZone])
	const filteredTimeZones = useMemo(() => {
		const query = timeZoneSearch.trim().toLocaleLowerCase('ru')
		if (!query) return timeZones
		return timeZones.filter(({ label, offset }) =>
			`${label} ${offset}`.toLocaleLowerCase('ru').includes(query)
		)
	}, [timeZoneSearch, timeZones])

	useEffect(() => {
		if (!timeZoneMenuOpen) return
		const closeOnOutsideClick = (event: PointerEvent) => {
			if (!timeZoneMenuRef.current?.contains(event.target as Node))
				setTimeZoneMenuOpen(false)
		}
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setTimeZoneMenuOpen(false)
		}
		document.addEventListener('pointerdown', closeOnOutsideClick)
		document.addEventListener('keydown', closeOnEscape)
		return () => {
			document.removeEventListener('pointerdown', closeOnOutsideClick)
			document.removeEventListener('keydown', closeOnEscape)
		}
	}, [timeZoneMenuOpen])

	const onSubmit: SubmitHandler<TypeUserForm> = data => {
		const { password, ...rest } = data
		// После сохранения новые значения становятся «исходными», иначе форма так и останется изменённой
		mutate(rest, { onSuccess: () => reset(data) })
	}

	const work = Number(watch('workInterval')) || 0
	const rest = Number(watch('breakInterval')) || 0
	const count = Number(watch('intervalsCount')) || 0
	const sessionMinutes = work * count + rest * Math.max(0, count - 1)

	const stepper = (name: TypeNumberField, label: string, unit: string) => {
		const { min, max, step } = LIMITS[name]
		const value = Number(watch(name)) || min
		const set = (next: number) =>
			setValue(name, Math.min(max, Math.max(min, next)), {
				shouldDirty: true
			})
		return (
			<div className='flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0'>
				<span className='text-sm text-fg'>{label}</span>
				<div className='flex items-center border border-border'>
					<button
						type='button'
						aria-label={`Уменьшить: ${label}`}
						disabled={value <= min}
						onClick={() => set(value - step)}
						className='grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-white/[0.05] hover:text-fg disabled:opacity-30'
					>
						<Minus size={14} />
					</button>
					<input
						type='number'
						inputMode='numeric'
						aria-label={label}
						min={min}
						max={max}
						{...register(name, { valueAsNumber: true, min, max, required: true })}
						onBlur={event => set(Number(event.target.value) || min)}
						className='h-9 w-14 border-x border-border bg-transparent text-center font-mono text-sm tabular-nums text-fg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none'
					/>
					<button
						type='button'
						aria-label={`Увеличить: ${label}`}
						disabled={value >= max}
						onClick={() => set(value + step)}
						className='grid h-9 w-9 place-items-center text-muted transition-colors hover:bg-white/[0.05] hover:text-fg disabled:opacity-30'
					>
						<Plus size={14} />
					</button>
					<span className='w-12 px-2 text-xs text-subtle'>{unit}</span>
				</div>
			</div>
		)
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className='w-full pb-24'
		>
			<div className='border border-border bg-surface'>
				<Section
					title='Профиль'
					description='Имя видно в приветствии на главной.'
				>
					<label className='block'>
						<span className='eyebrow'>Имя</span>
						<input
							{...register('name')}
							placeholder='Как к вам обращаться'
							className='mt-2 h-10 w-full border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-primary/70'
						/>
					</label>
					<label className='mt-4 block'>
						<span className='eyebrow'>Почта Google</span>
						<input
							type='email'
							disabled
							readOnly
							{...register('email')}
							className='mt-2 h-10 w-full cursor-not-allowed border border-border bg-transparent px-3 text-sm text-subtle'
						/>
					</label>
				</Section>

				<Section
					title='Часовой пояс'
					description='От него зависят «сегодня» в задачах, календарь активности и дневные сессии Pomodoro.'
				>
					<input
						type='hidden'
						{...register('timeZone', { required: true })}
					/>
					<div
						ref={timeZoneMenuRef}
						className='relative'
					>
						<button
							id='timeZone'
							type='button'
							aria-haspopup='listbox'
							aria-expanded={timeZoneMenuOpen}
							aria-label='Выбрать часовой пояс'
							onClick={() => setTimeZoneMenuOpen(open => !open)}
							className='flex h-10 w-full items-center justify-between gap-3 border border-border bg-surface-2 px-3 text-left text-sm text-fg outline-none transition-colors hover:border-border-strong focus-visible:border-primary/70'
						>
							<span className='min-w-0 truncate'>
								{selectedTimeZone
									? selectedTimeZone.replaceAll('_', ' ')
									: 'Определяется устройством'}
							</span>
							<span className='flex shrink-0 items-center gap-2 font-mono text-xs text-subtle'>
								{selectedTimeZone &&
									timeZones.find(zone => zone.zone === selectedTimeZone)?.offset}
								<ChevronDown
									size={16}
									className={timeZoneMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
								/>
							</span>
						</button>
						{timeZoneMenuOpen && (
							<div className='absolute left-0 right-0 top-full z-40 mt-1 animate-pop-in overflow-hidden border border-border bg-elevated shadow-pop'>
								<div className='flex items-center gap-2 border-b border-border px-3'>
									<Search
										size={15}
										className='shrink-0 text-subtle'
									/>
									<input
										autoFocus
										value={timeZoneSearch}
										onChange={event => setTimeZoneSearch(event.target.value)}
										placeholder='Город или UTC+3'
										className='h-10 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle'
									/>
								</div>
								<div
									role='listbox'
									aria-label='Часовой пояс'
									className='max-h-64 overflow-y-auto'
								>
									{filteredTimeZones.length ? (
										filteredTimeZones.map(({ zone, label, offset }) => (
											<button
												key={zone}
												type='button'
												role='option'
												aria-selected={selectedTimeZone === zone}
												title={zone}
												onClick={() => {
													setValue('timeZone', zone, {
														shouldDirty: true,
														shouldValidate: true
													})
													setTimeZoneMenuOpen(false)
													setTimeZoneSearch('')
												}}
												className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.05] ${selectedTimeZone === zone ? 'bg-white/[0.06] text-fg' : 'text-muted'}`}
											>
												<span className='min-w-0 truncate'>{label}</span>
												<span className='flex shrink-0 items-center gap-2 font-mono text-xs text-subtle'>
													{offset}
													{selectedTimeZone === zone && (
														<Check
															size={14}
															className='text-primary'
														/>
													)}
												</span>
											</button>
										))
									) : (
										<p className='px-3 py-4 text-sm text-subtle'>Ничего не найдено</p>
									)}
								</div>
							</div>
						)}
					</div>
					{deviceTimeZone && deviceTimeZone !== selectedTimeZone && (
						<button
							type='button'
							onClick={() =>
								setValue('timeZone', deviceTimeZone, {
									shouldDirty: true,
									shouldValidate: true
								})
							}
							className='mt-2 flex items-center gap-1.5 text-xs text-muted transition-colors hover:text-fg'
						>
							<LocateFixed size={13} />
							Как на этом устройстве: {deviceTimeZone.replaceAll('_', ' ')}
						</button>
					)}
				</Section>

				<Section
					title='Фон'
					description='Подложка под всеми разделами. Применяется сразу и запоминается на этом устройстве.'
				>
					<div
						role='radiogroup'
						aria-label='Фон'
						className='grid grid-cols-2 gap-3 sm:grid-cols-4'
					>
						{BACKGROUNDS.map(option => (
							<button
								key={option.id}
								type='button'
								role='radio'
								aria-checked={background === option.id}
								onClick={() => setBackground(option.id)}
								className='group text-left'
							>
								<span
									className={`relative block h-20 overflow-hidden border transition-colors ${background === option.id ? 'border-primary' : 'border-border group-hover:border-border-strong'}`}
								>
									<AppBackground
										variant={option.id}
										className='absolute inset-0'
									/>
								</span>
								<span className='mt-2 block text-sm text-fg'>{option.label}</span>
								<span className='block text-xs leading-4 text-subtle'>
									{option.description}
								</span>
							</button>
						))}
					</div>
				</Section>

				<Section
					title='Pomodoro'
					description='Длительность раундов и перерывов для таймера. Новая сессия начнётся с этими значениями.'
				>
					<div>
						{stepper('workInterval', 'Работа', 'мин')}
						{stepper('breakInterval', 'Перерыв', 'мин')}
						{stepper('intervalsCount', 'Раундов', 'шт')}
					</div>
					<div className='mt-4 border border-border bg-bg px-4 py-3'>
						<p className='eyebrow'>Сессия целиком</p>
						<p className='mt-1.5 text-sm text-fg'>
							<span className='font-mono tabular-nums'>
								{count} × {work} мин
								{count > 1 ? ` + ${count - 1} × ${rest} мин` : ''}
							</span>
							<span className='text-subtle'> = </span>
							<span className='font-medium'>{formatMinutes(sessionMinutes)}</span>
						</p>
						<div className='mt-3 flex h-1.5 gap-px'>
							{Array.from({ length: count }, (_, index) => (
								<Fragment key={index}>
									<span
										className='bg-primary'
										style={{ flexGrow: work }}
									/>
									{index < count - 1 && (
										<span
											className='bg-white/15'
											style={{ flexGrow: rest }}
										/>
									)}
								</Fragment>
							))}
						</div>
					</div>
				</Section>
			</div>

			{/* Плашка сохранения появляется, только когда что-то изменили */}
			{isDirty && (
				<div className='fixed inset-x-0 bottom-0 z-40 animate-pop-in border-t border-border bg-elevated/95 backdrop-blur lg:left-auto lg:right-8 lg:bottom-6 lg:w-auto lg:border'>
					<div className='flex items-center justify-between gap-4 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:pb-3'>
						<span className='text-sm text-muted'>Есть несохранённые изменения</span>
						<div className='flex items-center gap-2'>
							<Button
								type='button'
								variant='ghost'
								size='sm'
								onClick={() => reset()}
								disabled={isPending}
							>
								Отменить
							</Button>
							<Button
								type='submit'
								size='sm'
								disabled={isPending}
							>
								{isPending ? 'Сохраняем…' : 'Сохранить'}
							</Button>
						</div>
					</div>
				</div>
			)}
		</form>
	)
}

function Section({
	title,
	description,
	children
}: {
	title: string
	description: string
	children: ReactNode
}) {
	return (
		<section className='grid gap-4 border-b border-border px-4 py-6 last:border-b-0 sm:px-6 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10'>
			<div>
				<h2 className='text-base font-semibold text-fg'>{title}</h2>
				<p className='mt-1 text-sm leading-5 text-subtle'>{description}</p>
			</div>
			<div className='min-w-0'>{children}</div>
		</section>
	)
}
