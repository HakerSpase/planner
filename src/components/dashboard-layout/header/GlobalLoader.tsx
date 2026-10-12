'use client'

import { useIsMutating } from '@tanstack/react-query'

import Loader from '@/components/ui/Loader'

export function GlobalLoader() {
	const isMutating = useIsMutating()

	return isMutating ? (
		<div className='shrink-0'>
			<Loader />
		</div>
	) : null
}
