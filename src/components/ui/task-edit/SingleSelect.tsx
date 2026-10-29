import cn from 'clsx'
import { ChevronDown, X } from 'lucide-react'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Badge } from '@/components/ui/Badge'

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
	const [isShow, setIsShow] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const [menuStyle, setMenuStyle] = useState<CSSProperties>({})

	// Меню рисуем в портале с fixed-позицией: контейнеры с overflow (доска задач) его не обрезают.
	// Если снизу мало места — открываем вверх.
	const open = () => {
		const rect = ref.current?.getBoundingClientRect()
		if (!rect) return
		const height = Math.min(240, data.length * 40 + 10)
		const openUp = window.innerHeight - rect.bottom < height + 12 && rect.top > height + 12
		setMenuStyle({
			position: 'fixed',
			left: Math.min(rect.left, window.innerWidth - 176),
			width: Math.max(rect.width, 160),
			...(openUp
				? { bottom: window.innerHeight - rect.top + 4 }
				: { top: rect.bottom + 4 })
		})
		setIsShow(true)
	}

	useEffect(() => {
		if (!isShow) return
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node
			if (!ref.current?.contains(target) && !menuRef.current?.contains(target))
				setIsShow(false)
		}
		const close = () => setIsShow(false)
		document.addEventListener('pointerdown', onPointerDown)
		window.addEventListener('scroll', close, true)
		window.addEventListener('resize', close)
		return () => {
			document.removeEventListener('pointerdown', onPointerDown)
			window.removeEventListener('scroll', close, true)
			window.removeEventListener('resize', close)
		}
	}, [isShow])
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
				onClick={() => (isShow ? setIsShow(false) : open())}
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
			{isShow &&
				typeof document !== 'undefined' &&
				createPortal(
				<div
					ref={menuRef}
					role='listbox'
					style={menuStyle}
					className='z-[130] max-h-60 animate-pop-in overflow-y-auto border border-border bg-elevated p-1 shadow-pop'
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
				</div>,
				document.body
			)}
		</div>
	)
}
