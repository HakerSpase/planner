'use client'

import cn from 'clsx'
import { ChevronLeft, ChevronRight, GanttChartSquare, X } from 'lucide-react'
import Link from 'next/link'

import { COLORS } from '@/constants/color.constants'

import { LogoutButton } from './LogoutButton'
import { MenuItem } from './MenuItem'
import { MENU } from './menu.data'

interface ISidebarProps {
	isCollapsed: boolean
	onToggleCollapse: () => void
	isMobileOpen: boolean
	onCloseMobile: () => void
}

export function Sidebar({
	isCollapsed,
	onToggleCollapse,
	isMobileOpen,
	onCloseMobile
}: ISidebarProps) {
	const sidebarContent = (collapsed: boolean, isMobile: boolean) => (
		<div className='flex flex-col justify-between h-full'>
			<div>
				{/* Шапка сайдбара с логотипом и кнопками управления */}
				<div
					className={cn(
						'flex items-center border-b border-b-border relative min-h-[60px]',
						collapsed ? 'justify-between gap-1 px-2 py-2' : 'justify-between p-3'
					)}
				>
					<Link
						href='/'
						onClick={isMobile ? onCloseMobile : undefined}
						className='flex shrink-0 items-center gap-2.5'
					>
						<GanttChartSquare
							color={COLORS.primary}
							size={collapsed ? 25 : 32}
							className='flex-shrink-0'
						/>
						{!collapsed && (
							<span className='text-xl font-bold relative'>
								Planner
								<span className='absolute -top-1 -right-5 text-[10px] text-[#7551FF] opacity-80 rotate-[18deg] font-mono'>
									beta
								</span>
							</span>
						)}
					</Link>

					{/* Кнопка закрытия для мобильного экрана */}
					{isMobile && (
						<button
							onClick={onCloseMobile}
							className='p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/5'
						>
							<X size={20} />
						</button>
					)}

					{/* Кнопка сворачивания для десктопа */}
					{!isMobile && (
						<button
							onClick={onToggleCollapse}
							title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
							className={cn('shrink-0 text-white/50 hover:text-white transition-colors rounded-lg hover:bg-white/10', collapsed ? 'p-1' : 'p-1.5')}
						>
							{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={18} />}
						</button>
					)}
				</div>

				{/* Список пунктов меню */}
				<div className='p-3'>
					<nav className='space-y-1'>
						{MENU.map(item => (
							<MenuItem
								item={item}
								key={item.link}
								isCollapsed={collapsed}
								onClick={isMobile ? onCloseMobile : undefined}
							/>
						))}
					</nav>
				</div>
			</div>

			{/* Футер сайдбара */}
			<footer
				className={cn(
					'font-normal border-t border-t-white/[0.06]',
					collapsed ? 'p-2' : 'p-4'
				)}
			>
				<LogoutButton collapsed={collapsed} />
				{!collapsed && <p className='pt-4 text-center text-xs text-white/35'>© 2026 Planner</p>}
			</footer>
		</div>
	)

	return (
		<>
			{/* Десктопный сайдбар с плавной анимацией ширины */}
			<aside
				className={cn(
					'hidden lg:flex flex-col border-r border-r-border h-full bg-sidebar transition-all duration-300 relative z-30 select-none flex-shrink-0',
					isCollapsed ? 'w-20' : 'w-64'
				)}
			>
				{sidebarContent(isCollapsed, false)}
			</aside>

			{/* Мобильный сайдбар (выдвижное меню Drawer) */}
			<aside
				className={cn(
					'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-r-border h-full bg-sidebar w-64 transform transition-transform duration-300 lg:hidden shadow-2xl select-none',
					isMobileOpen ? 'translate-x-0' : '-translate-x-full'
				)}
			>
				{sidebarContent(false, true)}
			</aside>
		</>
	)
}
