import { Controller, SubmitHandler, useFormContext } from 'react-hook-form'

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
		const { color, id, ...rest } = data
		const dto = { ...rest, color: color || undefined }

		if (id) {
			updateTimeBlock({
				id,
				data: dto
			})
		} else {
			createTimeBlock(dto)
		}

		reset({
			color: COLORS[COLORS.length - 1],
			duration: 0,
			name: '',
			id: undefined,
			order: 1
		})
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className='w-full min-w-0 max-w-xl border-t border-white/[0.08] pt-5 sm:border-t-0 sm:pt-0'
		>
			<Field
				{...register('name', {
					required: true
				})}
				id='name'
				label='Название:'
				placeholder='Введите название:'
				extra='mb-4'
			/>

			<input
				type='hidden'
				{...register('duration', {
					required: true,
					min: 1,
					max: 1440,
					validate: value => Number.isInteger(value) || 'Укажите длительность'
				})}
			/>
			<fieldset className='mb-4'>
				<legend className='ml-1.5 text-sm font-medium text-white/60'>Длительность:</legend>
				<div className='mt-2 grid grid-cols-2 gap-3'>
					<label className='text-xs text-white/45'>Часы
						<input aria-label='Часы' type='number' min={0} max={24} value={Math.floor(duration / 60)} onChange={event => {
							const hours = Math.min(24, Math.max(0, Number(event.target.value) || 0))
							setValue('duration', Math.min(1440, hours * 60 + duration % 60), { shouldValidate: true, shouldDirty: true })
						}} className='mt-1 flex w-full border border-border bg-transparent p-3 text-base text-white outline-none focus:border-primary' />
					</label>
					<label className='text-xs text-white/45'>Минуты
						<input aria-label='Минуты' type='number' min={0} max={59} value={duration % 60} onChange={event => {
							const minutes = Math.min(59, Math.max(0, Number(event.target.value) || 0))
							setValue('duration', Math.min(1440, Math.floor(duration / 60) * 60 + minutes), { shouldValidate: true, shouldDirty: true })
						}} className='mt-1 flex w-full border border-border bg-transparent p-3 text-base text-white outline-none focus:border-primary' />
					</label>
				</div>
				<p className='mt-1 text-xs text-white/40'>{duration} мин. всего</p>
			</fieldset>
			{errors.duration?.message && (
				<p className='-mt-3 mb-4 text-xs text-red-300'>
					{errors.duration.message}
				</p>
			)}

			<div>
				<span className='mb-1.5 inline-block text-sm text-white/65'>Цвет:</span>
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
				className='mt-6'
			>
				{existsId ? 'Обновить' : 'Создать'}
			</Button>
		</form>
	)
}
