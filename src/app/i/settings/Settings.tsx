'use client'

import { SubmitHandler, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/buttons/Button'
import { Field } from '@/components/ui/fields/Field'

import { TypeUserForm } from '@/types/auth.types'

import { useInitialData } from './useInitialData'
import { useUpdateSettings } from './useUpdateSettings'

export function Settings() {
	const { register, handleSubmit, reset } = useForm<TypeUserForm>({
		mode: 'onChange'
	})

	useInitialData(reset)

	const { isPending, mutate } = useUpdateSettings()

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
								className='w-full rounded-md border border-border bg-[#141515] p-3 text-white/60 cursor-not-allowed text-sm'
							/>
						</div>

						<Field
							id='name'
							label='Имя пользователя: '
							placeholder='Введите имя'
							{...register('name')}
							extra='mb-6'
						/>
					</div>

					{/* Настройки интервалов Pomodoro */}
					<div>
						<Field
							id='workInterval'
							label='Интервал работы (мин.): '
							placeholder='Введите интервал работы'
							isNumber
							{...register('workInterval', {
								valueAsNumber: true
							})}
							extra='mb-4'
						/>

						<Field
							id='breakInterval'
							label='Интервал перерыва (мин.): '
							placeholder='Введите интервал перерыва'
							isNumber
							{...register('breakInterval', {
								valueAsNumber: true
							})}
							extra='mb-4'
						/>

						<Field
							id='intervalsCount'
							label='Количество интервалов (макс. 10): '
							placeholder='Введите количество интервалов'
							isNumber
							{...register('intervalsCount', {
								valueAsNumber: true
							})}
							extra='mb-6'
						/>
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
