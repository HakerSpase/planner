import type { Metadata } from 'next'

import { SharedBundle } from './SharedBundle'

// Общие ссылки не должны попадать в поиск
export const metadata: Metadata = {
	title: 'Конспекты',
	robots: { index: false, follow: false }
}

export default function Page({ params }: { params: { token: string } }) {
	return <SharedBundle token={params.token} />
}
