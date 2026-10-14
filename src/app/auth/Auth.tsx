'use client'

import cn from 'clsx'
import {
	Check,
	ChevronDown,
	FileText,
	GanttChartSquare,
	GripVertical,
	Loader2,
	Trash,
	X
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
	date: string
}

const INITIAL_TASKS: IPreviewTask[] = [
	{
		id: 'task-1',
		name: 'Исправь баги в этом планере',
		priority: 'medium',
		isCompleted: false,
		date: '18 октября 2026 г.'
	},
	{
		id: 'task-2',
		name: 'Сделать зарядку + дыхательную практику + поесть',
		priority: 'medium',
		isCompleted: false,
		date: '13 октября 2026 г.'
	},
	{
		id: 'task-3',
		name: 'Записаться выложить видео в тик ток/Ютуб',
		priority: 'medium',
		isCompleted: false,
		date: '13 октября 2026 г.'
	},
	{
		id: 'task-4',
		name: 'Как приду пройти урок по проф мату две штуки',
		priority: 'high',
		isCompleted: false,
		date: '13 октября 2026 г.'
	},
	{
		id: 'task-5',
		name: 'ОЛИМПИАДЫ',
		note: 'Посмотреть олимпиады в которых надо принять участие и пройти то что необходимо и состоит список и дедлайны для них',
		priority: 'high',
		isCompleted: false,
		date: '13 октября 2026 г.'
	},
	{
		id: 'task-6',
		name: 'Позаниматься английским языком СБ/Quizlet',
		priority: 'high',
		isCompleted: false,
		date: '13 октября 2026 г.'
	}
]

