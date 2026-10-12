'use client'

import { useEffect, useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, NotebookPen } from 'lucide-react'
import { toast } from 'sonner'

const iso = (date: Date) => format(date, 'yyyy-MM-dd')

export default function ThoughtsPage() {
	const [month, setMonth] = useState(() => new Date())
	const [selected, setSelected] = useState(() => new Date())
	const [entries, setEntries] = useState<Record<string, string>>({})
	const [draft, setDraft] = useState('')
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)
	const monthStart = startOfMonth(month)
	const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [monthStart.getTime()])

	useEffect(() => {
		let active = true
		setLoading(true)
		fetch(`/api/user/thoughts?start=${iso(startOfMonth(month))}&end=${iso(endOfMonth(month))}`, { cache: 'no-store' })
			.then(async response => {
				if (!response.ok) throw new Error('Не удалось загрузить записи')
				return response.json()
			})
			.then((rows: Array<{ thought_date: string; content: string }>) => {
				if (active) setEntries(Object.fromEntries(rows.map(row => [row.thought_date, row.content])))
			})
			.catch(() => toast.error('Не удалось загрузить мысли за этот месяц'))
			.finally(() => active && setLoading(false))
		return () => { active = false }
	}, [month.getFullYear(), month.getMonth()])

	useEffect(() => { setDraft(entries[iso(selected)] || '') }, [selected, entries])

	const save = async () => {
		setSaving(true)
		try {
			const response = await fetch('/api/user/thoughts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: iso(selected), content: draft }) })
			if (!response.ok) throw new Error()
			const saved = await response.json()
			setEntries(current => ({ ...current, [saved.thought_date]: saved.content }))
			toast.success('Запись сохранена')
		} catch {
			toast.error('Не удалось сохранить запись')
		} finally { setSaving(false) }
	}
	const changeMonth = (direction: -1 | 1) => {
		const next = addMonths(month, direction)
		setMonth(next)
		setSelected(startOfMonth(next))
	}

	return <div className='max-w-5xl pb-8'>
		<div className='flex items-start gap-3 border-b border-white/10 pb-5'>
			<NotebookPen className='mt-1 text-primary' size={20} />
			<div><h1 className='text-2xl font-semibold text-white'>Мысли на каждый день</h1><p className='mt-1 text-sm text-white/50'>Записывайте события, идеи и то, что хочется запомнить.</p></div>
		</div>
		<div className='mt-6 grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_1.2fr]'>
			<section className='border border-white/10 bg-[#141516] p-4 sm:p-5'>
				<div className='mb-5 flex items-center justify-between'>
					<button className='p-2 text-white/60 hover:text-white' aria-label='Предыдущий месяц' onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button>
					<h2 className='font-medium capitalize text-white'>{format(month, 'LLLL yyyy', { locale: ru })}</h2>
					<button className='p-2 text-white/60 hover:text-white' aria-label='Следующий месяц' onClick={() => changeMonth(1)}><ChevronRight size={18} /></button>
				</div>
				<div className='grid grid-cols-7 gap-px bg-white/10 text-center'>
					{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => <div key={day} className='bg-[#141516] py-2 text-xs text-white/40'>{day}</div>)}
					{days.map(day => {
						const key = iso(day)
						return <button key={key} onClick={() => setSelected(day)} aria-label={format(day, 'd MMMM yyyy', { locale: ru })} aria-pressed={isSameDay(day, selected)} className={`relative aspect-square bg-[#141516] text-sm transition-colors hover:bg-white/[0.06] ${!isSameMonth(day, month) ? 'text-white/20' : 'text-white/75'} ${isSameDay(day, selected) ? 'text-primary' : ''}`}>
							{format(day, 'd')}{entries[key]?.trim() && <span className='absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 bg-primary' />}
						</button>
					})}
				</div>
				<p className='mt-4 text-xs text-white/40'>{loading ? 'Загружаем записи…' : 'Точка под датой означает, что запись сохранена.'}</p>
			</section>
			<section className='flex min-h-[420px] flex-col border border-white/10 bg-[#141516] p-4 sm:p-5'>
				<label htmlFor='daily-thought' className='mb-3 text-sm font-medium capitalize text-white/80'>{format(selected, 'EEEE, d MMMM yyyy', { locale: ru })}</label>
				<textarea id='daily-thought' value={draft} onChange={event => setDraft(event.target.value)} maxLength={20000} placeholder='Что сегодня хочется сохранить в памяти?' className='min-h-[300px] flex-1 resize-y border border-white/10 bg-[#101112] p-4 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-primary/60' />
				<div className='mt-3 flex items-center justify-between gap-3'><span className='text-xs text-white/35'>{draft.length.toLocaleString('ru-RU')} / 20 000</span><button onClick={save} disabled={saving || (entries[iso(selected)] || '') === draft} className='border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-white transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-40'>{saving ? 'Сохраняем…' : 'Сохранить запись'}</button></div>
			</section>
		</div>
	</div>
}
