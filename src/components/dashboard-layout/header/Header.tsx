'use client'

import { Menu } from 'lucide-react'

import { GlobalLoader } from './GlobalLoader'
import { Profile } from './profile/Profile'

interface IHeaderProps {
	onToggleMobile?: () => void
}

export function Header({ onToggleMobile }: IHeaderProps) {
	return (
		<header className='flex min-h-9 w-full items-center justify-between gap-2 pb-2 select-none'>
			<div className='flex min-w-0 flex-1 items-center gap-2'>
				{/* Кнопка гамбургер-меню для телефонов */}
				{onToggleMobile && (
					<button
						onClick={onToggleMobile}
						title='Открыть меню'
						aria-label='Открыть меню'
						className='lg:hidden grid h-9 w-8 shrink-0 place-items-center text-white/60 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary'
					>
						<Menu size={20} />
					</button>
				)}
			</div>

			{/* Профиль пользователя */}
			<div className='flex min-w-0 shrink items-center gap-2 sm:gap-4'>
				<GlobalLoader />
				<Profile />
			</div>
		</header>
	)
}
