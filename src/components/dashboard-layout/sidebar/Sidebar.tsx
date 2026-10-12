'use client'

import cn from 'clsx'
import { ChevronLeft, ChevronRight, GanttChartSquare, Send, X } from 'lucide-react'
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
		<div className='flex h-full min-h-0 flex-col justify-between'>
			<div>
				{/* Шапка сайдбара с логотипом и кнопками управления */}
				<div
					className={cn(
						'flex items-center border-b border-b-border relative min-h-[60px]',
						collapsed ? 'justify-center px-2 py-2' : 'justify-between p-3'
					)}
				>
					{!collapsed && (
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
					)}

					{/* Кнопка закрытия для мобильного экрана */}
					{isMobile && (
						<button
							onClick={onCloseMobile}
							aria-label='Закрыть меню'
							className='p-1.5 text-white/50 hover:text-white'
						>
							<X size={20} />
						</button>
					)}

					{/* Кнопка сворачивания для десктопа */}
					{!isMobile && (
						<button
							onClick={onToggleCollapse}
							title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
							aria-label={
								collapsed
									? 'Развернуть боковую панель'
									: 'Свернуть боковую панель'
							}
							className='grid h-9 w-8 shrink-0 place-items-center text-white/45 transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-primary'
						>
							{collapsed ? (
								<ChevronRight size={16} />
							) : (
								<ChevronLeft size={18} />
							)}
						</button>
					)}
				</div>

				{/* Список пунктов меню */}
				<div className='min-h-0 flex-1 overflow-y-auto p-3'>
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
				{!collapsed && (
					<div className='pt-4 text-center text-xs text-white/35'>
						<p>© 2026 Planner</p>
						<a
							href='https://t.me/w_dtc'
							target='_blank'
							rel='noreferrer'
							aria-label='Телеграм разработчика @w_dtc'
							className='mt-2 inline-flex min-h-10 items-center text-white/45 transition-colors hover:text-primary'
						>
							<Send size={16} aria-hidden='true' />
						</a>
					</div>
				)}
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
					'fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(84vw,20rem)] max-w-[320px] flex-col border-r border-r-border bg-sidebar pb-[env(safe-area-inset-bottom)] transform transition-transform duration-300 lg:hidden shadow-2xl select-none',
					isMobileOpen ? 'translate-x-0' : '-translate-x-full'
				)}
			>
				{sidebarContent(false, true)}
			</aside>
		</>
	)
}
