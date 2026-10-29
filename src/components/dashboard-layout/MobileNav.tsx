'use client'

import cn from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type React from 'react'

import { DASHBOARD_PAGES } from '@/config/pages-url.config'

import { MENU } from './sidebar/menu.data'

// Самые частые разделы — в нижней панели, остальное под «Ещё»
const PRIMARY = [
	DASHBOARD_PAGES.HOME,
	DASHBOARD_PAGES.TASKS,
	DASHBOARD_PAGES.THOUGHTS,
	DASHBOARD_PAGES.LIBRARY
]

export function MobileNav({ onOpenMore }: { onOpenMore: () => void }) {
	const pathname = usePathname()
	const items = MENU.filter(item => PRIMARY.includes(item.link))
	const isActive = (link: string) =>
		pathname === link || (link !== DASHBOARD_PAGES.HOME && pathname.startsWith(`${link}/`))
	const isMoreActive = !items.some(item => isActive(item.link))

	return (
		<nav
			aria-label='Основные разделы'
			className='fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden'
		>
			{items.map(item => {
				const active = isActive(item.link)
				return (
					<Link
						key={item.link}
						href={item.link}
						aria-current={active ? 'page' : undefined}
						className='flex h-16 flex-col items-center justify-center gap-1 active:opacity-70'
					>
						<NavIcon active={active}>
							<item.icon
								size={19}
								strokeWidth={active ? 2.2 : 1.8}
							/>
						</NavIcon>
						<NavLabel active={active}>{item.name}</NavLabel>
					</Link>
				)
			})}
			<button
				type='button'
				onClick={onOpenMore}
				className='flex h-16 flex-col items-center justify-center gap-1 active:opacity-70'
			>
				<NavIcon active={isMoreActive}>
					<MoreHorizontal size={19} />
				</NavIcon>
				<NavLabel active={isMoreActive}>Ещё</NavLabel>
			</button>
		</nav>
	)
}

// Активный раздел — только акцентный цвет иконки и подписи
function NavIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
	return (
		<span
			className={cn(
				'grid h-8 w-14 place-items-center transition-colors duration-200',
				active ? 'text-primary' : 'text-subtle'
			)}
		>
			{children}
		</span>
	)
}

function NavLabel({ active, children }: { active: boolean; children: React.ReactNode }) {
	return (
		<span
			className={cn(
				'text-[10px] leading-none transition-colors',
				active ? 'font-medium text-fg' : 'text-subtle'
			)}
		>
			{children}
		</span>
	)
}
