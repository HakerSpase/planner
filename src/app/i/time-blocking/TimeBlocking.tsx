'use client'

import { FormProvider, useForm } from 'react-hook-form'

import type { TypeTimeBlockFormState } from '@/types/time-block.types'

import { TimeBlockingList } from './TimeBlockingList'
import { TimeBlockingForm } from './form/TimeBlockingForm'

export function TimeBlocking() {
	const methods = useForm<TypeTimeBlockFormState>()

	return (
		<FormProvider {...methods}>
			<div className='grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10'>
				<TimeBlockingList />
				<TimeBlockingForm />
			</div>
		</FormProvider>
	)
}
