import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DayPicker, type SelectSingleEventHandler } from 'react-day-picker'
import 'react-day-picker/dist/style.css'

import { useOutside } from '@/hooks/useOutside'

import './DatePicker.scss'
import { formatCaption } from './DatePickerCaption'

dayjs.extend(LocalizedFormat)
dayjs.locale('ru')

interface IDatePicker {
	onChange: (value: string) => void
	value: string
	position?: 'left' | 'right'
}

export function DatePicker({
	onChange,
	value,
	position = 'right'
}: IDatePicker) {
	const [selected, setSelected] = useState<Date>()
	const { isShow, setIsShow, ref } = useOutside(false)

	useEffect(() => {
		setSelected(value ? new Date(value) : undefined)
	}, [value])

	const handleDaySelect: SelectSingleEventHandler = date => {
		const ISOdate = date?.toISOString()

		setSelected(date)
		if (ISOdate) {
			onChange(ISOdate)
			setIsShow(false)
		} else {
			onChange('')
		}
	}

	return (
		<div
			className='relative inline-flex min-w-0 items-center gap-1'
			ref={ref}
		>
			<button
				className='min-w-0 text-left'
				onClick={() => setIsShow(!isShow)}
			>
				{value ? dayjs(value).locale('ru').format('LL') : 'Выберите дату'}
			</button>
			{value && (
				<button
					type='button'
					aria-label='Удалить дату'
					className='grid h-8 w-8 shrink-0 place-items-center opacity-45 transition-opacity hover:opacity-100'
					onClick={() => onChange('')}
				>
					<X size={14} />
				</button>
			)}
			{isShow && (
				<div
					className={cn(
						'absolute p-2.5 slide bg-sidebar z-10 shadow border border-white/10',
						position === 'left' ? '-left-4' : ' -right-4'
					)}
					style={{
						top: 'calc(100% + .7rem)'
					}}
				>
					<DayPicker
						fromYear={2023}
						toYear={2054}
						initialFocus={isShow}
						mode='single'
						defaultMonth={selected || (value ? new Date(value) : undefined)}
						selected={selected}
						onSelect={handleDaySelect}
						weekStartsOn={1}
						formatters={{ formatCaption }}
					/>
				</div>
			)}
		</div>
	)
}
