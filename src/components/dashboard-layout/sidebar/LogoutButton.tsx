'use client'

import { useMutation } from '@tanstack/react-query'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import { authService } from '@/services/auth.service'

export function LogoutButton({ collapsed = false }: { collapsed?: boolean }) {
	const router = useRouter()
	const [isConfirmOpen, setIsConfirmOpen] = useState(false)

	const { mutate, isPending } = useMutation({
		mutationKey: ['logout'],
		mutationFn: () => authService.logout(),
		onSuccess: () => router.push('/auth')
	})

	return (
		<>
			<button
				type='button'
				title='Выйти из аккаунта'
				disabled={isPending}
				className={`flex h-9 w-full items-center rounded-lg text-muted transition-colors hover:bg-white/[0.05] hover:text-fg disabled:opacity-40 ${collapsed ? 'justify-center px-0' : 'gap-3 px-2.5'}`}
				onClick={() => setIsConfirmOpen(true)}
			>
				<LogOut size={17} strokeWidth={1.8} />
				{!collapsed && (
					<span className='text-sm font-medium'>Выйти из аккаунта</span>
				)}
			</button>
			<ConfirmDialog
				open={isConfirmOpen}
				title='Выйти из аккаунта?'
				description='Вы сможете войти снова через Google.'
				confirmLabel='Выйти'
				isPending={isPending}
				onConfirm={() => mutate()}
				onClose={() => setIsConfirmOpen(false)}
			/>
		</>
	)
}
