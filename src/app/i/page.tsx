import type { Metadata } from 'next'

import { Heading } from '@/components/ui/Heading'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

import { ActivityCalendar } from './ActivityCalendar'
import { Statistics } from './Statistics'

export const metadata: Metadata = {
	title: 'Главная',
	...NO_INDEX_PAGE
}

export default function DashboardPage() {
	return (
		<div>
			<Heading
				title='Главная'
				description='Ваш прогресс и активность'
			/>
			<Statistics />
			<ActivityCalendar />
		</div>
	)
}
