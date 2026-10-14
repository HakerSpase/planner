'use client'

import cn from 'clsx'
import {
	Check,
	ChevronDown,
	FileText,
	GanttChartSquare,
	GripVertical,
	Loader2,
	Trash
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

type TPriority = 'high' | 'medium' | 'low'

interface IPreviewTask {
	id: string
	name: string
	note?: string
	priority: TPriority
	isCompleted: boolean
	date: string
}

const PRIORITY_CYCLE: TPriority[] = ['low', 'medium', 'high']
const PRIORITY_LABEL: Record<TPriority, string> = {
	high: 'Высокий',
	medium: 'Средний',
	low: 'Низкий'
}

const INITIAL_TASKS: IPreviewTask[] = [
	{
		id: 't1',
		name: 'Собрать MVP для презентации',
		note: 'Подготовить демо-версию и протестировать основные сценарии',
		priority: 'high',
		isCompleted: false,
		date: '20 окт.'
	},
	{
		id: 't2',
		name: 'Ревью pull-request от команды',
		priority: 'medium',
		isCompleted: true,
		date: '18 окт.'
	},
	{
		id: 't3',
		name: 'Написать unit-тесты для API',
		priority: 'high',
		isCompleted: false,
		date: '19 окт.'
	},
	{
		id: 't4',
		name: 'Созвон с дизайнером по макетам',
		note: 'Обсудить новую навигацию и палитру цветов',
		priority: 'medium',
		isCompleted: false,
		date: '19 окт.'
	},
	{
		id: 't5',
		name: 'Обновить зависимости проекта',
		priority: 'low',
		isCompleted: false,
		date: '21 окт.'
	}
]

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [captchaError, setCaptchaError] = useState('')
	const turnstileContainerRef = useRef<HTMLDivElement>(null)
	const turnstileWidgetIdRef = useRef<string>()

	const [tasks, setTasks] = useState<IPreviewTask[]>(INITIAL_TASKS)
	const [dragId, setDragId] = useState<string | null>(null)

	const toggleTask = (id: string) => {
		setTasks(prev =>
			prev.map(t => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
		)
	}

	const cyclePriority = (e: React.MouseEvent, id: string) => {
		e.stopPropagation()
		setTasks(prev =>
			prev.map(t => {
				if (t.id !== id) return t
				const idx = PRIORITY_CYCLE.indexOf(t.priority)
				return { ...t, priority: PRIORITY_CYCLE[(idx + 1) % 3] }
			})
		)
	}

	const handleDragStart = (id: string) => setDragId(id)
	const handleDragOver = (e: React.DragEvent) => e.preventDefault()
	const handleDrop = (targetId: string) => {
		if (!dragId || dragId === targetId) return
		setTasks(prev => {
			const list = [...prev]
			const fromIdx = list.findIndex(t => t.id === dragId)
			const toIdx = list.findIndex(t => t.id === targetId)
			if (fromIdx < 0 || toIdx < 0) return prev
			const [moved] = list.splice(fromIdx, 1)
			list.splice(toIdx, 0, moved)
			return list
		})
		setDragId(null)
	}
	const handleDragEnd = () => setDragId(null)

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
				size: 'flexible',
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

	/* Строка задачи */
	const renderTaskRow = (task: IPreviewTask, compact = false) => (
		<div
			key={task.id}
			draggable
			onDragStart={() => handleDragStart(task.id)}
			onDragOver={handleDragOver}
			onDrop={() => handleDrop(task.id)}
			onDragEnd={handleDragEnd}
			className={cn(
				'grid border-t border-white/[0.08] transition-colors duration-100 cursor-grab active:cursor-grabbing',
				task.isCompleted && 'opacity-50',
				dragId === task.id && 'opacity-30 bg-[#1a1c1e]',
				dragId && dragId !== task.id && 'hover:bg-[#191b1d]'
			)}
			style={{
				gridTemplateColumns: compact
					? 'minmax(0,1fr) 5rem 6rem'
					: 'minmax(0,1.4fr) minmax(0,0.35fr) minmax(0,0.35fr) 2.8rem'
			}}
		>
			{/* Задача */}
			<div className={cn(
				'border-r border-white/[0.08] min-w-0 overflow-hidden flex flex-col gap-0.5',
				compact ? 'px-3 py-2.5' : 'px-4 py-3'
			)}>
				<div className='flex items-center gap-2.5 min-w-0'>
					<GripVertical size={16} className='text-white/15 shrink-0 -ml-0.5' />
					<div
						onClick={() => toggleTask(task.id)}
						className={cn(
							'w-[17px] h-[17px] shrink-0 border flex items-center justify-center transition-colors cursor-pointer',
							task.isCompleted
								? 'border-[#7551FF] bg-[#7551FF] text-white'
								: 'border-white/25 bg-transparent hover:border-white/50'
						)}
					>
						{task.isCompleted && <Check size={11} strokeWidth={3} />}
					</div>
					<span className={cn(
						'truncate min-w-0',
						compact ? 'text-[13px]' : 'text-sm',
						task.isCompleted ? 'line-through italic text-white/45' : 'text-white/90'
					)}>
						{task.name}
					</span>
				</div>
				{!compact && (
					<div className='pl-[34px] flex items-center gap-1.5 min-w-0'>
						<FileText size={13} className='text-white/30 shrink-0' />
						<span className='text-xs text-white/40 truncate'>
							{task.note || 'Добавить заметку'}
						</span>
					</div>
				)}
			</div>

			{/* Дата */}
			<div className='border-r border-white/[0.08] px-3 py-3 min-w-0 flex items-center whitespace-nowrap text-[13px] text-white/60'>
				<span className='truncate'>{task.date}</span>
			</div>

			{/* Приоритет */}
			<div className={cn(
				'px-3 py-3 min-w-0 flex items-center',
				!compact && 'border-r border-white/[0.08]'
			)}>
				<button
					type='button'
					onClick={e => cyclePriority(e, task.id)}
					className={cn(
						'px-2 py-[3px] text-xs font-semibold text-white inline-flex items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity',
						task.priority === 'high' && 'bg-red-400/60',
						task.priority === 'medium' && 'bg-orange-400/70',
						task.priority === 'low' && 'bg-blue-400/70'
					)}
				>
					{PRIORITY_LABEL[task.priority]}
					<ChevronDown size={12} className='opacity-50' />
				</button>
			</div>

			{/* Удалить */}
			{!compact && (
				<div className='px-2 py-3 flex items-center justify-center'>
					<Trash size={15} className='text-white/25' />
				</div>
			)}
		</div>
	)

	return (
		<>
			<style>{`
				@keyframes auroraShift {
					0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: .4; }
					33%  { transform: translate(40px, -30px) rotate(120deg) scale(1.15); opacity: .6; }
					66%  { transform: translate(-20px, 20px) rotate(240deg) scale(.95); opacity: .45; }
					100% { transform: translate(0, 0) rotate(360deg) scale(1); opacity: .4; }
				}
				@keyframes auroraShift2 {
					0%   { transform: translate(0, 0) rotate(0deg) scale(1); opacity: .35; }
					50%  { transform: translate(-35px, 25px) rotate(180deg) scale(1.1); opacity: .55; }
					100% { transform: translate(0, 0) rotate(360deg) scale(1); opacity: .35; }
				}
				@keyframes floatOrb {
					0%,100% { transform: translateY(0) scale(1); opacity: .3; }
					50%     { transform: translateY(-20px) scale(1.08); opacity: .5; }
				}
			`}</style>

			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
				onReady={renderTurnstile}
				onError={() => setCaptchaError('Не удалось загрузить проверку безопасности.')}
			/>

			<div className='min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#0E0F0F] text-white selection:bg-[#7551FF]/30'>
				{/* ===== ЛЕВАЯ: СПИСОК ЗАДАЧ (только desktop) ===== */}
				<div className='hidden lg:flex flex-col justify-between p-10 xl:p-14 bg-[#0E0F0F] border-r border-white/[0.08] relative overflow-hidden'>
					<div className='absolute top-0 right-0 w-[460px] h-[460px] bg-[#7551FF]/8 blur-[130px] pointer-events-none rounded-full' />

					{/* Логотип */}
					<div className='relative z-10 flex items-center gap-3'>
						<GanttChartSquare color='#7551FF' size={36} />
						<div className='text-2xl font-bold tracking-tight relative'>
							Planner
							<span className='absolute -top-1 -right-7 text-[11px] text-[#7551FF] opacity-70 rotate-[16deg] font-mono'>
								beta
							</span>
						</div>
					</div>

					{/* Задачи */}
					<div className='relative z-10 my-auto py-6 max-w-2xl w-full'>
						<div className='mb-5'>
							<h2 className='text-2xl font-semibold tracking-tight mb-1.5'>
								Пространство фокуса и продуктивности
							</h2>
							<p className='text-sm text-white/45 leading-relaxed'>
								Канбан-доска, список задач и тайм-блокинг в едином строгом интерфейсе.
							</p>
						</div>

						<div className='text-xl font-semibold py-2.5'>На этой неделе</div>

						<div className='w-full border-b border-white/[0.08]'>
							{tasks.map(t => renderTaskRow(t))}
						</div>

						<div className='text-xl font-semibold py-2.5 mt-3'>На следующей неделе</div>
						<div className='text-xs text-white/25 py-2 border-t border-white/[0.08]'>
							Добавить задачу...
						</div>
					</div>

					<div className='relative z-10 text-xs text-white/25'>
						&copy; 2026 Planner. Все права защищены.
					</div>
				</div>

				{/* ===== ПРАВАЯ: ВХОД + ФОН + МОБАЙЛ ===== */}
				<div className='flex flex-col p-6 sm:p-10 lg:p-14 bg-[#0E0F0F] relative overflow-hidden min-h-screen'>
					{/* Завораживающий минималистичный фон: мягкие aurora-градиенты */}
					<div className='absolute inset-0 pointer-events-none overflow-hidden select-none'>
						{/* Тонкая сетка-паттерн */}
						<div className='absolute inset-0 opacity-[0.03]' style={{
							backgroundImage: 'linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)',
							backgroundSize: '60px 60px'
						}} />

						{/* Главная aurora — большой размытый кольцевой градиент */}
						<div
							className='absolute top-[10%] left-[10%] w-[500px] h-[500px] rounded-full'
							style={{
								background: 'conic-gradient(from 0deg, rgba(117,81,255,0.25), rgba(99,102,241,0.15), rgba(168,85,247,0.2), rgba(117,81,255,0.25))',
								filter: 'blur(80px)',
								animation: 'auroraShift 18s linear infinite'
							}}
						/>
						{/* Вторая aurora */}
						<div
							className='absolute bottom-[5%] right-[5%] w-[400px] h-[400px] rounded-full'
							style={{
								background: 'conic-gradient(from 180deg, rgba(139,92,246,0.2), rgba(79,70,229,0.15), rgba(192,132,252,0.18), rgba(139,92,246,0.2))',
								filter: 'blur(70px)',
								animation: 'auroraShift2 14s linear infinite'
							}}
						/>

						{/* Парящие маленькие сферы — акценты */}
						<div
							className='absolute top-[25%] right-[30%] w-[120px] h-[120px] bg-[#7551FF]/25 blur-[50px] rounded-full'
							style={{ animation: 'floatOrb 6s ease-in-out infinite' }}
						/>
						<div
							className='absolute bottom-[35%] left-[25%] w-[90px] h-[90px] bg-indigo-500/20 blur-[40px] rounded-full'
							style={{ animation: 'floatOrb 8s ease-in-out infinite 2s' }}
						/>
						<div
							className='absolute top-[60%] right-[15%] w-[70px] h-[70px] bg-purple-400/15 blur-[35px] rounded-full'
							style={{ animation: 'floatOrb 7s ease-in-out infinite 4s' }}
						/>
					</div>

					{/* Мобильный логотип */}
					<div className='lg:hidden relative z-10 flex items-center gap-2.5 mb-5'>
						<GanttChartSquare color='#7551FF' size={30} />
						<span className='text-xl font-bold tracking-tight'>Planner</span>
						<span className='text-[10px] text-[#7551FF] font-mono opacity-70 ml-0.5'>beta</span>
					</div>

					{/* ===== МОБИЛЬНАЯ ВИТРИНА ЗАДАЧ ===== */}
					<div className='lg:hidden relative z-10 mb-auto border border-white/[0.08] bg-[#111213]/80 backdrop-blur-sm'>
						<div className='flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08]'>
							<span className='font-semibold text-white/70 uppercase tracking-wider text-xs'>На этой неделе</span>
							<span className='text-[#8b6eff] font-mono text-xs'>
								{tasks.filter(t => t.isCompleted).length}/{tasks.length}
							</span>
						</div>
						{tasks.slice(0, 3).map(t => renderTaskRow(t, true))}
						<div className='px-4 py-2 text-xs text-white/25 border-t border-white/[0.08]'>
							ещё {tasks.length - 3} задач...
						</div>
					</div>

					{/* ===== БЛОК ВХОДА (по центру) ===== */}
					<div className='relative z-10 w-full max-w-[380px] mx-auto my-auto flex flex-col items-center text-center py-8 lg:py-0'>
						<h1 className='text-3xl sm:text-[34px] font-semibold tracking-tight text-white mb-8'>
							Вход в Planner
						</h1>

						{/* Turnstile CAPTCHA — по полной ширине контейнера */}
						<div className='w-full mb-4 flex justify-center items-center min-h-[70px]'>
							<div ref={turnstileContainerRef} id='turnstile-widget' className='w-full' />
						</div>

						{captchaError && (
							<p role='alert' className='w-full mb-3 text-xs text-red-400 text-center leading-relaxed'>
								{captchaError}
							</p>
						)}

						{/* Кнопка Google — та же ширина */}
						<button
							type='button'
							onClick={handleGoogleLogin}
							disabled={isLoading || !turnstileToken}
							style={{ backgroundColor: '#FFFFFF', color: '#111827' }}
							className='w-full h-[52px] flex items-center justify-center gap-3 font-semibold text-sm transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed px-5'
						>
							{isLoading ? (
								<div className='flex items-center gap-2.5'>
									<Loader2 size={18} className='animate-spin text-neutral-800' />
									<span style={{ color: '#111827' }}>Авторизация...</span>
								</div>
							) : (
								<>
									<svg className='w-5 h-5 flex-shrink-0' viewBox='0 0 24 24'>
										<path fill='#4285F4' d='M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z' />
										<path fill='#34A853' d='M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z' />
										<path fill='#FBBC05' d='M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z' />
										<path fill='#EA4335' d='M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z' />
									</svg>
									<span style={{ color: '#111827' }}>Продолжить через Google</span>
								</>
							)}
						</button>
					</div>

					{/* Мобильный футер */}
					<div className='lg:hidden relative z-10 text-center text-[11px] text-white/25 mt-auto pt-4'>
						&copy; 2026 Planner
					</div>
					<div className='hidden lg:block' />
				</div>
			</div>
		</>
	)
}
