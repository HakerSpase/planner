'use client'

import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/buttons/Button'
import { Field } from '@/components/ui/fields/Field'

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

export function Settings() {
	const {
		register,
		handleSubmit,
		reset,
		watch,
		setValue,
		formState: { errors }
	} = useForm<TypeUserForm>({
		mode: 'onChange'
	})

	useInitialData(reset)

	const { isPending, mutate } = useUpdateSettings()
	const timeZoneMenuRef = useRef<HTMLDivElement>(null)
	const [timeZoneMenuOpen, setTimeZoneMenuOpen] = useState(false)
	const [timeZoneSearch, setTimeZoneSearch] = useState('')
	const selectedTimeZone = watch('timeZone') || ''
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

		mutate({
			...rest
		})
	}

	return (
		<div className='w-full max-w-3xl'>
			<form onSubmit={handleSubmit(onSubmit)}>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10'>
					{/* Данные профиля */}
					<div>
						<div className='mb-4'>
							<label className='text-xs uppercase text-white/50 block mb-1'>
								Почта аккаунта Google (только чтение)
							</label>
							<input
								id='email'
								type='email'
								disabled
								readOnly
								{...register('email')}
								className='w-full border border-border bg-[#141515] p-3 text-sm text-white/60 cursor-not-allowed'
							/>
						</div>

						<Field
							id='name'
							label='Имя пользователя: '
							placeholder='Введите имя'
							{...register('name')}
							extra='mb-6'
						/>
						<div className='border-t border-white/[0.08] pt-5'>
							<label
								htmlFor='timeZone'
								className='text-sm font-medium text-white/75'
							>
								Часовой пояс
							</label>
							<p className='mb-2 mt-1 text-xs text-white/45'>
								Используется для дат, календаря активности и дневных сессий
								Pomodoro.
							</p>
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
									className='flex min-h-12 w-full items-center justify-between gap-3 border border-border bg-[#141515] px-3 py-2 text-left text-sm text-white outline-none transition-colors hover:border-primary focus-visible:border-primary'
								>
									<span className='min-w-0 truncate'>
										{selectedTimeZone
											? `${selectedTimeZone.replaceAll('_', ' ')} (${timeZones.find(zone => zone.zone === selectedTimeZone)?.offset || 'UTC+00:00'})`
											: 'Определяется устройством'}
									</span>
									<ChevronDown
										size={16}
										className={`shrink-0 text-white/50 transition-transform ${timeZoneMenuOpen ? 'rotate-180' : ''}`}
									/>
								</button>
								{timeZoneMenuOpen && (
									<div className='absolute left-0 right-0 top-full z-40 mt-1 border border-white/15 bg-[#111213] shadow-xl'>
										<div className='sticky top-0 border-b border-white/10 bg-[#111213] p-2'>
											<div className='flex items-center gap-2 border border-white/10 px-2'>
												<Search
													size={15}
													className='shrink-0 text-white/40'
												/>
												<input
													autoFocus
													value={timeZoneSearch}
													onChange={event =>
														setTimeZoneSearch(event.target.value)
													}
													placeholder='Найти город или регион'
													className='h-9 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35'
												/>
											</div>
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
														className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/[0.06] ${selectedTimeZone === zone ? 'bg-primary/10 text-white' : 'text-white/75'}`}
													>
														<span className='min-w-0 truncate'>{label}</span>
														<span className='flex shrink-0 items-center gap-2 text-xs text-white/45'>
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
												<p className='px-3 py-4 text-sm text-white/45'>
													Ничего не найдено
												</p>
											)}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
					{/* Настройки интервалов Pomodoro */}
					<div>
						<Field
							id='workInterval'
							label='Интервал работы (мин.): '
							placeholder='Введите интервал работы'
							isNumber
							{...register('workInterval', {
								required: 'Укажите длительность работы',
								valueAsNumber: true,
								min: { value: 1, message: 'Минимум 1 минута' },
								max: { value: 180, message: 'Максимум 180 минут' }
							})}
							min={1}
							max={180}
							step={1}
							extra='mb-4'
						/>
						{errors.workInterval?.message && (
							<p className='-mt-3 mb-4 text-xs text-red-300'>
								{errors.workInterval.message}
							</p>
						)}

						<Field
							id='breakInterval'
							label='Интервал перерыва (мин.): '
							placeholder='Введите интервал перерыва'
							isNumber
							{...register('breakInterval', {
								required: 'Укажите длительность перерыва',
								valueAsNumber: true,
								min: { value: 1, message: 'Минимум 1 минута' },
								max: { value: 60, message: 'Максимум 60 минут' }
							})}
							min={1}
							max={60}
							step={1}
							extra='mb-4'
						/>
						{errors.breakInterval?.message && (
							<p className='-mt-3 mb-4 text-xs text-red-300'>
								{errors.breakInterval.message}
							</p>
						)}

						<Field
							id='intervalsCount'
							label='Количество интервалов (макс. 10): '
							placeholder='Введите количество интервалов'
							isNumber
							{...register('intervalsCount', {
								required: 'Укажите количество раундов',
								valueAsNumber: true,
								min: { value: 1, message: 'Минимум 1 раунд' },
								max: { value: 10, message: 'Максимум 10 раундов' }
							})}
							min={1}
							max={10}
							step={1}
							extra='mb-6'
						/>
						{errors.intervalsCount?.message && (
							<p className='-mt-5 mb-4 text-xs text-red-300'>
								{errors.intervalsCount.message}
							</p>
						)}
					</div>
				</div>
				<Button
					type='submit'
					disabled={isPending}
					className='mt-2'
				>
					{isPending ? 'Сохранение...' : 'Сохранить настройки'}
				</Button>
			</form>
		</div>
	)
}
