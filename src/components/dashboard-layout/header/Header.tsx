'use client'

import { Menu, Search } from 'lucide-react'

import { openSearch } from '@/components/search/CommandPalette'

import { MusicToggle } from '../MusicController'

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
				<button
					type='button'
					onClick={openSearch}
					title='Поиск (Ctrl+K)'
					aria-label='Поиск'
					className='flex h-9 min-w-0 items-center gap-2 border border-border px-3 text-sm text-subtle transition-colors hover:border-white/20 hover:text-fg max-sm:w-9 max-sm:justify-center max-sm:border-transparent max-sm:px-0 sm:w-64'
				>
					<Search
						size={15}
						className='shrink-0'
					/>
					<span className='flex-1 truncate text-left max-sm:hidden'>Поиск</span>
					<kbd className='font-mono text-2xs max-sm:hidden'>Ctrl K</kbd>
				</button>
			</div>

			{/* Профиль пользователя */}
			<div className='flex min-w-0 shrink items-center gap-3'>
				<GlobalLoader />
				<MusicToggle />
				<Profile />
			</div>
		</header>
	)
}
