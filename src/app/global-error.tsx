'use client'

import './globals.scss'

import { ErrorScreen } from '@/components/ui/ErrorScreen'

// Срабатывает, если упал сам корневой layout — поэтому со своими <html> и <body>
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
	return (
		<html lang='ru'>
			<body className='font-sans'>
				<ErrorScreen
					code='500'
					title='Planner не запустился'
					description='Произошёл сбой при загрузке приложения. Обновите страницу — ваши данные в безопасности.'
					actions={
						<button
							type='button'
							onClick={reset}
							className='inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
						>
							Обновить
						</button>
					}
				/>
			</body>
		</html>
	)
}
