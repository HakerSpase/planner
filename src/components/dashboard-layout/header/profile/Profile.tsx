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
				<div className='flex items-center gap-3'>
					<div className='text-right hidden sm:block'>
						<p className='font-bold text-sm leading-tight text-white'>
							{data?.user.name || 'Пользователь'}
						</p>
						<p className='text-xs opacity-40 leading-tight truncate max-w-[180px]'>
							{data?.user.email}
						</p>
					</div>

					<div
						title={data?.user.email}
						className='w-9 h-9 sm:w-10 sm:h-10 flex justify-center items-center text-lg sm:text-xl font-bold text-white bg-[#7551FF]/25 border border-[#7551FF]/40 rounded-xl uppercase shadow-sm'
					>
						{data?.user.name?.charAt(0) || data?.user.email?.charAt(0) || 'P'}
					</div>
				</div>
			)}
		</div>
	)
}
