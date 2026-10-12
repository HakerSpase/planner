'use client'

import Loader from '@/components/ui/Loader'

import { useProfile } from '@/hooks/useProfile'

export function Profile() {
	const { data, isLoading } = useProfile()

	return (
		<div>
			{isLoading ? (
				<Loader />
			) : (
				<div className='flex min-w-0 max-w-[64vw] flex-col items-end justify-center gap-0 py-0.5 sm:max-w-[240px]'>
					<div className='min-w-0 max-w-full text-right'>
						<p className='max-w-full truncate text-xs font-medium leading-4 text-white/90 sm:text-sm'>
							{data?.user.name || 'Пользователь'}
						</p>
						<p
							className='max-w-full break-all text-[10px] leading-4 text-white/50 sm:truncate sm:text-xs'
							title={data?.user.email || undefined}
						>
							{data?.user.email}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
