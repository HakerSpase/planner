import type { Metadata } from 'next'

import { Heading } from '@/components/ui/Heading'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

import { Pomodoro } from './Pomodoro'

export const metadata: Metadata = {
	title: 'Таймер Pomodoro',
	...NO_INDEX_PAGE
}

export default function PomodoroPage() {
	return (
		<div className='w-full max-w-5xl'>
			<Heading title='Таймер Pomodoro' />
			<div className='mt-5 border-y border-border py-6 sm:py-10'>
				<Pomodoro />
			</div>
		</div>
	)
}
