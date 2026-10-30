'use client'

import cn from 'clsx'
import { Bell, Check, FileText, ListChecks, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import { type Control, useController } from 'react-hook-form'

import type { ISubtask, TypeTaskFormState } from '@/types/task.types'

import { useBackClose } from '@/hooks/useBackClose'

import { TaskReminders, combineDateTime, timeOf } from './TaskReminders'

// Редактор тяжёлый (Tiptap + ProseMirror) — грузим его только когда он нужен
const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{
		ssr: false,
		loading: () => <div className='min-h-[240px] animate-pulse bg-white/[0.02]' />
	}
)

interface ITaskDetails {
	control: Control<TypeTaskFormState>
	taskName?: string
	// id задачи — чтобы фоновая загрузка дописала файл в заметку, даже если панель закрыли
	taskId?: string
	// На доске пустую строку «Подзадачи и заметка» показываем только при наведении
	compact?: boolean
}

const newSubtaskId = () =>
	typeof crypto !== 'undefined' && 'randomUUID' in crypto
		? crypto.randomUUID()
		: `${Date.now()}-${Math.random().toString(36).slice(2)}`

// Короткое превью заметки: только текст — без картинок, ссылок-адресов и разметки
const notePreview = (markdown: string) =>
	markdown
		.replace(/<img[^>]*>/gi, '')
		.replace(/<[^>]+>/g, '')
		.replace(/!\[[^\]]*]\([^)]*\)/g, '')
		.replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
		.replace(/^[#>\-*\s]+|\[[ x]]\s?/gim, '')
		.replace(/[*_~`]/g, '')
		.replace(/\s+/g, ' ')
		.trim()

/**
 * Строка-превью под названием задачи и выезжающая справа панель:
 * подзадачи с прогрессом + заметка в редакторе. Всё пишется в форму задачи
 * и сохраняется тем же debounce, что и остальные поля.
 */
export function TaskDetails({ control, taskName, taskId, compact }: ITaskDetails) {
	const [isOpen, setIsOpen] = useState(false)
	const { field: noteField } = useController({ control, name: 'note' })
	const { field: subtasksField } = useController({ control, name: 'subtasks' })
	const { field: dueAtField } = useController({ control, name: 'dueAt' })
	const { field: remindersField } = useController({ control, name: 'reminders' })
	const { field: dayField } = useController({ control, name: 'createdAt' })

	// Задачу перенесли на другой день — время события едет вместе с ней
	const dueAt = dueAtField.value
	const day = dayField.value
	const onDueAtChange = dueAtField.onChange
	useEffect(() => {
		if (!dueAt || !day) return
		const next = combineDateTime(day, timeOf(dueAt))
		if (next !== new Date(dueAt).toISOString()) onDueAtChange(next)
	}, [day, dueAt, onDueAtChange])

	const note = noteField.value || ''
	const subtasks: ISubtask[] = subtasksField.value || []
	const doneCount = subtasks.filter(subtask => subtask.isCompleted).length
	const preview = notePreview(note)
	const isEmpty = !subtasks.length && !note.trim() && !dueAt

	// Менеджер загрузок дописал файл прямо в базу — обновляем заметку в форме,
	// иначе следующее автосохранение вернуло бы старый текст с отметкой загрузки
	const onNoteChange = noteField.onChange
	useEffect(() => {
		if (!taskId) return
		const onPatched = (event: Event) => {
			const { context, content } = (event as CustomEvent).detail
			if (context.type === 'task' && context.id === taskId) onNoteChange(content)
		}
		window.addEventListener('planner:note-patched', onPatched)
		return () => window.removeEventListener('planner:note-patched', onPatched)
	}, [taskId, onNoteChange])

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className={cn(
					'group flex min-h-7 w-full min-w-0 max-w-full items-center gap-3 py-0.5 text-left text-xs text-subtle transition-colors hover:text-fg',
					compact &&
						isEmpty &&
						'opacity-0 focus-visible:opacity-100 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100'
				)}
				aria-label='Открыть подзадачи и заметку'
			>
				{dueAt && (
					<span
						className={cn(
							'flex shrink-0 items-center gap-1 font-mono tabular-nums',
							remindersField.value?.length ? 'text-primary' : 'text-muted'
						)}
					>
						<Bell size={12} />
						{timeOf(dueAt)}
					</span>
				)}
				{subtasks.length > 0 && (
					<span
						className={cn(
							'flex shrink-0 items-center gap-1 font-mono tabular-nums',
							doneCount === subtasks.length && 'text-success'
						)}
					>
						<ListChecks size={13} />
						{doneCount}/{subtasks.length}
					</span>
				)}
				<span className='flex min-w-0 flex-1 items-center gap-1.5'>
					<FileText
						size={13}
						className='shrink-0 group-hover:text-primary'
					/>
					<span className='min-w-0 truncate'>
						{preview ||
							(note.trim()
								? 'Заметка'
								: subtasks.length
									? 'Добавить заметку'
									: 'Подзадачи и заметка')}
					</span>
				</span>
			</button>

			{isOpen && (
				<TaskDetailsPanel
					taskName={taskName}
					taskId={taskId}
					note={note}
					onNoteChange={noteField.onChange}
					subtasks={subtasks}
					onSubtasksChange={subtasksField.onChange}
					reminders={
						<TaskReminders
							day={day}
							dueAt={dueAt}
							reminders={remindersField.value}
							onChange={patch => {
								if (patch.dueAt !== undefined) dueAtField.onChange(patch.dueAt)
								if (patch.reminders !== undefined) remindersField.onChange(patch.reminders)
							}}
						/>
					}
					onClose={() => setIsOpen(false)}
				/>
			)}
		</>
	)
}

interface ITaskDetailsPanel {
	taskName?: string
	taskId?: string
	note: string
	onNoteChange: (value: string) => void
	subtasks: ISubtask[]
	onSubtasksChange: (value: ISubtask[]) => void
	reminders: React.ReactNode
	onClose: () => void
}

function TaskDetailsPanel({
	taskName,
	taskId,
	note,
	onNoteChange,
	subtasks,
	onSubtasksChange,
	reminders,
	onClose
}: ITaskDetailsPanel) {
	const [newTitle, setNewTitle] = useState('')
	const newInputRef = useRef<HTMLInputElement>(null)
	const doneCount = subtasks.filter(subtask => subtask.isCompleted).length
	const progress = subtasks.length ? (doneCount / subtasks.length) * 100 : 0
	useBackClose(true, onClose)

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onClose()
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [onClose])

	const update = (id: string, patch: Partial<ISubtask>) =>
		onSubtasksChange(
			subtasks.map(subtask =>
				subtask.id === id ? { ...subtask, ...patch } : subtask
			)
		)

	const remove = (id: string) =>
		onSubtasksChange(subtasks.filter(subtask => subtask.id !== id))

	const add = () => {
		const title = newTitle.trim()
		if (!title) return
		onSubtasksChange([
			...subtasks,
			{ id: newSubtaskId(), title, isCompleted: false }
		])
		setNewTitle('')
		newInputRef.current?.focus()
	}

	if (typeof document === 'undefined') return null

	return createPortal(
		<div
			className='fixed inset-0 z-[100] flex animate-fade-in justify-end bg-black/50'
			onMouseDown={event => {
				if (event.target === event.currentTarget) onClose()
			}}
		>
			<aside
				role='dialog'
				aria-modal='true'
				aria-label='Время, подзадачи и заметка'
				className='slide flex h-[100dvh] w-full max-w-xl flex-col border-l border-border bg-surface pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-pop'
			>
				<header className='flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5'>
					<p className='eyebrow'>Задача</p>
					<button
						type='button'
						onClick={onClose}
						aria-label='Закрыть панель'
						className='grid h-8 w-8 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
					>
						<X size={17} />
					</button>
				</header>

				<div className='min-h-0 flex-1 overflow-y-auto'>
					<div className='border-b border-border px-5 py-5'>
						<h2 className='break-words text-xl font-semibold tracking-[-0.01em] text-fg'>
							{taskName?.trim() || 'Без названия'}
						</h2>
					</div>

					{reminders}

					{/* Подзадачи */}
					<section className='border-b border-border px-5 py-5'>
						<div className='mb-3 flex items-center justify-between'>
							<h3 className='eyebrow'>Подзадачи</h3>
							{subtasks.length > 0 && (
								<span className='font-mono text-xs tabular-nums text-muted'>
									{doneCount}/{subtasks.length}
								</span>
							)}
						</div>

						{subtasks.length > 0 && (
							<div className='mb-3 h-0.5 w-full bg-white/[0.08]'>
								<div
									className='h-full bg-primary transition-[width] duration-300'
									style={{ width: `${progress}%` }}
								/>
							</div>
						)}

						<ul>
							{subtasks.map(subtask => (
								<li
									key={subtask.id}
									className='group flex items-center gap-3 border-b border-border py-1.5 last:border-b-0'
								>
									<button
										type='button'
										aria-label={
											subtask.isCompleted
												? 'Отметить как невыполненную'
												: 'Отметить как выполненную'
										}
										onClick={() =>
											update(subtask.id, { isCompleted: !subtask.isCompleted })
										}
										className={cn(
											'grid h-4 w-4 shrink-0 place-items-center border transition-colors',
											subtask.isCompleted
												? 'border-primary bg-primary text-white'
												: 'border-white/30 hover:border-primary'
										)}
									>
										{subtask.isCompleted && (
											<Check
												size={11}
												strokeWidth={3.5}
											/>
										)}
									</button>
									<input
										value={subtask.title}
										onChange={event =>
											update(subtask.id, { title: event.target.value })
										}
										onBlur={event => {
											if (!event.target.value.trim()) remove(subtask.id)
										}}
										maxLength={500}
										aria-label='Название подзадачи'
										className={cn(
											'h-8 min-w-0 flex-1 bg-transparent text-sm outline-none',
											subtask.isCompleted
												? 'text-subtle line-through'
												: 'text-fg'
										)}
									/>
									<button
										type='button'
										onClick={() => remove(subtask.id)}
										aria-label='Удалить подзадачу'
										className='grid h-7 w-7 shrink-0 place-items-center text-subtle opacity-0 transition hover:text-danger focus-visible:opacity-100 group-hover:opacity-100'
									>
										<X size={14} />
									</button>
								</li>
							))}
						</ul>

						<label className='mt-1 flex cursor-text items-center gap-3'>
							<Plus
								size={16}
								className='shrink-0 text-subtle'
							/>
							<input
								ref={newInputRef}
								value={newTitle}
								onChange={event => setNewTitle(event.target.value)}
								onKeyDown={event => {
									if (event.key === 'Enter') {
										event.preventDefault()
										add()
									}
								}}
								onBlur={add}
								maxLength={500}
								placeholder='Добавить подзадачу'
								className='h-9 min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-subtle'
							/>
						</label>
					</section>

					{/* Заметка */}
					<section className='px-5 py-5'>
						<h3 className='eyebrow mb-3'>Заметка</h3>
						<RichEditor
							value={note}
							uploadContext={
								taskId && !taskId.startsWith('draft-') ? { type: 'task', id: taskId } : undefined
							}
							onChange={onNoteChange}
							placeholder='Детали, ссылки, фото, следующий шаг…'
							className='bg-surface'
							contentClassName='min-h-[240px]'
						/>
					</section>
				</div>

				<footer className='shrink-0 border-t border-border px-5 py-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
					Изменения сохраняются автоматически
				</footer>
			</aside>
		</div>,
		document.body
	)
}
