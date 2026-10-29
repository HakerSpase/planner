'use client'

import Loader from '@/components/ui/Loader'

import { useProfile } from '@/hooks/useProfile'

export function Profile() {
	const { data, isLoading } = useProfile()

	if (isLoading) return <Loader />

	const name = data?.user.name || 'Пользователь'
	const initial = (data?.user.name || data?.user.email || '?')
		.trim()
		.charAt(0)
		.toUpperCase()

	return (
		<div className='flex min-w-0 items-center gap-2.5'>
			<div className='hidden min-w-0 max-w-[220px] text-right sm:block'>
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
			<span
				title={data?.user.email || name}
				className='grid h-8 w-8 shrink-0 place-items-center border border-primary/40 bg-primary/10 font-mono text-sm font-medium text-primary'
			>
				{initial}
			</span>
		</div>
	)
}
