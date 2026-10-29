import cn from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { IMenuItem } from './menu.interface'

interface IMenuItemProps {
	item: IMenuItem
	hotkey?: number
	isCollapsed?: boolean
	onClick?: () => void
}

export function MenuItem({ item, isCollapsed, onClick, hotkey }: IMenuItemProps) {
	const pathname = usePathname()
	const isActive =
		pathname === item.link ||
		(item.link !== '/i' && pathname.startsWith(`${item.link}/`))

	return (
		<Link
			href={item.link}
			onClick={onClick}
			aria-current={isActive ? 'page' : undefined}
			title={hotkey ? `${item.name} · Alt+${hotkey}` : item.name}
			className={cn(
				'group relative flex h-9 items-center gap-3 text-sm font-medium transition-colors',
				isActive
					? 'bg-white/[0.05] text-fg before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary'
					: 'text-muted hover:bg-white/[0.04] hover:text-fg',
				isCollapsed ? 'justify-center px-0' : 'px-2.5'
			)}
		>
			<item.icon
				size={18}
				strokeWidth={isActive ? 2.2 : 1.8}
				className={cn(
					'shrink-0 transition-colors',
					isActive ? 'text-primary' : 'text-subtle group-hover:text-muted'
				)}
			/>
			{!isCollapsed && <span className='truncate'>{item.name}</span>}
		</Link>
	)
}
