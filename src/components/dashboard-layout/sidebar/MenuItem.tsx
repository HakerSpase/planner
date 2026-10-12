import cn from 'clsx'
import Link from 'next/link'

import { IMenuItem } from './menu.interface'

interface IMenuItemProps {
	item: IMenuItem
	isCollapsed?: boolean
	onClick?: () => void
}

export function MenuItem({ item, isCollapsed, onClick }: IMenuItemProps) {
	return (
		<div>
			<Link
				href={item.link}
				onClick={onClick}
				title={isCollapsed ? item.name : undefined}
				className={cn(
					'flex items-center gap-2.5 py-2 mt-2 transition-colors hover:bg-border rounded-lg text-sm text-white/80 hover:text-white',
					isCollapsed ? 'justify-center px-0' : 'px-layout'
				)}
			>
				<item.icon size={20} className='flex-shrink-0' />
				{!isCollapsed && <span className='truncate'>{item.name}</span>}
			</Link>
		</div>
	)
}
