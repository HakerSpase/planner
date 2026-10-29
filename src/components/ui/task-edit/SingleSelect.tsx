import cn from 'clsx'
import { ChevronDown, X } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'

import { useOutside } from '@/hooks/useOutside'

export interface IOption {
	label: string
	value: string
}

interface ISingleSelect {
	data: IOption[]
	onChange: (value: string) => void
	value: string
	isColorSelect?: boolean
	isClearable?: boolean
}

export function SingleSelect({
	data,
	onChange,
	value,
	isColorSelect,
	isClearable = false
}: ISingleSelect) {
	const { isShow, setIsShow, ref } = useOutside(false)
	const selected = data.find(item => item.value === value)

	return (
		<div
			className={cn(
				'relative min-w-0 inline-flex items-center gap-1 max-w-full',
				isColorSelect && 'w-full'
			)}
			ref={ref}
		>
			<button
				type='button'
				aria-expanded={isShow}
				aria-haspopup='listbox'
				onClick={() => setIsShow(!isShow)}
				className={cn(
					'flex min-h-9 items-center gap-1.5 text-left max-w-full',
					isColorSelect
						? 'w-full rounded-lg border border-border bg-surface-2 px-3 hover:border-border-strong'
						: 'max-w-full rounded-md'
				)}
			>
				{isColorSelect ? (
					<>
						<span
							className='h-3.5 w-3.5 shrink-0'
							style={{ backgroundColor: selected?.value || '#64748b' }}
						/>
						<span className='min-w-0 flex-1 truncate text-sm text-fg'>
							{selected?.label || 'Выберите цвет'}
						</span>
					</>
				) : selected ? (
					<Badge
						variant={value}
						className='capitalize'
					>
						{selected.label}
					</Badge>
				) : (
					<Badge>Выберите</Badge>
				)}
				{/* у приоритета стрелка лишняя — бейдж и так кликабельный */}
				{isColorSelect && (
					<ChevronDown
						size={14}
						className='shrink-0 text-subtle'
					/>
				)}
			</button>
			{isClearable && selected && !isColorSelect && (
				<button
					type='button'
					aria-label='Сбросить выбор'
					className='grid h-6 w-6 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					onClick={e => {
						e.stopPropagation()
						onChange('')
					}}
				>
					<X size={13} />
				</button>
			)}
			{isShow && (
				<div
					role='listbox'
					className='absolute left-0 top-[calc(100%+0.25rem)] z-30 max-h-60 w-full min-w-40 animate-pop-in overflow-y-auto rounded-xl border border-border bg-elevated p-1 shadow-pop'
				>
					{data.map(item => (
						<button
							key={item.value}
							type='button'
							role='option'
							aria-selected={item.value === value}
							onClick={() => {
								onChange(item.value)
								setIsShow(false)
							}}
							className={cn(
								'flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors hover:bg-white/[0.06]',
								item.value === value && 'bg-white/[0.06]'
							)}
						>
							{isColorSelect && (
								<span
									className='h-3.5 w-3.5 shrink-0'
									style={{ backgroundColor: item.value }}
								/>
							)}
							{isColorSelect ? (
								<span>{item.label}</span>
							) : (
								<Badge variant={item.value}>{item.label}</Badge>
							)}
						</button>
					))}
				</div>
			)}
		</div>
	)
}
