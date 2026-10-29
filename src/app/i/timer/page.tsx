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
		<div className='w-full'>
			<Heading
				title='Pomodoro'
				description='Работа короткими раундами с перерывами. Длительность меняется в настройках.'
			/>
			<Pomodoro />
		</div>
	)
}
