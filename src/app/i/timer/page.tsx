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
		<div className='max-w-5xl'>
			<Heading title='Таймер Pomodoro' />
			<div className='mt-6 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-[#19191d] to-[#111214] p-6 sm:p-10 shadow-2xl shadow-black/20'>
				<Pomodoro />
			</div>
		</div>
	)
}
