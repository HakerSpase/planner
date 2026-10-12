import cn from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { IMenuItem } from './menu.interface'

interface IMenuItemProps {
	item: IMenuItem
	isCollapsed?: boolean
	onClick?: () => void
}

export function MenuItem({ item, isCollapsed, onClick }: IMenuItemProps) {
	const pathname = usePathname()
	const isActive =
		pathname === item.link ||
		(item.link !== '/i' && pathname.startsWith(`${item.link}/`))

	return (
		<div>
			<Link
				href={item.link}
				onClick={onClick}
				aria-current={isActive ? 'page' : undefined}
				title={isCollapsed ? item.name : undefined}
				className={cn(
					'flex items-center gap-2.5 border-l-2 py-2 mt-2 text-sm transition-colors hover:bg-white/[0.04] hover:text-white',
					isActive
						? 'border-primary bg-white/[0.035] text-white'
						: 'border-transparent text-white/70',
					isCollapsed ? 'justify-center px-0' : 'px-layout'
				)}
			>
				<item.icon
					size={20}
					className='flex-shrink-0'
				/>
				{!isCollapsed && <span className='truncate'>{item.name}</span>}
			</Link>
		</div>
	)
}
