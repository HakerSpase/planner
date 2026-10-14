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

// Сетка переливающихся клеток для фона справа
const CELLS = [
	{ x: 0, y: 0, d: '0s', dur: '3.6s', g: 0 },
	{ x: 2, y: 1, d: '0.6s', dur: '4.2s', g: 1 },
	{ x: 5, y: 0, d: '1.3s', dur: '3.8s', g: 2 },
	{ x: 7, y: 2, d: '0.3s', dur: '4.5s', g: 0 },
	{ x: 1, y: 3, d: '2s', dur: '3.5s', g: 1 },
	{ x: 4, y: 2, d: '0.9s', dur: '4s', g: 2 },
	{ x: 6, y: 4, d: '1.7s', dur: '3.9s', g: 0 },
	{ x: 3, y: 5, d: '2.4s', dur: '4.3s', g: 1 },
	{ x: 8, y: 1, d: '0.5s', dur: '3.7s', g: 2 },
	{ x: 1, y: 6, d: '1.1s', dur: '4.1s', g: 0 },
	{ x: 5, y: 5, d: '2.8s', dur: '3.4s', g: 1 },
	{ x: 8, y: 6, d: '0.2s', dur: '4.4s', g: 2 },
	{ x: 3, y: 7, d: '1.5s', dur: '3.6s', g: 0 },
	{ x: 6, y: 7, d: '2.2s', dur: '4.2s', g: 1 },
	{ x: 0, y: 5, d: '0.8s', dur: '3.8s', g: 2 },
	{ x: 7, y: 8, d: '1.9s', dur: '4s', g: 0 },
	{ x: 2, y: 8, d: '2.6s', dur: '3.5s', g: 1 },
	{ x: 4, y: 4, d: '0.4s', dur: '4.6s', g: 2 },
	{ x: 9, y: 3, d: '1.2s', dur: '3.9s', g: 0 },
	{ x: 9, y: 7, d: '2.1s', dur: '4.1s', g: 1 }
]

