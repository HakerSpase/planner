'use client'

import { Menu } from 'lucide-react'

import { GlobalLoader } from './GlobalLoader'
import { Profile } from './profile/Profile'

interface IHeaderProps {
	onToggleMobile?: () => void
}

export function Header({ onToggleMobile }: IHeaderProps) {
	return (
		<header className='flex min-h-8 items-center justify-between pb-2 mb-0 select-none'>
			<div className='flex items-center gap-3'>
				{/* Кнопка гамбургер-меню для телефонов */}
				{onToggleMobile && (
					<button
						onClick={onToggleMobile}
						title='Открыть меню'
						className='lg:hidden p-2 rounded-xl bg-white/[0.05] border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors'
					>
						<Menu size={20} />
					</button>
				)}
			</div>

			{/* Профиль пользователя */}
			<div className='flex items-center gap-2 sm:gap-4'>
				<GlobalLoader />
				<Profile />
			</div>
		</header>
	)
}
