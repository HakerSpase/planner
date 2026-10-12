'use client'

import { useMutation } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { authService } from '@/services/auth.service'

export function LogoutButton() {
	const router = useRouter()

	const { mutate, isPending } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => authService.logout(),
		onSuccess: () => router.push('/auth')
	})

	return (
		<button
			title='Выйти из аккаунта'
			disabled={isPending}
			className='flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-white/[0.04] hover:bg-red-500/15 border border-white/[0.08] hover:border-red-500/30 text-white/50 hover:text-red-400 transition-all cursor-pointer'
			onClick={() => mutate()}
		>
			<LogOut size={16} />
			<span className='hidden sm:inline text-xs font-medium'>Выйти</span>
		</button>
	)
}