// Клеточные элементы для анимации переливания в фоне справа
const SHIMMER_CELLS = [
	{ x: 1, y: 1, delay: '0s', duration: '4s', grad: 'url(#shimmer-violet)' },
	{ x: 3, y: 3, delay: '1.2s', duration: '5s', grad: 'url(#shimmer-cyan)' },
	{ x: 2, y: 6, delay: '2.5s', duration: '4.5s', grad: 'url(#shimmer-fuchsia)' },
	{ x: 5, y: 1, delay: '0.8s', duration: '5.5s', grad: 'url(#shimmer-violet)' },
	{ x: 7, y: 2, delay: '2s', duration: '4.2s', grad: 'url(#shimmer-cyan)' },
	{ x: 6, y: 5, delay: '3.1s', duration: '5s', grad: 'url(#shimmer-fuchsia)' },
	{ x: 9, y: 2, delay: '1.4s', duration: '4.8s', grad: 'url(#shimmer-violet)' },
	{ x: 8, y: 7, delay: '2.8s', duration: '5.2s', grad: 'url(#shimmer-cyan)' },
	{ x: 10, y: 5, delay: '0.4s', duration: '4.6s', grad: 'url(#shimmer-fuchsia)' },
	{ x: 3, y: 8, delay: '1.8s', duration: '5.4s', grad: 'url(#shimmer-violet)' },
	{ x: 5, y: 9, delay: '3.4s', duration: '4.3s', grad: 'url(#shimmer-cyan)' },
	{ x: 1, y: 5, delay: '0.9s', duration: '4.9s', grad: 'url(#shimmer-fuchsia)' },
	{ x: 8, y: 10, delay: '2.2s', duration: '5.1s', grad: 'url(#shimmer-violet)' },
	{ x: 2, y: 11, delay: '1.6s', duration: '4.4s', grad: 'url(#shimmer-cyan)' },
	{ x: 7, y: 11, delay: '3s', duration: '5.6s', grad: 'url(#shimmer-fuchsia)' },
	{ x: 10, y: 9, delay: '0.7s', duration: '4.7s', grad: 'url(#shimmer-violet)' }
]

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [captchaError, setCaptchaError] = useState('')
	const turnstileContainerRef = useRef<HTMLDivElement>(null)
	const turnstileWidgetIdRef = useRef<string>()

	// Интерактивное состояние задач в превью
	const [tasks, setTasks] = useState<IPreviewTask[]>(INITIAL_TASKS)

	const toggleTask = (id: string) => {
		setTasks(prev =>
			prev.map(task =>
				task.id === id ? { ...task, isCompleted: !task.isCompleted } : task
			)
		)
	}

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
			{/* Стили анимации переливающихся клеток */}
			<style>{`
				@keyframes cellGlow {
					0%, 100% {
						opacity: 0.05;
						transform: scale(0.96);
					}
					50% {
						opacity: 0.85;
						transform: scale(1);
						filter: drop-shadow(0 0 12px rgba(117, 81, 255, 0.45));
					}
				}
				@keyframes ambientDrift {
					0%, 100% {
						transform: translate(0px, 0px) scale(1);
						opacity: 0.35;
					}
					50% {
						transform: translate(30px, -20px) scale(1.15);
						opacity: 0.65;
					}
				}
			`}</style>

			{/* Скрипт Cloudflare Turnstile */}
			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
				onReady={renderTurnstile}
				onError={() => setCaptchaError('Не удалось загрузить проверку безопасности.')}
			/>

			<div className='min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#0E0F0F] text-white selection:bg-[#7551FF]/30 select-none'>
				{/* ========================================================================= */}
				{/* ЛЕВАЯ ЧАСТЬ: ВИЗУАЛИЗАЦИЯ 1-В-1 С РЕАЛЬНЫМ ПРИЛОЖЕНИЕМ                    */}
				{/* ========================================================================= */}
				<div className='hidden lg:flex flex-col justify-between p-8 xl:p-12 bg-[#0E0F0F] border-r border-white/[0.08] relative overflow-hidden'>
					{/* Мягкий рассеянный фоновый свет */}
					<div className='absolute top-0 right-0 w-[500px] h-[500px] bg-[#7551FF]/8 blur-[130px] pointer-events-none rounded-full' />
					<div className='absolute bottom-0 left-0 w-[350px] h-[350px] bg-white/[0.02] blur-[100px] pointer-events-none rounded-full' />

					{/* Логотип: чистый значок + Planner beta */}
					<div className='relative z-10 flex items-center gap-3'>
						<GanttChartSquare color='#7551FF' size={34} />
						<div className='text-2xl font-bold tracking-tight relative'>
							Planner
							<span className='absolute -top-1 -right-6 text-xs text-[#7551FF] opacity-70 rotate-[18deg] font-mono font-normal'>
								beta
							</span>
						</div>
					</div>

					{/* Центральный блок: Реальная таблица задач как в приложении */}
					<div className='relative z-10 my-auto py-6 max-w-2xl w-full'>
						<div className='mb-5'>
							<h2 className='text-2xl font-semibold text-white tracking-tight mb-1.5'>
								Пространство фокуса и продуктивности
							</h2>
							<p className='text-sm text-white/50 leading-relaxed'>
								Канбан-доска, список задач и тайм-блокинг в едином строгом интерфейсе.
							</p>
						</div>

						{/* Заголовок группы: На этой неделе */}
						<div className='text-xl font-semibold text-white py-2.5'>
							На этой неделе
						</div>

						{/* Реальная таблица (с вертикальными границами между колонками, как в приложении) */}
						<div className='w-full border-b border-white/[0.08] bg-[#0E0F0F]'>
							{tasks.map(task => (
								<div
									key={task.id}
									onClick={() => toggleTask(task.id)}
									className={cn(
										'grid border-t border-white/[0.08] hover:bg-[#161818] transition-colors duration-150 cursor-pointer',
										task.isCompleted && 'opacity-50'
									)}
									style={{
										gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.4fr) minmax(0, 0.4fr) 3.5rem'
									}}
								>
									{/* Колонка 1: Задача + Заметка (не съезжает при длинном описании!) */}
									<div className='border-r border-white/[0.08] px-3 py-2.5 sm:px-4 min-w-0 overflow-hidden flex flex-col gap-1'>
										<div className='flex items-center gap-2.5 min-w-0'>
											<GripVertical size={16} className='text-white/20 shrink-0 -ml-1' />
											<div
												className={cn(
													'w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors',
													task.isCompleted
														? 'border-[#7551FF] bg-[#7551FF] text-white shadow-sm'
														: 'border-white/25 bg-transparent hover:border-white/50'
												)}
											>
												{task.isCompleted && <Check size={11} strokeWidth={3} />}
											</div>
											<span
												className={cn(
													'text-sm font-normal truncate block min-w-0',
													task.isCompleted ? 'line-through italic text-white/50' : 'text-white'
												)}
											>
												{task.name}
											</span>
										</div>

										{/* Блок заметки с иконкой FileText */}
										<div className='pl-6 flex items-start gap-1.5 min-w-0'>
											<FileText size={13} className='text-white/35 shrink-0 mt-0.5' />
											<span className='text-xs text-white/45 break-words line-clamp-2 leading-tight min-w-0'>
												{task.note || 'Добавить заметку'}
											</span>
										</div>
									</div>

									{/* Колонка 2: Срок */}
									<div className='border-r border-white/[0.08] px-3 py-2.5 sm:px-4 min-w-0 flex items-center justify-between whitespace-nowrap text-sm text-white/80'>
										<span className='truncate'>{task.date}</span>
										<X size={13} className='text-white/30 hover:text-white shrink-0 ml-1.5' />
									</div>

									{/* Колонка 3: Приоритет (Badge 1-в-1 с SingleSelect в приложении) */}
									<div className='border-r border-white/[0.08] px-3 py-2.5 sm:px-4 min-w-0 flex items-center justify-between whitespace-nowrap'>
										<div className='flex items-center gap-1.5'>
											<span
												className={cn(
													'px-2 py-0.5 text-xs font-semibold text-white rounded-sm inline-flex items-center gap-1',
													task.priority === 'high' && 'bg-red-400/60',
													task.priority === 'medium' && 'bg-orange-400/70',
													task.priority === 'low' && 'bg-blue-400/70'
												)}
											>
												<span>
													{task.priority === 'high'
														? 'Высокий'
														: task.priority === 'medium'
															? 'Средний'
															: 'Низкий'}
												</span>
												<ChevronDown size={13} className='opacity-60 shrink-0' />
											</span>
										</div>
										<X size={13} className='text-white/30 hover:text-white shrink-0 ml-1.5' />
									</div>

									{/* Колонка 4: Иконка удаления */}
									<div className='px-2 py-2.5 flex items-center justify-center'>
										<Trash size={16} className='text-white/35 hover:text-white transition-opacity' />
									</div>
								</div>
							))}
						</div>

						{/* Заголовок следующей секции (как в приложении) */}
						<div className='text-xl font-semibold text-white py-2.5 mt-3'>
							На следующей неделе
						</div>
						<div className='text-xs text-white/30 py-2 border-t border-white/[0.08]'>
							Добавить задачу...
						</div>
					</div>

					{/* Нижняя строчка копирайта */}
					<div className='relative z-10 text-xs text-white/30 font-normal'>
						&copy; 2026 Planner. Все права защищены.
					</div>
				</div>

				{/* ========================================================================= */}
				{/* ПРАВАЯ ЧАСТЬ: МАКСИМАЛЬНО ПРОСТОЙ ВХОД + ПЕРЕЛИВАЮЩИЙСЯ КЛЕТЧАТЫЙ ФОН    */}
				{/* ========================================================================= */}
				<div className='flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#0E0F0F] relative overflow-hidden'>
					{/* АНИМИРОВАННЫЕ КЛЕТЧАТЫЕ ПЕРЕЛИВАЮЩИЕСЯ ЭЛЕМЕНТЫ В ФОНЕ */}
					<div className='absolute inset-0 pointer-events-none overflow-hidden select-none'>
						{/* Плавающее градиентное свечение */}
						<div
							className='absolute top-1/4 right-1/4 w-[380px] h-[380px] bg-[#7551FF]/15 blur-[120px] rounded-full'
							style={{ animation: 'ambientDrift 10s ease-in-out infinite' }}
						/>
						<div
							className='absolute bottom-1/4 left-1/4 w-[320px] h-[320px] bg-purple-900/15 blur-[100px] rounded-full'
							style={{ animation: 'ambientDrift 12s ease-in-out infinite reverse' }}
						/>

						{/* Клетчатая сетка со светящимися переливающимися плитками */}
						<svg
							className='w-full h-full opacity-70'
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 520 600'
							preserveAspectRatio='none'
						>
							<defs>
								{/* Основная клетчатая сетка */}
								<pattern id='grid-pattern' width='44' height='44' patternUnits='userSpaceOnUse'>
									<path
										d='M 44 0 L 0 0 0 44'
										fill='none'
										stroke='rgba(255, 255, 255, 0.05)'
										strokeWidth='1'
									/>
								</pattern>

								{/* Переливающиеся градиенты для ячеек */}
								<linearGradient id='shimmer-violet' x1='0%' y1='0%' x2='100%' y2='100%'>
									<stop offset='0%' stopColor='#7551FF' stopOpacity='0.55' />
									<stop offset='100%' stopColor='#9333EA' stopOpacity='0.25' />
								</linearGradient>
								<linearGradient id='shimmer-cyan' x1='0%' y1='100%' x2='100%' y2='0%'>
									<stop offset='0%' stopColor='#6366F1' stopOpacity='0.5' />
									<stop offset='100%' stopColor='#38BDF8' stopOpacity='0.25' />
								</linearGradient>
								<linearGradient id='shimmer-fuchsia' x1='100%' y1='0%' x2='0%' y2='100%'>
									<stop offset='0%' stopColor='#C084FC' stopOpacity='0.45' />
									<stop offset='100%' stopColor='#7551FF' stopOpacity='0.2' />
								</linearGradient>

								{/* Маска мягкого затухания к краям */}
								<radialGradient id='grid-mask' cx='50%' cy='50%' r='50%'>
									<stop offset='20%' stopColor='white' stopOpacity='1' />
									<stop offset='100%' stopColor='white' stopOpacity='0' />
								</radialGradient>
								<mask id='radial-fade'>
									<rect width='100%' height='100%' fill='url(#grid-mask)' />
								</mask>
							</defs>

							{/* Сетка линий */}
							<rect width='100%' height='100%' fill='url(#grid-pattern)' mask='url(#radial-fade)' />

							{/* Переливающиеся сами по себе клетки */}
							<g mask='url(#radial-fade)'>
								{SHIMMER_CELLS.map((cell, idx) => (
									<rect
										key={idx}
										x={cell.x * 44 + 1}
										y={cell.y * 44 + 1}
										width={42}
										height={42}
										rx={2}
										fill={cell.grad}
										style={{
											animation: `cellGlow ${cell.duration} ease-in-out infinite ${cell.delay}`,
											transformOrigin: `${cell.x * 44 + 21}px ${cell.y * 44 + 21}px`
										}}
									/>
								))}
							</g>
						</svg>
					</div>

					{/* Мобильный логотип */}
					<div className='lg:hidden relative z-10 flex items-center gap-2.5 mb-10'>
						<GanttChartSquare color='#7551FF' size={30} />
						<span className='text-xl font-bold tracking-tight'>Planner</span>
					</div>

					{/* ЦЕНТРАЛЬНЫЙ БЛОК ВХОДА: ТОЛЬКО НАДПИСЬ, CLOUDFLARE И GOOGLE ОДИНАКОВОЙ ДЛИНЫ */}
					<div className='relative z-10 w-full max-w-[340px] mx-auto my-auto flex flex-col items-center text-center'>
						{/* Надпись Вход в Planner */}
						<h1 className='text-3xl font-semibold tracking-tight text-white mb-8'>
							Вход в Planner
						</h1>

						{/* Плашка Cloudflare Turnstile: ровно 300px */}
						<div className='w-[300px] mb-4 flex justify-center items-center min-h-[65px]'>
							<div ref={turnstileContainerRef} id='turnstile-widget' />
						</div>

						{captchaError && (
							<p role='alert' className='w-[300px] mb-4 text-xs text-red-400 text-center leading-relaxed'>
								{captchaError}
							</p>
						)}

						{/* Кнопка "Продолжить через Google": ровно 300px, одинаковая по длине */}
						<button
							type='button'
							onClick={handleGoogleLogin}
							disabled={isLoading || !turnstileToken}
							style={{
								backgroundColor: '#FFFFFF',
								color: '#111827'
							}}
							className='w-[300px] h-[48px] flex items-center justify-center gap-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed px-4'
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
										Продолжить через Google
									</span>
								</>
							)}
						</button>
					</div>

					{/* Пустой блок на десктопе для выравнивания */}
					<div className='hidden lg:block' />
				</div>
			</div>
		</>
	)
}
