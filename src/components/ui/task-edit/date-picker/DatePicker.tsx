import cn from 'clsx'
import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
	position = 'left'
}: IDatePicker) {
	const [selected, setSelected] = useState<Date>()
	const { isShow, setIsShow, ref } = useOutside(false)
	const popupRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		setSelected(value ? new Date(value) : undefined)
	}, [value])

	// Auto-clamp calendar popup within the visible viewport on mobile & desktop
	useEffect(() => {
		if (isShow && popupRef.current) {
			const el = popupRef.current
			el.style.transform = ''
			const rect = el.getBoundingClientRect()
			const safetyMargin = 8
			const viewportWidth = window.innerWidth

			if (rect.left < safetyMargin) {
				const shift = safetyMargin - rect.left
				el.style.transform = `translateX(${shift}px)`
			} else if (rect.right > viewportWidth - safetyMargin) {
				const shift = rect.right - (viewportWidth - safetyMargin)
				el.style.transform = `translateX(-${shift}px)`
			}
		}
	}, [isShow])

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
			className='relative inline-flex min-w-0 items-center gap-1 max-w-full'
			ref={ref}
		>
			<button
				type='button'
				className='min-h-9 flex items-center min-w-0 truncate text-left text-sm'
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
					ref={popupRef}
					className={cn(
						'absolute p-2.5 slide bg-sidebar z-50 shadow-2xl border border-white/10 max-w-[calc(100vw-1rem)]',
						position === 'right' ? 'left-0 sm:left-auto sm:right-0' : 'left-0'
					)}
					style={{
						top: 'calc(100% + .5rem)'
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
