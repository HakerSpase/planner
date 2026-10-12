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
				<div className='flex flex-col items-end justify-center gap-0.5 py-0.5'>
					<div className='text-right'>
						<p className='font-medium text-xs sm:text-sm leading-4 text-white/90'>
							{data?.user.name || 'Пользователь'}
						</p>
						<p className='text-[11px] sm:text-xs text-white/40 leading-4 truncate max-w-[180px]'>
							{data?.user.email}
						</p>
					</div>
				</div>
			)}
		</div>
	)
}
