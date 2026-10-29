import type { Metadata } from 'next'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

import { ActivityCalendar } from './ActivityCalendar'
import { Dashboard } from './Dashboard'

export const metadata: Metadata = {
	title: 'Главная',
	...NO_INDEX_PAGE
}

export default function DashboardPage() {
	return (
		<div>
			<Dashboard />
			<ActivityCalendar />
		</div>
	)
}
