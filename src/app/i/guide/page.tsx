import type { Metadata } from 'next'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

import { Guide } from './Guide'

export const metadata: Metadata = {
	title: 'Как пользоваться',
	...NO_INDEX_PAGE
}

export default function GuidePage() {
	return <Guide />
}
