'use client'

import cn from 'clsx'
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import Link from 'next/link'

import { LogoutButton } from './LogoutButton'
import { MenuItem } from './MenuItem'
import { MENU } from './menu.data'

interface ISidebarProps {
	isCollapsed: boolean
	onToggleCollapse: () => void
	isMobileOpen: boolean
	onCloseMobile: () => void
}

function Logo() {
	return (
		<span className='h-3 w-3 shrink-0 bg-primary' />
	)
}

export function Sidebar({
	isCollapsed,
	onToggleCollapse,
	isMobileOpen,
	onCloseMobile
}: ISidebarProps) {
	const sidebarContent = (collapsed: boolean, isMobile: boolean) => (
		<div className='flex h-full min-h-0 flex-col'>
			{/* Шапка сайдбара с логотипом и кнопками управления */}
			<div
				className={cn(
					'flex h-14 shrink-0 items-center border-b border-border',
					collapsed ? 'justify-center px-2' : 'justify-between px-4'
				)}
			>
				{!collapsed && (
					<Link
						href='/'
						onClick={isMobile ? onCloseMobile : undefined}
						className='flex items-center gap-2.5'
					>
						<Logo />
						<span className='text-sm font-semibold uppercase tracking-[0.2em] text-fg'>
							Planner
						</span>
						<span className='border border-border px-1.5 font-mono text-2xs uppercase text-subtle'>
							beta
						</span>
					</Link>
				)}

				{/* Кнопка закрытия для мобильного экрана */}
				{isMobile && (
					<button
						onClick={onCloseMobile}
						aria-label='Закрыть меню'
						className='grid h-8 w-8 place-items-center rounded-lg text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						<X size={18} />
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
						className='grid h-8 w-8 shrink-0 place-items-center rounded-lg text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						{collapsed ? (
							<PanelLeftOpen size={17} />
						) : (
							<PanelLeftClose size={17} />
						)}
					</button>
				)}
			</div>

			{/* Список пунктов меню */}
			<nav
				className={cn(
					'min-h-0 flex-1 space-y-0.5 overflow-y-auto py-2',
					collapsed ? 'px-2.5' : 'px-3'
				)}
			>
				{MENU.map(item => (
					<MenuItem
						item={item}
						key={item.link}
						isCollapsed={collapsed}
						onClick={isMobile ? onCloseMobile : undefined}
					/>
				))}
			</nav>

			{/* Футер сайдбара */}
			<footer
				className={cn(
					'shrink-0 border-t border-border',
					collapsed ? 'p-2.5' : 'p-3'
				)}
			>
				<LogoutButton collapsed={collapsed} />
				{!collapsed && (
					<a
						href='https://t.me/w_dtc'
						target='_blank'
						rel='noreferrer'
						aria-label='Телеграм разработчика @w_dtc'
						className='mt-1 flex h-8 items-center px-2.5 font-mono text-2xs uppercase tracking-wider text-subtle transition-colors hover:text-fg'
					>
						Telegram ↗
					</a>
				)}
			</footer>
		</div>
	)

	return (
		<>
			{/* Десктопный сайдбар с плавной анимацией ширины */}
			<aside
				className={cn(
					'relative z-30 hidden h-full shrink-0 select-none flex-col border-r border-border bg-bg transition-[width] duration-300 lg:flex',
					isCollapsed ? 'w-[68px]' : 'w-60'
				)}
			>
				{sidebarContent(isCollapsed, false)}
			</aside>

			{/* Мобильный сайдбар (выдвижное меню Drawer) */}
			<aside
				className={cn(
					'fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[min(84vw,18rem)] select-none flex-col border-r border-border bg-surface pb-[env(safe-area-inset-bottom)] shadow-pop transition-transform duration-300 lg:hidden',
					isMobileOpen ? 'translate-x-0' : '-translate-x-full'
				)}
			>
				{sidebarContent(false, true)}
			</aside>
		</>
	)
}
