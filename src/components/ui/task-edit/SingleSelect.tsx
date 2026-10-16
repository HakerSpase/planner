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
}

export function SingleSelect({
	data,
	onChange,
	value,
	isColorSelect
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
					isColorSelect ? 'w-full border border-border px-3' : 'max-w-full'
				)}
			>
				{isColorSelect ? (
					<>
						<span
							className='h-4 w-4 shrink-0 border border-white/20'
							style={{ backgroundColor: selected?.value || '#64748b' }}
						/>
						<span className='min-w-0 flex-1 truncate text-sm text-white/75'>
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
				<ChevronDown
					size={14}
					className='shrink-0 text-white/40'
				/>
			</button>
			{selected && !isColorSelect && (
				<button
					type='button'
					aria-label='Сбросить выбор'
					className='grid h-6 w-6 place-items-center text-white/35 hover:text-white transition-colors shrink-0'
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
					className='absolute left-0 top-[calc(100%+0.25rem)] z-30 max-h-60 w-full min-w-40 overflow-y-auto border border-white/10 bg-sidebar p-1 shadow-xl'
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
								'flex min-h-9 w-full items-center gap-2 px-2 text-left text-sm transition-colors hover:bg-white/[0.06]',
								item.value === value && 'bg-white/[0.06]'
							)}
						>
							{isColorSelect && (
								<span
									className='h-4 w-4 shrink-0 border border-white/20'
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
