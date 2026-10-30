'use client'

import { useQueryClient } from '@tanstack/react-query'
import cn from 'clsx'
import {
	CalendarDays,
	Clock,
	CornerDownLeft,
	Flag,
	Loader2,
	Zap
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { EnumTaskPriority } from '@/types/task.types'

import { combineDateTime } from './TaskReminders'
import { describeDay, parseQuickTask } from './quick-task'
import { taskService } from '@/services/task.service'

const PRIORITY_LABEL: Record<EnumTaskPriority, string> = {
	[EnumTaskPriority.high]: 'Высокий',
	[EnumTaskPriority.medium]: 'Средний',
	[EnumTaskPriority.low]: 'Низкий'
}

/** Одна строка — готовая задача: «реферат завтра в 18:00 !важно» */
export function QuickAddTask() {
	const queryClient = useQueryClient()
	const [text, setText] = useState('')
	const [saving, setSaving] = useState(false)
	const parsed = useMemo(() => parseQuickTask(text), [text])
	const inputRef = useRef<HTMLInputElement>(null)

	// «Поделиться → Planner» на Android открывает /i/tasks?share=текст
	useEffect(() => {
		const params = new URLSearchParams(window.location.search)
		const shared = params.get('share')
		if (!shared) return
		setText(shared.replace(/\s+/g, ' ').slice(0, 300))
		params.delete('share')
		const rest = params.toString()
		history.replaceState(
			null,
			'',
			window.location.pathname + (rest ? `?${rest}` : '')
		)
		requestAnimationFrame(() => inputRef.current?.focus())
	}, [])

	const submit = async () => {
		if (!parsed.name.trim() || saving) return
		setSaving(true)
		try {
			const dayIso = parsed.day
				? parsed.day.toISOString()
				: new Date().toISOString()
			await taskService.createTask({
				name: parsed.name.trim(),
				priority: parsed.priority ?? undefined,
				createdAt: dayIso,
				dueAt: parsed.time ? combineDateTime(dayIso, parsed.time) : null,
				reminders: parsed.time ? [0] : null
			})
			await queryClient.invalidateQueries({ queryKey: ['tasks'] })
			toast.success('Задача добавлена', {
				description: [
					parsed.day && describeDay(parsed.day),
					parsed.time,
					parsed.priority && PRIORITY_LABEL[parsed.priority].toLowerCase()
				]
					.filter(Boolean)
					.join(' · ')
			})
			setText('')
		} catch {
			toast.error('Не удалось добавить задачу')
		} finally {
			setSaving(false)
		}
	}

	const chips = [
		parsed.day && { icon: CalendarDays, label: describeDay(parsed.day) },
		parsed.time && { icon: Clock, label: parsed.time },
		parsed.priority && { icon: Flag, label: PRIORITY_LABEL[parsed.priority] }
	].filter(Boolean) as { icon: typeof Clock; label: string }[]

	return (
		<div className='mb-4'>
			<div className='flex items-center gap-2 border border-border bg-surface px-3 transition-colors focus-within:border-primary/60'>
				<Zap
					size={15}
					className='shrink-0 text-primary'
				/>
				<input
					ref={inputRef}
					value={text}
					onChange={event => setText(event.target.value)}
					onKeyDown={event => {
						if (event.key === 'Enter') {
							event.preventDefault()
							void submit()
						} else if (event.key === 'Escape') setText('')
					}}
					placeholder='Быстро: «реферат завтра в 18:00 !важно»'
					aria-label='Быстрое добавление задачи'
					className='h-11 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle'
				/>
				{text.trim() && (
					<button
						type='button'
						onClick={() => void submit()}
						disabled={!parsed.name.trim() || saving}
						className='flex h-8 shrink-0 items-center gap-1.5 bg-primary px-3 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40'
					>
						{saving ? (
							<Loader2
								size={13}
								className='animate-spin'
							/>
						) : (
							<CornerDownLeft size={13} />
						)}
						Добавить
					</button>
				)}
			</div>
			{text.trim() && (
				<div className='mt-1.5 flex flex-wrap items-center gap-1.5 text-xs'>
					<span
						className={cn('truncate', parsed.name ? 'text-fg' : 'text-danger')}
					>
						{parsed.name || 'Нет названия'}
					</span>
					{chips.map(({ icon: Icon, label }) => (
						<span
							key={label}
							className='flex items-center gap-1 bg-primary/15 px-1.5 py-0.5 text-fg'
						>
							<Icon size={11} />
							{label}
						</span>
					))}
					{!chips.length && (
						<span className='text-subtle'>
							· можно добавить «завтра», «в пятницу», «15 мая», «в 18:00»,
							«!важно»
						</span>
					)}
				</div>
			)}
		</div>
	)
}
