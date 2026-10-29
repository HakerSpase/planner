'use client'

import cn from 'clsx'

// От «плохо» к «хорошо»: цвет и высота столбика растут слева направо
export const MOODS = [
	{ value: 1, label: 'Тяжело', color: '#f46363' },
	{ value: 2, label: 'Так себе', color: '#f59a4a' },
	{ value: 3, label: 'Нормально', color: '#e9c46a' },
	{ value: 4, label: 'Хорошо', color: '#8fd26b' },
	{ value: 5, label: 'Отлично', color: '#34c780' }
] as const

export const moodColor = (mood?: number | null) =>
	MOODS.find(item => item.value === mood)?.color

interface IMoodScale {
	value?: number | null
	onChange: (value: number | null) => void
	size?: 'md' | 'lg'
}

export function MoodScale({ value, onChange, size = 'md' }: IMoodScale) {
	const selected = MOODS.find(item => item.value === value)
	const unit = size === 'lg' ? 7 : 5

	return (
		<div className='flex items-center gap-4'>
			<div
				role='radiogroup'
				aria-label='Настроение дня'
				className='flex items-end gap-1'
			>
				{MOODS.map(mood => {
					const isFilled = Boolean(value && mood.value <= value)
					return (
						<button
							key={mood.value}
							type='button'
							role='radio'
							aria-checked={mood.value === value}
							aria-label={`${mood.value} — ${mood.label}`}
							title={mood.label}
							// повторный клик по выбранному — снять отметку
							onClick={() => onChange(mood.value === value ? null : mood.value)}
							className='group flex h-9 w-6 items-end justify-center'
						>
							<span
								className={cn(
									'block w-full transition-all duration-200',
									!isFilled && 'bg-white/10 group-hover:bg-white/25'
								)}
								style={{
									height: (mood.value + 1) * unit,
									backgroundColor: isFilled ? selected?.color : undefined
								}}
							/>
						</button>
					)
				})}
			</div>
			<div className='min-w-0 leading-tight'>
				<p
					className='text-sm font-medium'
					style={{ color: selected?.color }}
				>
					{selected ? selected.label : <span className='text-subtle'>Настроение</span>}
				</p>
				<p className='font-mono text-2xs uppercase tracking-wider text-subtle'>
					{selected ? `${selected.value} из 5` : 'хуже ← → лучше'}
				</p>
			</div>
		</div>
	)
}
