'use client'

import { FormProvider, useForm } from 'react-hook-form'

import type { TypeTimeBlockFormState } from '@/types/time-block.types'

import { TimeBlockingList } from './TimeBlockingList'
import { TimeBlockingForm } from './form/TimeBlockingForm'

export function TimeBlocking() {
	const methods = useForm<TypeTimeBlockFormState>()

	return (
		<FormProvider {...methods}>
			<div className='grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-6'>
				<TimeBlockingList />
				<TimeBlockingForm />
			</div>
		</FormProvider>
	)
}
