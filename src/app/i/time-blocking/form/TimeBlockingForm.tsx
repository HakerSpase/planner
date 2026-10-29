import { Controller, SubmitHandler, useFormContext } from 'react-hook-form'
import { toast } from 'sonner'

import { Button } from '@/components/ui/buttons/Button'
import { Field } from '@/components/ui/fields/Field'
import { SingleSelect } from '@/components/ui/task-edit/SingleSelect'

import type { TypeTimeBlockFormState } from '@/types/time-block.types'

import { COLORS, COLOR_LABELS } from './colors.data'
import { useCreateTimeBlock } from './useCreateTimeBlock'
import { useUpdateTimeBlock } from './useUpdateTimBlock'

export function TimeBlockingForm() {
	const {
		register,
		control,
		watch,
		setValue,
		reset,
		handleSubmit,
		formState: { errors }
	} = useFormContext<TypeTimeBlockFormState>()

	const existsId = watch('id')
	const duration = Number(watch('duration') || 0)

	const { updateTimeBlock } = useUpdateTimeBlock(existsId)
	const { createTimeBlock, isPending } = useCreateTimeBlock()

	const onSubmit: SubmitHandler<TypeTimeBlockFormState> = data => {
		if (!data.name?.trim()) {
			toast.error('Введите название тайм-блока')
			return
		}

		const totalMinutes = Number(data.duration || 0)
		if (totalMinutes < 1) {
			toast.error('Укажите длительность (не менее 1 минуты)')
			return
		}

		const { color, id, ...rest } = data
		const dto = { ...rest, color: color || undefined, duration: totalMinutes }

		if (id) {
			updateTimeBlock({
				id,
				data: dto
			})
			toast.success('Тайм-блок обновлён')
		} else {
			createTimeBlock(dto)
			toast.success('Тайм-блок создан')
		}

		reset({
			color: COLORS[COLORS.length - 1],
			duration: 0,
			name: '',
			id: undefined,
			order: 1
		})
	}

	const onError = (formErrors: typeof errors) => {
		if (formErrors.name) {
			toast.error('Введите название тайм-блока')
			return
		}
		if (formErrors.duration) {
			toast.error(formErrors.duration.message || 'Укажите длительность (не менее 1 минуты)')
			return
		}
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit, onError)}
			className='card-padded w-full min-w-0'
		>
			<Field
				{...register('name', {
					required: 'Введите название тайм-блока',
					validate: value => Boolean(value?.trim()) || 'Введите название тайм-блока'
				})}
				id='name'
				label='Название:'
				placeholder='Введите название:'
				state={errors.name ? 'error' : undefined}
				extra='mb-4'
			/>
			{errors.name?.message && (
				<p className='-mt-2 mb-3 text-xs text-danger'>
					{errors.name.message}
				</p>
			)}

			<input
				type='hidden'
				{...register('duration', {
					required: 'Укажите длительность (не менее 1 минуты)',
					min: {
						value: 1,
						message: 'Укажите длительность (не менее 1 минуты)'
					},
					max: {
						value: 1440,
						message: 'Максимальная длительность — 24 часа'
					},
					validate: value =>
						(Number(value) >= 1 && Number.isInteger(Number(value))) ||
						'Укажите длительность (не менее 1 минуты)'
				})}
			/>
			<fieldset className='mb-4'>
				<legend className='text-sm font-medium text-muted'>Длительность:</legend>
				<div className='mt-2 grid grid-cols-2 gap-3'>
					<label className='text-xs text-subtle'>Часы
						<input aria-label='Часы' type='number' min={0} max={24} value={Math.floor(duration / 60)} onChange={event => {
							const hours = Math.min(24, Math.max(0, Number(event.target.value) || 0))
							setValue('duration', Math.min(1440, hours * 60 + duration % 60), { shouldValidate: true, shouldDirty: true })
						}} className='mt-1 flex h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition-colors hover:border-border-strong focus:border-primary/70 focus:ring-2 focus:ring-primary/20' />
					</label>
					<label className='text-xs text-subtle'>Минуты
						<input aria-label='Минуты' type='number' min={0} max={59} value={duration % 60} onChange={event => {
							const minutes = Math.min(59, Math.max(0, Number(event.target.value) || 0))
							setValue('duration', Math.min(1440, Math.floor(duration / 60) * 60 + minutes), { shouldValidate: true, shouldDirty: true })
						}} className='mt-1 flex h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-sm text-fg outline-none transition-colors hover:border-border-strong focus:border-primary/70 focus:ring-2 focus:ring-primary/20' />
					</label>
				</div>
				<p className='mt-1 text-xs text-subtle'>{duration} мин. всего</p>
			</fieldset>
			{errors.duration?.message && (
				<p className='-mt-2 mb-4 text-xs text-danger'>
					{errors.duration.message}
				</p>
			)}

			<div>
				<span className='mb-1.5 inline-block text-sm text-muted'>Цвет:</span>
				<Controller
					control={control}
					name='color'
					render={({ field: { value, onChange } }) => (
						<SingleSelect
							data={COLORS.map(item => ({
								value: item,
								label: COLOR_LABELS[item]
							}))}
							onChange={onChange}
							value={value || COLORS[COLORS.length - 1]}
							isColorSelect
						/>
					)}
				/>
			</div>

			<Button
				type='submit'
				disabled={isPending}
				className='mt-6 w-full'
			>
				{existsId ? 'Обновить' : 'Создать'}
			</Button>
		</form>
	)
}
