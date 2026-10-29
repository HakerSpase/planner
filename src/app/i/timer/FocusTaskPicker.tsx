'use client'

import cn from 'clsx'
import dayjs from 'dayjs'
import { Check, ChevronDown, X } from 'lucide-react'
import { useMemo } from 'react'

import { useOutside } from '@/hooks/useOutside'

import { useTasks } from '../tasks/hooks/useTasks'

interface IFocusTaskPicker {
	value: string
	onChange: (taskId: string) => void
}

/** «Над чем работаете?» — привязка раундов к одной задаче (хранится в браузере) */
export function FocusTaskPicker({ value, onChange }: IFocusTaskPicker) {
	const { items } = useTasks()
	const { isShow, setIsShow, ref } = useOutside(false)

	// Активные задачи: сначала просроченные и сегодняшние, потом остальные по дате
	const options = useMemo(() => {
		const today = dayjs().endOf('day')
		return (items || [])
			.filter(task => !task.isCompleted && !task.id.startsWith('draft-') && task.name)
			.sort((a, b) => {
				const aDue = a.createdAt && dayjs(a.createdAt).isBefore(today) ? 0 : 1
				const bDue = b.createdAt && dayjs(b.createdAt).isBefore(today) ? 0 : 1
				return aDue - bDue || (a.order ?? 0) - (b.order ?? 0)
			})
			.slice(0, 30)
	}, [items])

	const selected = options.find(task => task.id === value)

	return (
		<div
			ref={ref}
			className='relative border-b border-border text-left'
		>
			<button
				type='button'
				onClick={() => setIsShow(!isShow)}
				aria-expanded={isShow}
				className='flex h-12 w-full items-center gap-3 px-5 transition-colors hover:bg-white/[0.02]'
			>
				<span className='eyebrow shrink-0'>Задача</span>
				<span
					className={cn(
						'min-w-0 flex-1 truncate text-sm',
						selected ? 'text-fg' : 'text-subtle'
					)}
				>
					{selected?.name || 'Над чем работаете?'}
				</span>
				<ChevronDown
					size={15}
					className='shrink-0 text-subtle'
				/>
			</button>
			{selected && (
				<button
					type='button'
					aria-label='Убрать задачу'
					onClick={() => onChange('')}
					className='absolute right-11 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-subtle transition-colors hover:text-fg'
				>
					<X size={14} />
				</button>
			)}

			{isShow && (
				<div
					role='listbox'
					className='absolute inset-x-0 top-full z-30 max-h-72 animate-pop-in overflow-y-auto border border-border bg-elevated shadow-pop'
				>
					{options.length === 0 ? (
						<p className='px-5 py-4 text-sm text-subtle'>Нет активных задач</p>
					) : (
						options.map(task => (
							<button
								key={task.id}
								type='button'
								role='option'
								aria-selected={task.id === value}
								onClick={() => {
									onChange(task.id)
									setIsShow(false)
								}}
								className='flex w-full items-center gap-3 border-b border-border px-5 py-2.5 text-left text-sm text-fg transition-colors last:border-b-0 hover:bg-white/[0.04]'
							>
								<span className='min-w-0 flex-1 truncate'>{task.name}</span>
								{task.createdAt && (
									<span className='shrink-0 font-mono text-2xs text-subtle'>
										{dayjs(task.createdAt).locale('ru').format('D MMM')}
									</span>
								)}
								{task.id === value && (
									<Check
										size={14}
										className='shrink-0 text-primary'
									/>
								)}
							</button>
						))
					)}
				</div>
			)}
		</div>
	)
}