const CELL_SZ = 56 // размер ячейки в viewBox

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

	// Drag-and-drop: переупорядочивание задач
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

	/* Рендер одной строки задачи для переиспользования в десктоп и мобайл */
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
					? 'minmax(0,1fr) 4.5rem 5.5rem'
					: 'minmax(0,1.4fr) minmax(0,0.35fr) minmax(0,0.35fr) 2.8rem'
			}}
		>
			{/* Колонка: Задача */}
			<div className={cn(
				'border-r border-white/[0.08] px-2.5 py-2 min-w-0 overflow-hidden flex flex-col gap-0.5',
				compact ? 'sm:px-3' : 'sm:px-4'
			)}>
				<div className='flex items-center gap-2 min-w-0'>
					<GripVertical size={14} className='text-white/15 shrink-0 -ml-0.5' />
					<div
						onClick={() => toggleTask(task.id)}
						className={cn(
							'w-[15px] h-[15px] shrink-0 border flex items-center justify-center transition-colors cursor-pointer',
							task.isCompleted
								? 'border-[#7551FF] bg-[#7551FF] text-white'
								: 'border-white/25 bg-transparent hover:border-white/50'
						)}
					>
						{task.isCompleted && <Check size={10} strokeWidth={3} />}
					</div>
					<span className={cn(
						'text-[13px] truncate min-w-0',
						task.isCompleted ? 'line-through italic text-white/45' : 'text-white/90'
					)}>
						{task.name}
					</span>
				</div>
				{!compact && (
					<div className='pl-[30px] flex items-center gap-1.5 min-w-0'>
						<FileText size={12} className='text-white/30 shrink-0' />
						<span className='text-[11px] text-white/40 truncate'>
							{task.note || 'Добавить заметку'}
						</span>
					</div>
				)}
			</div>

			{/* Колонка: Дата */}
			<div className='border-r border-white/[0.08] px-2 py-2 min-w-0 flex items-center whitespace-nowrap text-[12px] text-white/60'>
				<span className='truncate'>{task.date}</span>
			</div>

			{/* Колонка: Приоритет */}
			<div className={cn(
				'px-2 py-2 min-w-0 flex items-center',
				!compact && 'border-r border-white/[0.08]'
			)}>
				<button
					type='button'
					onClick={e => cyclePriority(e, task.id)}
					className={cn(
						'px-1.5 py-[2px] text-[11px] font-semibold text-white inline-flex items-center gap-0.5 cursor-pointer hover:opacity-80 transition-opacity',
						task.priority === 'high' && 'bg-red-400/60',
						task.priority === 'medium' && 'bg-orange-400/70',
						task.priority === 'low' && 'bg-blue-400/70'
					)}
				>
					{PRIORITY_LABEL[task.priority]}
					<ChevronDown size={11} className='opacity-50' />
				</button>
			</div>

			{/* Колонка: Удалить (только на десктопе) */}
			{!compact && (
				<div className='px-1.5 py-2 flex items-center justify-center'>
					<Trash size={14} className='text-white/25' />
				</div>
			)}
		</div>
	)

	return (
		<>
			<style>{`
				@keyframes cellPulse {
					0%,100%{opacity:.04;transform:scale(.92)}
					50%{opacity:.7;transform:scale(1);filter:drop-shadow(0 0 18px rgba(117,81,255,.5))}
				}
				@keyframes orb {
					0%,100%{transform:translate(0,0) scale(1);opacity:.3}
					50%{transform:translate(25px,-18px) scale(1.12);opacity:.55}
				}
			`}</style>

			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
				onReady={renderTurnstile}
				onError={() => setCaptchaError('Не удалось загрузить проверку безопасности.')}
			/>

			<div className='min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#0E0F0F] text-white selection:bg-[#7551FF]/30'>
				{/* ============================================ */}
				{/* ЛЕВАЯ: СПИСОК ЗАДАЧ 1-В-1 (только desktop)    */}
				{/* ============================================ */}
				<div className='hidden lg:flex flex-col justify-between p-8 xl:p-12 bg-[#0E0F0F] border-r border-white/[0.08] relative overflow-hidden'>
					<div className='absolute top-0 right-0 w-[460px] h-[460px] bg-[#7551FF]/8 blur-[130px] pointer-events-none rounded-full' />

					{/* Логотип */}
					<div className='relative z-10 flex items-center gap-3'>
						<GanttChartSquare color='#7551FF' size={32} />
						<div className='text-[22px] font-bold tracking-tight relative'>
							Planner
							<span className='absolute -top-1 -right-6 text-[10px] text-[#7551FF] opacity-70 rotate-[16deg] font-mono'>
								beta
							</span>
						</div>
					</div>

					{/* Таблица задач */}
					<div className='relative z-10 my-auto py-4 max-w-2xl w-full'>
						<div className='mb-4'>
							<h2 className='text-[22px] font-semibold tracking-tight mb-1'>
								Пространство фокуса и продуктивности
							</h2>
							<p className='text-[13px] text-white/45 leading-relaxed'>
								Канбан-доска, список задач и тайм-блокинг в едином строгом интерфейсе.
							</p>
						</div>

						<div className='text-lg font-semibold py-2'>На этой неделе</div>

						<div className='w-full border-b border-white/[0.08]'>
							{tasks.map(t => renderTaskRow(t))}
						</div>

						<div className='text-lg font-semibold py-2 mt-2'>На следующей неделе</div>
						<div className='text-[12px] text-white/25 py-1.5 border-t border-white/[0.08]'>
							Добавить задачу...
						</div>
					</div>

					<div className='relative z-10 text-[11px] text-white/25'>
						&copy; 2026 Planner. Все права защищены.
					</div>
				</div>

				{/* ============================================ */}
				{/* ПРАВАЯ: ВХОД + КЛЕТЧАТЫЙ ФОН + МОБАЙЛ        */}
				{/* ============================================ */}
				<div className='flex flex-col justify-between p-6 sm:p-10 lg:p-14 bg-[#0E0F0F] relative overflow-hidden min-h-screen'>
					{/* Анимированный клетчатый фон */}
					<div className='absolute inset-0 pointer-events-none overflow-hidden select-none'>
						{/* Плавающие сферы свечения */}
						<div
							className='absolute top-[15%] right-[20%] w-[420px] h-[420px] bg-[#7551FF]/18 blur-[130px] rounded-full'
							style={{ animation: 'orb 9s ease-in-out infinite' }}
						/>
						<div
							className='absolute bottom-[20%] left-[15%] w-[350px] h-[350px] bg-purple-800/18 blur-[110px] rounded-full'
							style={{ animation: 'orb 11s ease-in-out infinite reverse' }}
						/>
						<div
							className='absolute top-[55%] right-[45%] w-[280px] h-[280px] bg-indigo-600/12 blur-[100px] rounded-full'
							style={{ animation: 'orb 13s ease-in-out infinite 2s' }}
						/>

						{/* SVG клетчатая сетка с мерцающими 3D-кубиками */}
						<svg
							className='w-full h-full'
							xmlns='http://www.w3.org/2000/svg'
							viewBox='0 0 560 560'
							preserveAspectRatio='xMidYMid slice'
						>
							<defs>
								<pattern id='g' width={CELL_SZ} height={CELL_SZ} patternUnits='userSpaceOnUse'>
									<path
										d={`M ${CELL_SZ} 0 L 0 0 0 ${CELL_SZ}`}
										fill='none'
										stroke='rgba(255,255,255,0.04)'
										strokeWidth='1'
									/>
								</pattern>

								<linearGradient id='gv' x1='0%' y1='0%' x2='100%' y2='100%'>
									<stop offset='0%' stopColor='#7551FF' stopOpacity='0.65' />
									<stop offset='100%' stopColor='#A78BFA' stopOpacity='0.3' />
								</linearGradient>
								<linearGradient id='gi' x1='0%' y1='100%' x2='100%' y2='0%'>
									<stop offset='0%' stopColor='#6366F1' stopOpacity='0.6' />
									<stop offset='100%' stopColor='#818CF8' stopOpacity='0.25' />
								</linearGradient>
								<linearGradient id='gf' x1='100%' y1='0%' x2='0%' y2='100%'>
									<stop offset='0%' stopColor='#C084FC' stopOpacity='0.55' />
									<stop offset='100%' stopColor='#7C3AED' stopOpacity='0.2' />
								</linearGradient>

								<radialGradient id='fm' cx='50%' cy='50%' r='52%'>
									<stop offset='15%' stopColor='white' stopOpacity='1' />
									<stop offset='100%' stopColor='white' stopOpacity='0' />
								</radialGradient>
								<mask id='rf'>
									<rect width='100%' height='100%' fill='url(#fm)' />
								</mask>
							</defs>

							<rect width='100%' height='100%' fill='url(#g)' mask='url(#rf)' />

							<g mask='url(#rf)'>
								{CELLS.map((c, i) => {
									const grads = ['url(#gv)', 'url(#gi)', 'url(#gf)']
									const cx = c.x * CELL_SZ + CELL_SZ / 2
									const cy = c.y * CELL_SZ + CELL_SZ / 2
									return (
										<rect
											key={i}
											x={c.x * CELL_SZ + 2}
											y={c.y * CELL_SZ + 2}
											width={CELL_SZ - 4}
											height={CELL_SZ - 4}
											rx={4}
											fill={grads[c.g]}
											style={{
												animation: `cellPulse ${c.dur} ease-in-out infinite ${c.d}`,
												transformOrigin: `${cx}px ${cy}px`
											}}
										/>
									)
								})}
							</g>
						</svg>
					</div>

					{/* Мобильный логотип */}
					<div className='lg:hidden relative z-10 flex items-center gap-2.5 mb-4'>
						<GanttChartSquare color='#7551FF' size={28} />
						<span className='text-lg font-bold tracking-tight'>Planner</span>
						<span className='text-[9px] text-[#7551FF] font-mono opacity-70 ml-0.5'>beta</span>
					</div>

					{/* ===== МОБИЛЬНАЯ МИНИ-ВИТРИНА ЗАДАЧ ===== */}
					<div className='lg:hidden relative z-10 mb-5 border border-white/[0.08] bg-[#111213]/80 backdrop-blur-sm'>
						<div className='flex items-center justify-between px-3 py-2 border-b border-white/[0.08] text-[12px] text-white/50'>
							<span className='font-semibold text-white/70 uppercase tracking-wider text-[11px]'>На этой неделе</span>
							<span className='text-[#8b6eff] font-mono'>
								{tasks.filter(t => t.isCompleted).length}/{tasks.length}
							</span>
						</div>
						{tasks.slice(0, 3).map(t => renderTaskRow(t, true))}
						<div className='px-3 py-1.5 text-[11px] text-white/25 border-t border-white/[0.08]'>
							ещё {tasks.length - 3} задач...
						</div>
					</div>

					{/* ===== БЛОК ВХОДА ===== */}
					<div className='relative z-10 w-full max-w-[340px] mx-auto my-auto flex flex-col items-center text-center'>
						<h1 className='text-[28px] sm:text-3xl font-semibold tracking-tight text-white mb-7'>
							Вход в Planner
						</h1>

						{/* Turnstile CAPTCHA — контейнер на полную ширину */}
						<div className='w-full mb-3.5 flex justify-center items-center min-h-[68px]'>
							<div ref={turnstileContainerRef} id='turnstile-widget' />
						</div>

						{captchaError && (
							<p role='alert' className='w-full mb-3 text-[11px] text-red-400 text-center leading-relaxed'>
								{captchaError}
							</p>
						)}

						{/* Кнопка Google — по ширине контейнера */}
						<button
							type='button'
							onClick={handleGoogleLogin}
							disabled={isLoading || !turnstileToken}
							style={{ backgroundColor: '#FFFFFF', color: '#111827' }}
							className='w-full h-[48px] flex items-center justify-center gap-3 font-semibold text-[13px] transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed px-5'
						>
							{isLoading ? (
								<div className='flex items-center gap-2.5'>
									<Loader2 size={17} className='animate-spin text-neutral-800' />
									<span style={{ color: '#111827' }}>Авторизация...</span>
								</div>
							) : (
								<>
									<svg className='w-[18px] h-[18px] flex-shrink-0' viewBox='0 0 24 24'>
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
					<div className='lg:hidden relative z-10 text-center text-[10px] text-white/25 mt-4'>
						&copy; 2026 Planner
					</div>
					<div className='hidden lg:block' />
				</div>
			</div>
		</>
	)
}
