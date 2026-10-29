'use client'

import { Menu } from 'lucide-react'

import { GlobalLoader } from './GlobalLoader'
import { Profile } from './profile/Profile'

interface IHeaderProps {
	onToggleMobile?: () => void
}

export function Header({ onToggleMobile }: IHeaderProps) {
	return (
		<header className='flex h-12 w-full shrink-0 select-none items-center justify-between gap-2'>
			<div className='flex min-w-0 flex-1 items-center gap-2'>
				{/* На телефоне меню открывается из нижней панели («Ещё»); здесь — только на планшете */}
				{onToggleMobile && (
					<button
						onClick={onToggleMobile}
						title='Открыть меню'
						aria-label='Открыть меню'
						className='-ml-2 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-fg max-sm:hidden lg:hidden'
					>
						<Menu size={20} />
					</button>
				)}
			</div>

			{/* Профиль пользователя */}
			<div className='flex min-w-0 shrink items-center gap-3'>
				<GlobalLoader />
				<Profile />
			</div>
		</header>
	)
}
