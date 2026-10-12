'use client'

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

export function Settings() {
	const {
		register,
		handleSubmit,
		reset,
		watch,
		formState: { errors }
	} = useForm<TypeUserForm>({
		mode: 'onChange'
	})

	useInitialData(reset)

	const { isPending, mutate } = useUpdateSettings()
	const timeZones = getTimeZones()

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
							<select
								id='timeZone'
								{...register('timeZone', { required: true })}
								value={watch('timeZone') || ''}
								className='w-full border border-border bg-[#141515] p-3 text-sm text-white outline-none focus:border-primary'
							>
								{!watch('timeZone') && (
									<option value=''>Определяется устройством</option>
								)}
								{timeZones.map(zone => (
									<option
										key={zone}
										value={zone}
										className='bg-[#141515]'
									>
										{zone.replaceAll('_', ' ')}
									</option>
								))}
							</select>
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
