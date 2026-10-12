import { Controller, SubmitHandler, useFormContext } from 'react-hook-form'

import { Button } from '@/components/ui/buttons/Button'
import { Field } from '@/components/ui/fields/Field'
import { SingleSelect } from '@/components/ui/task-edit/SingleSelect'

import type { TypeTimeBlockFormState } from '@/types/time-block.types'

import { COLORS, COLOR_LABELS } from './colors.data'
import { useCreateTimeBlock } from './useCreateTimeBlock'
import { useUpdateTimeBlock } from './useUpdateTimBlock'

export function TimeBlockingForm() {
	const { register, control, watch, reset, handleSubmit, formState: { errors } } =
		useFormContext<TypeTimeBlockFormState>()

	const existsId = watch('id')

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
		className='w-full max-w-xl rounded-xl border border-white/[0.07] bg-white/[0.02] p-5'
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

			<Field
				{...register('duration', {
					required: true,
					valueAsNumber: true,
					min: 1,
					max: 1440,
					validate: value => Number.isInteger(value) || 'Укажите целое число минут'
				})}
				id='duration'
				label='Длительность (мин.):'
				placeholder='Введите длительность (мин.):'
				isNumber
				min={1}
				max={1440}
				step={1}
				extra='mb-4'
			/>
			{errors.duration?.message && <p className='-mt-3 mb-4 text-xs text-red-300'>{errors.duration.message}</p>}

			<div>
				<span className='inline-block mb-1.5'>Цвет:</span>
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
