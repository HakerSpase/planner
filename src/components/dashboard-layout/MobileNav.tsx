'use client'

import cn from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { DASHBOARD_PAGES } from '@/config/pages-url.config'

import { MENU } from './sidebar/menu.data'

// Самые частые разделы — в нижней панели, остальное под «Ещё»
const PRIMARY = [
	DASHBOARD_PAGES.HOME,
	DASHBOARD_PAGES.TASKS,
	DASHBOARD_PAGES.TIMER,
	DASHBOARD_PAGES.THOUGHTS
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
			className='fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden'
		>
			{items.map(item => (
				<Link
					key={item.link}
					href={item.link}
					aria-current={isActive(item.link) ? 'page' : undefined}
					className={cn(
						'relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors',
						isActive(item.link)
							? 'text-fg before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-primary'
							: 'text-subtle'
					)}
				>
					<item.icon
						size={19}
						strokeWidth={isActive(item.link) ? 2.2 : 1.8}
					/>
					{item.name}
				</Link>
			))}
			<button
				type='button'
				onClick={onOpenMore}
				className={cn(
					'relative flex h-14 flex-col items-center justify-center gap-1 text-[10px] transition-colors',
					isMoreActive
						? 'text-fg before:absolute before:inset-x-4 before:top-0 before:h-0.5 before:bg-primary'
						: 'text-subtle'
				)}
			>
				<MoreHorizontal size={19} />
				Ещё
			</button>
		</nav>
	)
}
