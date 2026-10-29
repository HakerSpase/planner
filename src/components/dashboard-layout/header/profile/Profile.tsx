'use client'

import Loader from '@/components/ui/Loader'

import { useProfile } from '@/hooks/useProfile'

export function Profile() {
	const { data, isLoading } = useProfile()

	if (isLoading) return <Loader />

	const name = data?.user.name || 'Пользователь'

	return (
		<div className='flex min-w-0 items-center gap-2.5'>
			<div className='min-w-0 max-w-[240px] text-right'>
				<p className='truncate text-sm font-medium leading-5 text-fg'>
					{name}
				</p>
				<p
					className='truncate text-xs leading-4 text-subtle'
					title={data?.user.email || undefined}
				>
					{data?.user.email}
				</p>
			</div>
		</div>
	)
}
