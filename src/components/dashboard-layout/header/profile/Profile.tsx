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
				<div className='flex items-center gap-2.5'>
					<div className='text-right hidden sm:block'>
						<p className='font-medium text-sm leading-tight text-white/90'>
							{data?.user.name || 'Пользователь'}
						</p>
						<p className='text-xs text-white/40 leading-tight truncate max-w-[180px]'>
							{data?.user.email}
						</p>
					</div>

					<div
						title={data?.user.email}
						className='w-8 h-8 flex justify-center items-center text-sm font-semibold text-white/80 bg-white/[0.07] rounded-full uppercase'
					>
						{data?.user.name?.trim()?.charAt(0) || data?.user.email?.charAt(0) || 'U'}
					</div>
				</div>
			)}
		</div>
	)
}
