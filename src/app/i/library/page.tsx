import type { Metadata } from 'next'
import { Suspense } from 'react'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

import { Library } from './Library'

export const metadata: Metadata = {
	title: 'Архив',
	...NO_INDEX_PAGE
}

export default function LibraryPage() {
	return (
		<Suspense>
			<Library />
		</Suspense>
	)
}
