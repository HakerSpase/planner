import type { Metadata } from 'next'

import { ErrorScreen } from '@/components/ui/ErrorScreen'

export const metadata: Metadata = { title: 'Страница не найдена' }

export default function NotFound() {
	return (
		<ErrorScreen
			code='404'
			title='Такой страницы нет'
			description='Возможно, ссылка устарела или в адресе опечатка. Всё ваше — задачи, мысли и архив — на месте.'
		/>
	)
}
