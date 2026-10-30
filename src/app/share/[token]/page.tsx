import type { Metadata } from 'next'

import { SharedPage } from './SharedPage'

// Общие ссылки не должны попадать в поиск
export const metadata: Metadata = {
	title: 'Конспект',
	robots: { index: false, follow: false }
}

export default function Page({ params }: { params: { token: string } }) {
	return <SharedPage token={params.token} />
}
