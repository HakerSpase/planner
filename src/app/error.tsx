'use client'

import { useEffect } from 'react'

import { ErrorScreen } from '@/components/ui/ErrorScreen'

export default function Error({
	error,
	reset
}: {
	error: Error & { digest?: string }
	reset: () => void
}) {
	useEffect(() => {
		console.error(error)
	}, [error])

	return (
		<ErrorScreen
			code='500'
			title='Что-то пошло не так'
			description='Раздел не смог загрузиться. Данные не потеряны: попробуйте ещё раз — обычно это помогает.'
			details={error.digest ? `Код для поддержки: ${error.digest}` : undefined}
			actions={
				<button
					type='button'
					onClick={reset}
					className='inline-flex h-10 items-center bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
				>
					Попробовать снова
				</button>
			}
		/>
	)
}
