'use client'

import { useMutation } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { authService } from '@/services/auth.service'

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
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
			className={`flex w-full items-center ${collapsed ? 'justify-center px-0' : 'gap-2 px-3'} py-2 rounded-lg text-white/55 hover:bg-white/[0.06] hover:text-white transition-colors cursor-pointer disabled:opacity-40`}
			onClick={() => {
				if (window.confirm('Выйти из аккаунта?')) mutate()
			}}
		>
			<LogOut size={16} />
			{!collapsed && <span className='text-sm font-medium'>Выйти из аккаунта</span>}
		</button>
	)
}
