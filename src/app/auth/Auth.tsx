'use client'

import cn from 'clsx'
import {
	Calendar,
	Check,
	Cloud,
	GanttChartSquare,
	GripVertical,
	Kanban,
	ListTodo,
	Loader2,
	Lock,
	ShieldCheck,
	Sparkles,
	Timer,
	Wind,
	Zap
} from 'lucide-react'
import Script from 'next/script'
import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

declare global {
	interface Window {
		turnstile?: {
			render: (container: HTMLElement, options: Record<string, unknown>) => string
			reset: (widgetId?: string) => void
		}
	}
}

interface IPreviewTask {
	id: string
	name: string
	note?: string
	priority: 'high' | 'medium' | 'low'
	isCompleted: boolean
	column: 'today' | 'tomorrow'
	time: string
}

const INITIAL_TASKS: IPreviewTask[] = [
	{
		id: 'task-1',
		name: 'Запустить релиз Planner 2.0',
		note: 'Синхронизация с базой Supabase и проверка RLS политик',
		priority: 'high',
		isCompleted: true,
		column: 'today',
		time: 'Сегодня'
	},
	{
		id: 'task-2',
		name: 'Фокус-сессия: дыхание и Pomodoro',
		note: '25 минут глубокой концентрации без отвлечений',
		priority: 'high',
		isCompleted: false,
		column: 'today',
		time: 'Сегодня'
	},
	{
		id: 'task-3',
		name: 'Обзор спринта и подведение итогов',
		note: 'Анализ продуктивности за неделю',
		priority: 'medium',
		isCompleted: false,
		column: 'today',
		time: '18:00'
	},
	{
		id: 'task-4',
		name: 'Планирование архитектуры клиента',
		note: 'Оптимизация мобильных компонентов',
		priority: 'medium',
		isCompleted: false,
		column: 'tomorrow',
		time: 'Завтра'
	},
	{
		id: 'task-5',
		name: 'Дневник мыслей и рефлексия дня',
		note: 'Записать ключевые инсайты дня',
		priority: 'low',
		isCompleted: false,
		column: 'tomorrow',
		time: 'Завтра'
	}
]

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [captchaError, setCaptchaError] = useState('')
	const turnstileContainerRef = useRef<HTMLDivElement>(null)
	const turnstileWidgetIdRef = useRef<string>()

	// Интерактивное состояние задач для превью
	const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')
	const [tasks, setTasks] = useState<IPreviewTask[]>(INITIAL_TASKS)

	const toggleTask = (id: string) => {
		setTasks(prev =>
			prev.map(task =>
				task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
			)
		)
	}

	const todayTasks = tasks.filter(t => t.column === 'today')
	const tomorrowTasks = tasks.filter(t => t.column === 'tomorrow')
	const completedCount = tasks.filter(t => t.isCompleted).length
	const totalCount = tasks.length
	const progressPercent = Math.round((completedCount / totalCount) * 100)

	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

	const renderTurnstile = useCallback(() => {
		if (!siteKey) {
			setCaptchaError('Проверка безопасности не настроена. Вход временно недоступен.')
			return
		}
		if (!window.turnstile || !turnstileContainerRef.current || turnstileWidgetIdRef.current) return

		try {
			turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
				sitekey: siteKey,
				theme: 'dark',
				action: 'planner_login',
				callback: (token: string) => {
					setCaptchaError('')
					setTurnstileToken(token)
				},
				'expired-callback': () => setTurnstileToken(null),
				'error-callback': () => {
					setTurnstileToken(null)
					setCaptchaError('Не удалось загрузить проверку. Обновите страницу и попробуйте снова.')
				}
			})
		} catch {
			setCaptchaError('Не удалось загрузить проверку безопасности.')
		}
	}, [siteKey])

	const handleGoogleLogin = async () => {
		if (!turnstileToken) {
			toast.error('Сначала пройдите проверку безопасности.')
			return
		}
		setIsLoading(true)

		try {
			const response = await fetch('/api/auth/google', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ token: turnstileToken })
			})
			const result = await response.json()
			if (!response.ok || !result.url) {
				throw new Error(result.error || 'Не удалось начать вход через Google.')
			}
			window.location.assign(result.url)
		} catch (error: any) {
			toast.error(error?.message || 'Не удалось подключиться к сервису авторизации')
			setTurnstileToken(null)
			window.turnstile?.reset(turnstileWidgetIdRef.current)
			setIsLoading(false)
		}
	}

	return (
		<>
			{/* Скрипт Cloudflare Turnstile */}
			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
				onReady={renderTurnstile}
				onError={() => setCaptchaError('Не удалось загрузить проверку безопасности.')}
			/>

			<div className='min-h-screen w-full grid grid-cols-1 lg:grid-cols-12 bg-[#090A0A] text-white selection:bg-[#7551FF]/30 select-none'>
				{/* ========================================================================= */}
				{/* ЛЕВАЯ ЧАСТЬ: ИНТЕРАКТИВНОЕ ПРЕВЬЮ 1-В-1 С ПРИЛОЖЕНИЕМ PLANNER (DESKTOP)  */}
				{/* ========================================================================= */}
				<div className='hidden lg:flex lg:col-span-7 flex-col justify-between p-8 xl:p-12 bg-[#121314]/90 border-r border-white/[0.08] relative overflow-hidden'>
					{/* Атмосферный мягкий свет на фоне */}
					<div className='absolute -top-32 -right-32 w-[520px] h-[520px] bg-[#7551FF]/12 blur-[150px] pointer-events-none rounded-full' />
					<div className='absolute -bottom-24 -left-24 w-[400px] h-[400px] bg-purple-900/10 blur-[130px] pointer-events-none rounded-full' />

					{/* Верхняя шапка: Логотип и статус */}
					<div className='relative z-10 flex items-center justify-between'>
						<div className='flex items-center gap-3'>
							<div className='w-10 h-10 rounded-xl bg-[#7551FF]/15 border border-[#7551FF]/30 flex items-center justify-center shadow-inner'>
								<GanttChartSquare color='#7551FF' size={24} />
							</div>
							<div className='text-2xl font-bold tracking-tight relative'>
								Planner
								<span className='absolute -top-1 -right-7 text-[11px] text-[#7551FF] opacity-80 rotate-[14deg] font-mono font-medium px-1.5 py-0.5 rounded bg-[#7551FF]/10 border border-[#7551FF]/20'>
									beta
								</span>
							</div>
						</div>

						<div className='flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-white/50'>
							<span className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
							<span>Интерактивный показ</span>
						</div>
					</div>

					{/* Центральный блок: Аутентичный интерфейс задач */}
					<div className='relative z-10 my-auto py-6 max-w-2xl w-full mx-auto space-y-5'>
						<div>
							<h2 className='text-2xl xl:text-3xl font-semibold text-white tracking-tight mb-2'>
								Пространство фокуса и продуктивности
							</h2>
							<p className='text-sm text-white/50 leading-relaxed max-w-xl'>
								Переключайтесь между списком и канбан-доской, управляйте приоритетами и отслеживайте фокус в едином чистом интерфейсе.
							</p>
						</div>

						{/* Интерактивный витринный контейнер Planner */}
						<div className='rounded-2xl border border-white/[0.1] bg-[#0E0F0F] shadow-2xl backdrop-blur-xl overflow-hidden'>
							{/* Переключатель Табличка / Доска (1-в-1 с SwitcherView в реальном Planner) */}
							<div className='flex items-center justify-between px-5 pt-3 border-b border-white/[0.08] bg-[#141515]'>
								<div className='relative flex items-center'>
									<button
										type='button'
										onClick={() => setViewMode('list')}
										className={cn(
											'flex h-11 w-32 items-center justify-center gap-2 text-sm font-medium transition-all duration-200',
											viewMode === 'list'
												? 'text-white'
												: 'text-white/40 hover:text-white/70'
										)}
									>
										<ListTodo size={17} />
										<span>Список</span>
									</button>
									<button
										type='button'
										onClick={() => setViewMode('kanban')}
										className={cn(
											'flex h-11 w-32 items-center justify-center gap-2 text-sm font-medium transition-all duration-200',
											viewMode === 'kanban'
												? 'text-white'
												: 'text-white/40 hover:text-white/70'
										)}
									>
										<Kanban size={17} />
										<span>Доска</span>
									</button>
									{/* Скользящий фиолетовый индикатор */}
									<span
										className={cn(
											'pointer-events-none absolute bottom-0 h-0.5 bg-[#7551FF] transition-all duration-300 ease-out',
											viewMode === 'list' ? 'left-0 w-32' : 'left-32 w-32'
										)}
									/>
								</div>

								{/* Индикатор кликабельности */}
								<div className='hidden sm:flex items-center gap-2 text-xs text-white/40 font-mono'>
									<span className='text-[#8b6eff] font-medium'>{completedCount} из {totalCount}</span>
									<span>выполнено</span>
								</div>
							</div>

							{/* Прогресс-бар выполнения */}
							<div className='w-full bg-white/[0.04] h-1'>
								<div
									className='h-full bg-gradient-to-r from-[#7551FF] to-[#9b80ff] transition-all duration-300'
									style={{ width: `${progressPercent}%` }}
								/>
							</div>

							{/* Содержимое: Режим «Список» (Табличка) */}
							{viewMode === 'list' && (
								<div className='p-4 xl:p-5 space-y-4'>
									{/* Заголовок таблицы как в ListView */}
									<div className='grid grid-cols-[1.5fr_0.6fr_0.6fr] text-xs font-mono text-white/40 pb-2 border-b border-white/[0.06] px-2'>
										<div>НАЗВАНИЕ ЗАДАЧИ</div>
										<div>СРОК</div>
										<div>ПРИОРИТЕТ</div>
									</div>

									{/* Секция: Сегодня */}
									<div className='space-y-1.5'>
										<div className='text-xs font-semibold text-white/70 uppercase tracking-wider px-2 py-1 flex items-center justify-between'>
											<span>Сегодня</span>
											<span className='text-[11px] text-white/40 font-mono'>
												{todayTasks.filter(t => t.isCompleted).length} / {todayTasks.length}
											</span>
										</div>

										{todayTasks.map(task => (
											<div
												key={task.id}
												onClick={() => toggleTask(task.id)}
												className={cn(
													'grid grid-cols-[1.5fr_0.6fr_0.6fr] items-center p-2.5 rounded-xl border border-transparent transition-all duration-150 cursor-pointer group',
													task.isCompleted
														? 'bg-white/[0.015] opacity-50'
														: 'bg-[#141515] hover:bg-[#1a1c1d] hover:border-white/[0.08]'
												)}
											>
												<div className='flex items-center gap-3 min-w-0 pr-2'>
													<GripVertical
														size={15}
														className='text-white/20 group-hover:text-white/40 transition-colors shrink-0 -ml-1'
													/>
													<div
														className={cn(
															'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
															task.isCompleted
																? 'border-[#7551FF] bg-[#7551FF] text-white shadow-sm'
																: 'border-white/25 bg-transparent group-hover:border-white/50'
														)}
													>
														{task.isCompleted && <Check size={11} strokeWidth={3} />}
													</div>
													<div className='min-w-0 truncate'>
														<span
															className={cn(
																'text-sm truncate block',
																task.isCompleted
																	? 'line-through italic text-white/60'
																	: 'text-white font-medium'
															)}
														>
															{task.name}
														</span>
														{task.note && (
															<span className='text-xs text-white/35 truncate block'>
																{task.note}
															</span>
														)}
													</div>
												</div>

												{/* Срок */}
												<div className='text-xs text-white/50 font-mono flex items-center gap-1.5'>
													<Calendar size={13} className='text-white/30' />
													<span>{task.time}</span>
												</div>

												{/* Приоритет */}
												<div>
													<span
														className={cn(
															'text-xs px-2.5 py-0.5 rounded-md font-medium inline-block',
															task.priority === 'high' &&
																'bg-[#7551FF]/15 text-[#9b80ff] border border-[#7551FF]/30',
															task.priority === 'medium' &&
																'bg-amber-500/15 text-amber-300 border border-amber-500/30',
															task.priority === 'low' &&
																'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
														)}
													>
														{task.priority === 'high'
															? 'Высокий'
															: task.priority === 'medium'
																? 'Средний'
																: 'Низкий'}
													</span>
												</div>
											</div>
										))}
									</div>

									{/* Секция: Завтра (сжато) */}
									<div className='space-y-1.5 pt-2'>
										<div className='text-xs font-semibold text-white/70 uppercase tracking-wider px-2 py-1 flex items-center justify-between'>
											<span>Завтра</span>
											<span className='text-[11px] text-white/40 font-mono'>
												{tomorrowTasks.length} задач
											</span>
										</div>

										{tomorrowTasks.slice(0, 1).map(task => (
											<div
												key={task.id}
												onClick={() => toggleTask(task.id)}
												className={cn(
													'grid grid-cols-[1.5fr_0.6fr_0.6fr] items-center p-2.5 rounded-xl border border-transparent transition-all duration-150 cursor-pointer group',
													task.isCompleted
														? 'bg-white/[0.015] opacity-50'
														: 'bg-[#141515] hover:bg-[#1a1c1d] hover:border-white/[0.08]'
												)}
											>
												<div className='flex items-center gap-3 min-w-0 pr-2'>
													<GripVertical
														size={15}
														className='text-white/20 group-hover:text-white/40 transition-colors shrink-0 -ml-1'
													/>
													<div
														className={cn(
															'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
															task.isCompleted
																? 'border-[#7551FF] bg-[#7551FF] text-white shadow-sm'
																: 'border-white/25 bg-transparent group-hover:border-white/50'
														)}
													>
														{task.isCompleted && <Check size={11} strokeWidth={3} />}
													</div>
													<div className='min-w-0 truncate'>
														<span
															className={cn(
																'text-sm truncate block',
																task.isCompleted
																	? 'line-through italic text-white/60'
																	: 'text-white font-medium'
															)}
														>
															{task.name}
														</span>
													</div>
												</div>
												<div className='text-xs text-white/50 font-mono flex items-center gap-1.5'>
													<Calendar size={13} className='text-white/30' />
													<span>{task.time}</span>
												</div>
												<div>
													<span className='text-xs px-2.5 py-0.5 rounded-md font-medium inline-block bg-amber-500/15 text-amber-300 border border-amber-500/30'>
														Средний
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Содержимое: Режим «Доска» (Канбан) */}
							{viewMode === 'kanban' && (
								<div className='p-4 xl:p-5 grid grid-cols-2 gap-3.5'>
									{/* Колонка: Сегодня */}
									<div className='rounded-xl bg-[#141515] border border-white/[0.06] p-3 flex flex-col'>
										<div className='flex items-center justify-between pb-2 border-b border-white/[0.08] mb-3'>
											<span className='text-xs font-semibold uppercase tracking-wider text-white/80'>
												Сегодня
											</span>
											<span className='text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-[#8b6eff] font-mono'>
												{todayTasks.length}
											</span>
										</div>

										<div className='space-y-2.5 flex-1'>
											{todayTasks.map(task => (
												<div
													key={task.id}
													onClick={() => toggleTask(task.id)}
													className={cn(
														'p-3 rounded-lg border border-white/[0.08] bg-[#0E0F0F] transition-all duration-150 cursor-pointer hover:border-white/20 shadow-sm group',
														task.isCompleted ? 'opacity-50' : ''
													)}
												>
													<div className='flex items-start gap-2 mb-2'>
														<GripVertical
															size={14}
															className='text-white/20 group-hover:text-white/40 shrink-0 mt-0.5 -ml-1'
														/>
														<div
															className={cn(
																'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
																task.isCompleted
																	? 'border-[#7551FF] bg-[#7551FF] text-white shadow-sm'
																	: 'border-white/25 bg-transparent group-hover:border-white/50'
															)}
														>
															{task.isCompleted && <Check size={11} strokeWidth={3} />}
														</div>
														<span
															className={cn(
																'text-xs font-medium leading-snug',
																task.isCompleted
																	? 'line-through italic text-white/60'
																	: 'text-white'
															)}
														>
															{task.name}
														</span>
													</div>

													<div className='flex items-center justify-between pt-1.5 border-t border-white/[0.04] text-[11px] font-mono'>
														<span className='text-white/40'>{task.time}</span>
														<span
															className={cn(
																'px-2 py-0.5 rounded text-[10px] font-medium',
																task.priority === 'high' &&
																	'bg-[#7551FF]/15 text-[#9b80ff]',
																task.priority === 'medium' &&
																	'bg-amber-500/15 text-amber-300',
																task.priority === 'low' &&
																	'bg-emerald-500/15 text-emerald-300'
															)}
														>
															{task.priority === 'high' ? 'Высокий' : 'Средний'}
														</span>
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Колонка: Завтра */}
									<div className='rounded-xl bg-[#141515] border border-white/[0.06] p-3 flex flex-col'>
										<div className='flex items-center justify-between pb-2 border-b border-white/[0.08] mb-3'>
											<span className='text-xs font-semibold uppercase tracking-wider text-white/80'>
												Завтра
											</span>
											<span className='text-xs px-2 py-0.5 rounded-full bg-white/[0.05] text-white/50 font-mono'>
												{tomorrowTasks.length}
											</span>
										</div>

										<div className='space-y-2.5 flex-1'>
											{tomorrowTasks.map(task => (
												<div
													key={task.id}
													onClick={() => toggleTask(task.id)}
													className={cn(
														'p-3 rounded-lg border border-white/[0.08] bg-[#0E0F0F] transition-all duration-150 cursor-pointer hover:border-white/20 shadow-sm group',
														task.isCompleted ? 'opacity-50' : ''
													)}
												>
													<div className='flex items-start gap-2 mb-2'>
														<GripVertical
															size={14}
															className='text-white/20 group-hover:text-white/40 shrink-0 mt-0.5 -ml-1'
														/>
														<div
															className={cn(
																'w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors',
																task.isCompleted
																	? 'border-[#7551FF] bg-[#7551FF] text-white shadow-sm'
																	: 'border-white/25 bg-transparent group-hover:border-white/50'
															)}
														>
															{task.isCompleted && <Check size={11} strokeWidth={3} />}
														</div>
														<span
															className={cn(
																'text-xs font-medium leading-snug',
																task.isCompleted
																	? 'line-through italic text-white/60'
																	: 'text-white'
															)}
														>
															{task.name}
														</span>
													</div>

													<div className='flex items-center justify-between pt-1.5 border-t border-white/[0.04] text-[11px] font-mono'>
														<span className='text-white/40'>{task.time}</span>
														<span
															className={cn(
																'px-2 py-0.5 rounded text-[10px] font-medium',
																task.priority === 'high' &&
																	'bg-[#7551FF]/15 text-[#9b80ff]',
																task.priority === 'medium' &&
																	'bg-amber-500/15 text-amber-300',
																task.priority === 'low' &&
																	'bg-emerald-500/15 text-emerald-300'
															)}
														>
															{task.priority === 'medium' ? 'Средний' : 'Низкий'}
														</span>
													</div>
												</div>
											))}
										</div>
									</div>
								</div>
							)}

							{/* Нижняя плашка: Pomodoro-таймер (как в реальном Planner) */}
							<div className='px-5 py-3 border-t border-white/[0.06] bg-[#141515] flex items-center justify-between'>
								<div className='flex items-center gap-2.5 text-xs text-white/60'>
									<div className='w-6 h-6 rounded-md bg-[#7551FF]/15 flex items-center justify-center text-[#8b6eff]'>
										<Timer size={14} />
									</div>
									<span className='font-medium'>Pomodoro-сессия</span>
									<span className='text-white/30 hidden sm:inline'>• 25 мин фокус</span>
								</div>
								<div className='flex items-center gap-2'>
									<span className='text-xs font-mono text-white/70'>25:00</span>
									<span className='w-2 h-2 rounded-full bg-[#7551FF] animate-pulse' />
								</div>
							</div>
						</div>
					</div>

					{/* Футер левой колонки */}
					<div className='relative z-10 flex items-center justify-between text-xs text-white/30'>
						<span>&copy; 2026 Planner. Все права защищены.</span>
						<div className='flex items-center gap-4'>
							<span>Канбан</span>
							<span>•</span>
							<span>Pomodoro</span>
							<span>•</span>
							<span>Дыхание</span>
						</div>
					</div>
				</div>

				{/* ========================================================================= */}
				{/* ПРАВАЯ ЧАСТЬ + МОБИЛЬНЫЙ ОНБОРДИНГ: СТИЛЬНЫЙ ВХОД И ПРЕЗЕНТАЦИЯ          */}
				{/* ========================================================================= */}
				<div className='lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 xl:p-14 bg-[#090A0A] relative min-h-screen overflow-y-auto'>
					{/* Декоративное фоновое свечение справа */}
					<div className='absolute top-1/4 right-0 w-[420px] h-[420px] bg-[#7551FF]/10 blur-[140px] pointer-events-none rounded-full' />
					<div className='absolute bottom-10 left-10 w-[300px] h-[300px] bg-purple-900/10 blur-[110px] pointer-events-none rounded-full' />

					{/* МОБИЛЬНАЯ ВЕРХНЯЯ ШАПКА */}
					<div className='lg:hidden flex items-center justify-between mb-6'>
						<div className='flex items-center gap-2.5'>
							<div className='w-9 h-9 rounded-xl bg-[#7551FF]/15 border border-[#7551FF]/30 flex items-center justify-center'>
								<GanttChartSquare color='#7551FF' size={22} />
							</div>
							<span className='text-xl font-bold tracking-tight'>Planner</span>
							<span className='text-[10px] text-[#7551FF] font-mono px-1.5 py-0.5 rounded bg-[#7551FF]/10 border border-[#7551FF]/20'>
								beta
							</span>
						</div>
						<div className='flex items-center gap-1.5 text-xs text-white/40'>
							<span className='w-2 h-2 rounded-full bg-emerald-400' />
							<span>Онлайн</span>
						</div>
					</div>

					{/* МОБИЛЬНОЕ ИНТЕРАКТИВНОЕ ПРЕВЬЮ (для смартфонов: интерактивная карточка вместо пустоты) */}
					<div className='lg:hidden mb-6 p-4 rounded-2xl bg-[#141515] border border-white/[0.08] shadow-lg'>
						<div className='flex items-center justify-between pb-3 border-b border-white/[0.08] mb-3'>
							<div className='flex items-center gap-2'>
								<button
									type='button'
									onClick={() => setViewMode(viewMode === 'list' ? 'kanban' : 'list')}
									className='flex items-center gap-1.5 text-xs font-medium text-white/80 bg-white/[0.06] hover:bg-white/[0.1] px-2.5 py-1 rounded-lg transition-colors'
								>
									{viewMode === 'list' ? <ListTodo size={14} /> : <Kanban size={14} />}
									<span>{viewMode === 'list' ? 'Список' : 'Доска'}</span>
								</button>
								<span className='text-[11px] text-white/40'>Нажмите для переключения</span>
							</div>
							<span className='text-xs text-[#8b6eff] font-mono font-medium'>
								{completedCount}/{totalCount}
							</span>
						</div>

						{/* Одна интерактивная задача для быстрого теста на телефоне */}
						<div
							onClick={() => toggleTask('task-2')}
							className={cn(
								'p-3 rounded-xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3',
								tasks.find(t => t.id === 'task-2')?.isCompleted
									? 'bg-white/[0.02] border-white/[0.04] opacity-60'
									: 'bg-[#0E0F0F] border-white/[0.1]'
							)}
						>
							<div className='flex items-center gap-2.5 min-w-0'>
								<div
									className={cn(
										'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
										tasks.find(t => t.id === 'task-2')?.isCompleted
											? 'border-[#7551FF] bg-[#7551FF] text-white shadow-sm'
											: 'border-white/30 bg-transparent'
									)}
								>
									{tasks.find(t => t.id === 'task-2')?.isCompleted && (
										<Check size={11} strokeWidth={3} />
									)}
								</div>
								<div className='min-w-0'>
									<span
										className={cn(
											'text-xs font-medium block truncate',
											tasks.find(t => t.id === 'task-2')?.isCompleted
												? 'line-through italic text-white/60'
												: 'text-white'
										)}
									>
										Фокус-сессия: дыхание и Pomodoro
									</span>
									<span className='text-[10px] text-white/40 block'>
										Тапните, чтобы отметить выполнение
									</span>
								</div>
							</div>
							<span className='text-[10px] px-2 py-0.5 rounded bg-[#7551FF]/15 text-[#9b80ff] font-medium shrink-0'>
								Высокий
							</span>
						</div>
					</div>

					{/* ЦЕНТРАЛЬНАЯ КАРТОЧКА ВХОДА (ОБНОВЛЕННЫЙ ПРЕМИАЛЬНЫЙ ДИЗАЙН) */}
					<div className='w-full max-w-[460px] mx-auto my-auto'>
						<div className='rounded-3xl bg-[#141516]/90 border border-white/[0.1] p-7 sm:p-9 shadow-2xl backdrop-blur-2xl relative overflow-hidden'>
							{/* Верхняя акцентная светящаяся полоска */}
							<div className='absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#7551FF] to-transparent' />

							{/* Бейдж над заголовком */}
							<div className='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7551FF]/10 border border-[#7551FF]/25 text-xs text-[#a78bfa] font-medium mb-4'>
								<Sparkles size={13} className='text-[#7551FF]' />
								<span>Единое рабочее пространство</span>
							</div>

							{/* Заголовок формы */}
							<div className='mb-6'>
								<h1 className='text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2'>
									Вход в Planner
								</h1>
								<p className='text-sm text-white/50 leading-relaxed'>
									Авторизуйтесь через Google для мгновенной синхронизации ваших задач, заметок и таймера.
								</p>
							</div>

							{/* Преимущества / Безопасность в виде микро-карточек */}
							<div className='grid grid-cols-3 gap-2 mb-6'>
								<div className='flex flex-col items-center text-center p-2.5 rounded-xl bg-[#0e0f0f]/80 border border-white/[0.06]'>
									<ShieldCheck size={16} className='text-[#8b6eff] mb-1' />
									<span className='text-[11px] font-medium text-white/80'>Supabase</span>
									<span className='text-[10px] text-white/40'>RLS защита</span>
								</div>
								<div className='flex flex-col items-center text-center p-2.5 rounded-xl bg-[#0e0f0f]/80 border border-white/[0.06]'>
									<Zap size={16} className='text-amber-400 mb-1' />
									<span className='text-[11px] font-medium text-white/80'>Мгновенно</span>
									<span className='text-[10px] text-white/40'>Синхронизация</span>
								</div>
								<div className='flex flex-col items-center text-center p-2.5 rounded-xl bg-[#0e0f0f]/80 border border-white/[0.06]'>
									<Cloud size={16} className='text-emerald-400 mb-1' />
									<span className='text-[11px] font-medium text-white/80'>Облако</span>
									<span className='text-[10px] text-white/40'>Без паролей</span>
								</div>
							</div>

							{/* Cloudflare Turnstile CAPTCHA (аккуратно оформлена в рамку) */}
							<div className='w-full mb-4 flex flex-col items-center justify-center min-h-[72px] rounded-xl bg-[#0e0f0f]/90 border border-white/[0.08] p-2'>
								<div ref={turnstileContainerRef} id='turnstile-widget' />
								{captchaError && (
									<p role='alert' className='mt-2 text-xs text-red-300 text-center px-2'>
										{captchaError}
									</p>
								)}
							</div>

							{/* Кнопка входа Google с высокой контрастностью и микро-анимацией */}
							<button
								type='button'
								onClick={handleGoogleLogin}
								disabled={isLoading || !turnstileToken}
								style={{
									backgroundColor: '#FFFFFF',
									color: '#111827'
								}}
								className='w-full h-12 flex items-center justify-center gap-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98] shadow-[0_4px_18px_rgba(255,255,255,0.12)] hover:shadow-[0_6px_22px_rgba(255,255,255,0.18)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed px-5'
							>
								{isLoading ? (
									<div className='flex items-center gap-2.5'>
										<Loader2 size={18} className='animate-spin text-neutral-800' />
										<span className='font-semibold text-sm' style={{ color: '#111827' }}>
											Авторизация...
										</span>
									</div>
								) : (
									<>
										<svg className='w-5 h-5 flex-shrink-0' viewBox='0 0 24 24'>
											<path
												fill='#4285F4'
												d='M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z'
											/>
											<path
												fill='#34A853'
												d='M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z'
											/>
											<path
												fill='#FBBC05'
												d='M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z'
											/>
											<path
												fill='#EA4335'
												d='M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z'
											/>
										</svg>
										<span
											className='font-semibold text-sm tracking-tight'
											style={{ color: '#111827' }}
										>
											Продолжить с Google
										</span>
									</>
								)}
							</button>

							{/* Список ключевых возможностей под кнопкой */}
							<div className='mt-6 pt-5 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-white/40'>
								<span className='flex items-center gap-1'>
									<Kanban size={12} className='text-[#8b6eff]' /> Канбан
								</span>
								<span className='flex items-center gap-1'>
									<Timer size={12} className='text-[#8b6eff]' /> Pomodoro
								</span>
								<span className='flex items-center gap-1'>
									<Wind size={12} className='text-[#8b6eff]' /> Дыхание
								</span>
								<span className='flex items-center gap-1'>
									<Lock size={12} className='text-[#8b6eff]' /> Защита
								</span>
							</div>

							{/* Условия использования */}
							<p className='mt-4 text-[11px] text-white/30 text-center leading-relaxed'>
								Входя в Planner, вы принимаете условия использования и политику конфиденциальности сервиса.
							</p>
						</div>
					</div>

					{/* Нижняя строчка на мобильных устройствах */}
					<div className='lg:hidden text-center text-xs text-white/30 mt-6'>
						&copy; 2026 Planner. Все права защищены.
					</div>

					{/* Пустой блок на десктопе для идеальной вертикальной центровки карточки */}
					<div className='hidden lg:block' />
				</div>
			</div>
		</>
	)
}
