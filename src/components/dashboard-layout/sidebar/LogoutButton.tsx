'use client'

import { useMutation } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { authService } from '@/services/auth.service'

interface ILogoutButtonProps {
	isCollapsed?: boolean
}

export function LogoutButton({ isCollapsed }: ILogoutButtonProps) {
	const router = useRouter()

	const { mutate } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => authService.logout(),
		onSuccess: () => router.push('/auth')
	})

	if (isCollapsed) {
		return (
			<div className='flex justify-center my-3'>
				<button
					title='Выйти из аккаунта'
					className='opacity-30 hover:opacity-100 transition-opacity p-2 rounded-lg hover:bg-border text-red-400'
					onClick={() => mutate()}
				>
					<LogOut size={18} />
				</button>
			</div>
		)
	}

	return (
		<div className='absolute top-3 right-3'>
			<button
				title='Выйти из аккаунта'
				className='opacity-30 hover:opacity-100 transition-opacity p-1 text-white hover:text-red-400'
				onClick={() => mutate()}
			>
				<LogOut size={18} />
			</button>
		</div>
	)
}
