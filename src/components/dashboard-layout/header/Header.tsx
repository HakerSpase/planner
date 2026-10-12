'use client'

import { Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

import { GlobalLoader } from './GlobalLoader'
import { Profile } from './profile/Profile'

interface IHeaderProps {
	onToggleMobile?: () => void
	isCollapsed?: boolean
	onToggleCollapse?: () => void
}

export function Header({
	onToggleMobile,
	isCollapsed,
	onToggleCollapse
}: IHeaderProps) {
	return (
		<header className='flex items-center justify-between pb-6 mb-2 select-none'>
			{/* Левая сторона шапки: кнопка меню для мобилки и переключатель для десктопа */}
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

				{/* Кнопка быстрого сворачивания/разворачивания на десктопе */}
				{onToggleCollapse && (
					<button
						onClick={onToggleCollapse}
						title={isCollapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню'}
						className='hidden lg:flex items-center gap-2 py-1.5 px-3 rounded-lg bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.06] text-xs text-white/50 hover:text-white transition-colors cursor-pointer'
					>
						{isCollapsed ? (
							<>
								<PanelLeftOpen size={16} className='text-[#7551FF]' />
								<span>Развернуть меню</span>
							</>
						) : (
							<>
								<PanelLeftClose size={16} className='text-white/40' />
								<span>Свернуть</span>
							</>
						)}
					</button>
				)}
			</div>

			{/* Правая сторона шапки: аватар и лоадер */}
			<div className='flex items-center gap-4'>
				<GlobalLoader />
				<Profile />
			</div>
		</header>
	)
}
