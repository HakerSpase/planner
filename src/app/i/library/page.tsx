import type { Metadata } from 'next'
import { Suspense } from 'react'

import { Heading } from '@/components/ui/Heading'

import { NO_INDEX_PAGE } from '@/constants/seo.constants'

import { Library } from './Library'

export const metadata: Metadata = {
	title: 'Архив',
	...NO_INDEX_PAGE
}

export default function LibraryPage() {
	return (
		<div>
			<Heading
				title='Архив'
				description='Разделы, темы и конспекты — с формулами, таблицами и файлами'
			/>
			<Suspense>
				<Library />
			</Suspense>
		</div>
	)
}
