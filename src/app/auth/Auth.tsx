'use client'

import cn from 'clsx'
import {
	ArrowUpRight,
	Bell,
	BookOpen,
	Calendar,
	Check,
	CheckSquare,
	Download,
	Globe,
	GripVertical,
	Laptop,
	LayoutGrid,
	Loader2,
	Pause,
	Play,
	RotateCcw,
	Smartphone,
	Timer,
	Volume2,
	Wind
} from 'lucide-react'
import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { nativePlugin } from '@/lib/native'

declare global {
	interface Window {
		turnstile?: {
			render: (
				container: HTMLElement,
				options: Record<string, unknown>
			) => string
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
	reminder: string
}

const PRIORITY_LABEL: Record<TPriority, string> = {
	high: 'Высокий',
	medium: 'Средний',
	low: 'Низкий'
}

const PRIORITY_DOT: Record<TPriority, string> = {
	high: 'bg-danger',
	medium: 'bg-warning',
	low: 'bg-sky-400'
}

const INITIAL_TASKS: IPreviewTask[] = [
	{
		id: 't1',
		name: 'Разобрать 15 вариантов Задания 2 в Архиве',
		note: 'Повторить карточки и проверить диаграмму частых ошибок',
		priority: 'high',
		isCompleted: false,
		date: 'Сегодня',
		reminder: '18.30, за 10 мин'
	},
	{
		id: 't2',
		name: 'Сессия глубокой работы по профильной математике',
		priority: 'high',
		isCompleted: true,
		date: 'Сегодня',
		reminder: '14.00, в момент'
	},
	{
		id: 't3',
		name: 'Добавить конспект по сочинительным союзам',
		note: 'Встроить схему и таблицу исключений в лист раздела',
		priority: 'medium',
		isCompleted: false,
		date: 'Завтра',
		reminder: '11.00, за 30 мин'
	},
	{
		id: 't4',
		name: 'Дыхательная практика Вим Хоф перед сном',
		priority: 'low',
		isCompleted: false,
		date: 'Сегодня',
		reminder: '22.00, за 5 мин'
	}
]

interface ITimeBlockDemo {
	id: string
	name: string
	duration: number
	color: string
}

const INITIAL_BLOCKS: ITimeBlockDemo[] = [
	{
		id: 'b1',
		name: 'Глубокая работа и задачи',
		duration: 4,
		color: '#7c5cff'
	},
	{
		id: 'b2',
		name: 'Архив, схемы и карточки',
		duration: 3,
		color: '#38bdf8'
	},
	{
		id: 'b3',
		name: 'Английский язык и практика',
		duration: 2,
		color: '#34d399'
	},
	{
		id: 'b4',
		name: 'Дыхание, прогулка и чтение',
		duration: 2,
		color: '#f59e0b'
	}
]

interface IBreathProtocolDemo {
	id: string
	name: string
	subtitle: string
	inhale: number
	hold: number
	exhale: number
}

const BREATH_PROTOCOLS: IBreathProtocolDemo[] = [
	{
		id: 'wim',
		name: 'Вим Хоф',
		subtitle: '30 глубоких вдохов и задержка от 30 до 90 секунд',
		inhale: 2,
		hold: 4,
		exhale: 2
	},
	{
		id: 'box',
		name: 'Квадратное дыхание',
		subtitle: 'Равные фазы по 4 секунды для снижения пульса',
		inhale: 4,
		hold: 4,
		exhale: 4
	},
	{
		id: 'coherent',
		name: 'Когерентный ритм',
		subtitle: 'Плавный вдох 5 секунд и выдох 5 секунд без пауз',
		inhale: 5,
		hold: 1,
		exhale: 5
	}
]

const MOOD_ITEMS = [
	{ value: 1, label: 'Тяжело', color: '#ef4444' },
	{ value: 2, label: 'Не очень', color: '#f97316' },
	{ value: 3, label: 'Нормально', color: '#eab308' },
	{ value: 4, label: 'Хорошо', color: '#22c55e' },
	{ value: 5, label: 'Отлично', color: '#7c5cff' }
]

const ARCHIVE_BARS = [
	{ label: 'Местоимения', value: 30 },
	{ label: 'Союзы', value: 25 },
	{ label: 'Вводные', value: 15 },
	{ label: 'Предлоги', value: 12 },
	{ label: 'Частицы', value: 10 },
	{ label: 'Наречия', value: 8 }
]

const FLASHCARDS = [
	{
		q: 'Какой падеж требуется после предлогов благодаря, согласно, вопреки?',
		a: 'Дательный падеж. Например, благодаря прогнозу, вопреки обстоятельствам.'
	},
	{
		q: 'Назови 3 самых частотных разряда местоимений в Задании 1.',
		a: 'Личные, указательные и определительные местоимения.'
	},
	{
		q: 'Какую роль играет частица же после первого слова предложения?',
		a: 'Выполняет функцию противительного союза со значением однако.'
	}
]

const SPECS = [
	{
		num: '842 КБ',
		title: 'Клиент для Windows',
		text: 'Нативное окно WebView2 со сворачиванием в системный трей и автозапуском вместе с системой. Доступны сборки 64 бита и 32 бита.'
	},
	{
		num: '10 голосов',
		title: 'Локальная речь Supertonic 3',
		text: 'Нейросетевая озвучка конспектов работает прямо в браузере через WebGPU и WASM. Скорость от 0.5x до 2.0x меняется без искажения тона.'
	},
	{
		num: '8 сцен',
		title: 'Процедурный звук Web Audio',
		text: 'Фоновый шум дождя, винила, костра, леса, волн и бинауральных ритмов генерируется в реальном времени без внешних аудиофайлов.'
	},
	{
		num: '16 практик',
		title: 'Дыхание и таблицы задержек',
		text: 'Циклические ритмы и 7 протоколов с задержками дыхания, голосовыми подсказками, метрономом и графиком за 14 дней.'
	}
]

type TStageTab = 'dashboard' | 'archive' | 'breathing' | 'blocking'

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const [captchaError, setCaptchaError] = useState('')
	const turnstileContainerRef = useRef<HTMLDivElement>(null)
	const turnstileWidgetIdRef = useRef<string>()

	// Interactive Stage (Live Desktop + Mobile UI simulator)
	const [stageTab, setStageTab] = useState<TStageTab>('dashboard')
	const [autoCycleStage, setAutoCycleStage] = useState<boolean>(true)
	const [revealedCards, setRevealedCards] = useState<Record<number, boolean>>({
		0: true
	})

	// Interactive Widget 1: Tasks
	const [tasks, setTasks] = useState<IPreviewTask[]>(INITIAL_TASKS)
	const [dragId, setDragId] = useState<string | null>(null)

	// Interactive Widget 2: Pomodoro & Time-blocking
	const [pomoPreset, setPomoPreset] = useState<number>(25)
	const [pomoSeconds, setPomoSeconds] = useState<number>(25 * 60)
	const [pomoRunning, setPomoRunning] = useState<boolean>(true)
	const [blocks, setBlocks] = useState<ITimeBlockDemo[]>(INITIAL_BLOCKS)

	// Interactive Widget 3: Breathing
	const [protocolIdx, setProtocolIdx] = useState<number>(0)
	const [breathPhase, setBreathPhase] = useState<'Вдох' | 'Задержка' | 'Выдох'>(
		'Вдох'
	)
	const [breathTick, setBreathTick] = useState<number>(0)

	// Interactive Widget 4: Mood & Charts
	const [mood, setMood] = useState<number>(5)
	const [activeBar, setActiveBar] = useState<number>(0)

	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		const error = params.get('error')
		if (error) {
			if (error === 'captcha_required') {
				toast.error(
					'Сессия проверки безопасности истекла. Подтвердите проверку и попробуйте снова.'
				)
			} else if (error === 'oauth_failed') {
				toast.error(
					'Не удалось завершить вход через Google. Попробуйте еще раз.'
				)
			} else if (error === 'access_denied') {
				toast.error('Вход через Google был отменен.')
			} else if (error === 'no_code') {
				toast.error(
					'Код авторизации не был получен от сервиса входа. Попробуйте снова.'
				)
			} else {
				toast.error(`Ошибка авторизации. Код ${error}`)
			}
			const newUrl = window.location.pathname
			window.history.replaceState({}, '', newUrl)
		}
	}, [])

	// Auto-cycle live stage tabs every 4.5s unless paused by user interaction
	useEffect(() => {
		if (!autoCycleStage) return
		const order: TStageTab[] = ['dashboard', 'archive', 'breathing', 'blocking']
		const timer = window.setInterval(() => {
			setStageTab(prev => order[(order.indexOf(prev) + 1) % order.length])
		}, 4500)
		return () => window.clearInterval(timer)
	}, [autoCycleStage])

	// Pomodoro countdown effect
	useEffect(() => {
		if (!pomoRunning) return
		const timer = window.setInterval(() => {
			setPomoSeconds(prev => (prev > 0 ? prev - 1 : pomoPreset * 60))
		}, 1000)
		return () => window.clearInterval(timer)
	}, [pomoRunning, pomoPreset])

	// Breathing phase cycle effect
	useEffect(() => {
		const protocol = BREATH_PROTOCOLS[protocolIdx]
		const total = protocol.inhale + protocol.hold + protocol.exhale
		const timer = window.setInterval(() => {
			setBreathTick(prev => {
				const next = (prev + 1) % total
				if (next < protocol.inhale) {
					setBreathPhase('Вдох')
				} else if (next < protocol.inhale + protocol.hold) {
					setBreathPhase('Задержка')
				} else {
					setBreathPhase('Выдох')
				}
				return next
			})
		}, 1000)
		return () => window.clearInterval(timer)
	}, [protocolIdx])

	const toggleTask = (id: string) => {
		setTasks(prev =>
			prev.map(t => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
		)
	}

	const cyclePriority = (id: string) => {
		const order: TPriority[] = ['low', 'medium', 'high']
		setTasks(prev =>
			prev.map(t => {
				if (t.id !== id) return t
				const next = order[(order.indexOf(t.priority) + 1) % order.length]
				return { ...t, priority: next }
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

	const adjustBlockDuration = (id: string, delta: number) => {
		setBlocks(prev =>
			prev.map(b =>
				b.id === id
					? { ...b, duration: Math.min(8, Math.max(1, b.duration + delta)) }
					: b
			)
		)
	}

	const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

	const renderTurnstile = useCallback(() => {
		if (!siteKey) {
			setCaptchaError(
				'Проверка безопасности не настроена. Вход временно недоступен.'
			)
			return
		}
		if (
			!window.turnstile ||
			!turnstileContainerRef.current ||
			turnstileWidgetIdRef.current
		)
			return
		try {
			turnstileWidgetIdRef.current = window.turnstile.render(
				turnstileContainerRef.current,
				{
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
						setCaptchaError(
							'Не удалось загрузить проверку. Обновите страницу и попробуйте снова.'
						)
					}
				}
			)
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
			const browser = nativePlugin('Browser')
			if (browser) {
				await browser.open({
					url: `${window.location.origin}/auth/callback/native?u=${encodeURIComponent(result.url)}`
				})
				setIsLoading(false)
				return
			}
			window.location.assign(result.url)
		} catch (error: any) {
			toast.error(
				error?.message || 'Не удалось подключиться к сервису авторизации'
			)
			setTurnstileToken(null)
			window.turnstile?.reset(turnstileWidgetIdRef.current)
			setIsLoading(false)
		}
	}

	const doneCount = tasks.filter(t => t.isCompleted).length
	const totalHours = blocks.reduce((acc, b) => acc + b.duration, 0)
	const pomoMin = String(Math.floor(pomoSeconds / 60)).padStart(2, '0')
	const pomoSec = String(pomoSeconds % 60).padStart(2, '0')
	const activeMoodItem =
		MOOD_ITEMS.find(m => m.value === mood) ?? MOOD_ITEMS[4]

	return (
		<>
			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
				onReady={renderTurnstile}
				onError={() =>
					setCaptchaError('Не удалось загрузить проверку безопасности.')
				}
			/>

			<div className='h-[100dvh] overflow-y-auto scroll-smooth bg-bg text-fg selection:bg-primary/30 selection:text-white'>
				{/* ===== ШАПКА ===== */}
				<header className='sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md'>
					<div className='mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-8'>
						<div className='flex items-center gap-3'>
							<span className='font-display text-[17px] font-semibold tracking-[-0.03em]'>
								Planner
							</span>
							<span className='border border-border bg-white/[0.02] px-1.5 py-0.5 font-mono text-2xs uppercase text-subtle'>
								v2.4
							</span>
						</div>

						<nav className='hidden items-center gap-6 md:flex'>
							<a
								href='#stage'
								className='font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg'
							>
								Интерфейс
							</a>
							<a
								href='#widgets'
								className='font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg'
							>
								Виджеты
							</a>
							<a
								href='#download'
								className='font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg'
							>
								Скачать
							</a>
						</nav>

						<div className='flex items-center gap-2 sm:gap-3'>
							<a
								href='#download'
								className='hidden border border-border px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-white/30 hover:text-fg sm:inline-flex'
							>
								Приложения
							</a>
							<a
								href='#login'
								className='inline-flex items-center gap-1.5 bg-primary px-3.5 py-1.5 font-mono text-xs font-medium uppercase tracking-wider text-white transition-opacity hover:opacity-90'
							>
								Войти
								<span aria-hidden>→</span>
							</a>
						</div>
					</div>
				</header>

				<main className='mx-auto max-w-[1280px] px-4 sm:px-8'>
					{/* ===== [ 00 ] ПЕРВЫЙ ЭКРАН И ВХОД ===== */}
					<section className='relative grid border-x border-border lg:grid-cols-12'>
						<div className='relative overflow-hidden border-b border-border px-5 py-12 sm:px-10 sm:py-16 lg:col-span-7 lg:border-r lg:py-20'>
							<div
								aria-hidden
								className='pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-[100px]'
							/>

							<div className='relative flex flex-wrap items-center gap-2'>
								<span className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
									[ 00 ] Рабочая среда
								</span>
								<span className='border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-2xs uppercase tracking-wider text-primary'>
									Windows · Android · Web
								</span>
							</div>

							<h1 className='relative mt-6 text-[2.35rem] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-6xl'>
								Планировщик, архив знаний и таймер фокуса в одном окне.
							</h1>

							<p className='relative mt-6 max-w-xl text-base leading-7 text-muted'>
								Задачи с напоминаниями, конспекты с диаграммами и карточками,
								тайм-блокинг, 16 дыхательных практик и локальная озвучка текста
								Supertonic 3. Данные синхронизируются между компьютером,
								телефоном и браузером.
							</p>

							{/* Быстрые кнопки скачивания и открытия сайта */}
							<div className='relative mt-8 flex flex-wrap items-center gap-3'>
								<a
									href='/downloads/Planner-x64.exe'
									download='Planner-x64.exe'
									className='inline-flex h-11 items-center gap-2.5 bg-fg px-5 text-sm font-semibold text-bg transition-colors hover:bg-white'
								>
									<Download size={16} />
									Windows 64 бит
									<span className='font-mono text-2xs opacity-60'>842 КБ</span>
								</a>

								<a
									href='/downloads/Planner-x86.exe'
									download='Planner-x86.exe'
									className='inline-flex h-11 items-center gap-2 border border-border bg-white/[0.02] px-4 text-sm font-medium text-fg transition-colors hover:border-white/30 hover:bg-white/[0.05]'
								>
									<Download size={15} className='text-muted' />
									Windows 32 бит
								</a>

								<a
									href='https://github.com/HakerSpase/planner/releases/download/android/Planner.apk'
									className='inline-flex h-11 items-center gap-2 border border-border bg-white/[0.02] px-4 text-sm font-medium text-fg transition-colors hover:border-white/30 hover:bg-white/[0.05]'
								>
									<Smartphone size={15} className='text-primary' />
									Android APK
								</a>

								<a
									href='https://mplanner-dun.vercel.app'
									className='inline-flex h-11 items-center gap-1.5 border border-border px-4 font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:border-white/30 hover:text-fg'
								>
									<Globe size={14} />
									mplanner-dun.vercel.app
								</a>
							</div>

							<div className='relative mt-8 grid grid-cols-2 gap-4 border-t border-border pt-6 sm:grid-cols-4'>
								<div>
									<p className='font-mono text-lg font-semibold text-fg'>
										842 КБ
									</p>
									<p className='mt-0.5 text-xs text-subtle'>
										клиент для Windows
									</p>
								</div>
								<div>
									<p className='font-mono text-lg font-semibold text-fg'>10</p>
									<p className='mt-0.5 text-xs text-subtle'>
										голосов Supertonic 3
									</p>
								</div>
								<div>
									<p className='font-mono text-lg font-semibold text-fg'>16</p>
									<p className='mt-0.5 text-xs text-subtle'>практик дыхания</p>
								</div>
								<div>
									<p className='font-mono text-lg font-semibold text-fg'>
										iOS нет
									</p>
									<p className='mt-0.5 text-xs text-subtle'>
										работа через браузер
									</p>
								</div>
							</div>
						</div>

						{/* Блок входа */}
						<div
							id='login'
							className='flex scroll-mt-14 flex-col justify-between border-b border-border bg-surface/40 px-5 py-10 sm:px-10 lg:col-span-5 lg:py-16'
						>
							<div>
								<div className='flex items-center justify-between'>
									<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
										Веб-версия и синхронизация
									</p>
									<span className='inline-flex items-center gap-1.5 font-mono text-2xs uppercase text-emerald-400'>
										<span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
										Онлайн
									</span>
								</div>

								<h2 className='mt-4 text-2xl font-semibold tracking-tight'>
									Войти в Planner
								</h2>
								<p className='mt-2 text-sm leading-6 text-muted'>
									Авторизуйтесь через аккаунт Google, чтобы открыть рабочее
									пространство в браузере или синхронизировать данные с
									приложением.
								</p>

								<div className='mt-7 flex min-h-[65px] w-full items-center'>
									<div
										ref={turnstileContainerRef}
										id='turnstile-widget'
										className='w-full'
									/>
								</div>

								{captchaError && (
									<p
										role='alert'
										className='mt-3 text-xs leading-relaxed text-danger'
									>
										{captchaError}
									</p>
								)}

								<button
									type='button'
									onClick={handleGoogleLogin}
									disabled={isLoading || !turnstileToken}
									className='mt-4 flex h-12 w-full items-center justify-between bg-fg px-5 text-sm font-semibold text-bg transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-35'
								>
									<span className='flex items-center gap-3'>
										{isLoading ? (
											<Loader2 size={18} className='animate-spin' />
										) : (
											<svg
												className='h-[18px] w-[18px] shrink-0'
												viewBox='0 0 24 24'
											>
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
										)}
										{isLoading ? 'Авторизация...' : 'Продолжить через Google'}
									</span>
									<span aria-hidden>→</span>
								</button>
							</div>

							<div className='mt-8 border-t border-border pt-4'>
								<p className='font-mono text-2xs uppercase tracking-wider text-subtle'>
									Защита Cloudflare Turnstile · Прямой адрес сайта{' '}
									<a
										href='https://mplanner-dun.vercel.app'
										className='text-fg underline underline-offset-4 hover:text-primary'
									>
										mplanner-dun.vercel.app
									</a>
								</p>
							</div>
						</div>
					</section>

					{/* ===== [ 01 ] ЖИВАЯ МОУШН-СЦЕНА ИНТЕРФЕЙСА НА ПК И ТЕЛЕФОНЕ ===== */}
					<section
						id='stage'
						className='scroll-mt-14 border-x border-b border-border'
					>
						<div className='flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-10'>
							<div>
								<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
									[ 01 ] Живой макет на компьютере и телефоне
								</p>
								<h2 className='mt-1 text-xl font-semibold tracking-tight sm:text-2xl'>
									Синхронный интерфейс для десктопа и мобильного экрана
								</h2>
							</div>

							<div className='flex flex-wrap items-center gap-1.5'>
								{(
									[
										{ id: 'dashboard', label: 'Главная' },
										{ id: 'archive', label: 'Архив и карточки' },
										{ id: 'breathing', label: 'Дыхание' },
										{ id: 'blocking', label: 'Тайм-блокинг' }
									] as const
								).map(tab => (
									<button
										key={tab.id}
										type='button'
										onClick={() => {
											setStageTab(tab.id)
											setAutoCycleStage(false)
										}}
										className={cn(
											'border px-3 py-1.5 font-mono text-2xs uppercase tracking-wider transition-all',
											stageTab === tab.id
												? 'border-primary bg-primary text-white'
												: 'border-border bg-surface text-muted hover:text-fg'
										)}
									>
										{tab.label}
									</button>
								))}
							</div>
						</div>

						{/* Две живые оболочки: окно ПК слева + экран смартфона справа */}
						<div className='grid gap-6 bg-[#070709] p-4 sm:p-8 lg:grid-cols-[1fr_290px] lg:items-stretch'>
							{/* Живое окно компьютера */}
							<div className='flex flex-col justify-between border border-border bg-bg shadow-[0_24px_80px_rgba(0,0,0,0.65)]'>
								{/* Верхняя панель окна ПК */}
								<div className='flex h-9 items-center justify-between border-b border-border bg-surface px-4'>
									<div className='flex items-center gap-2'>
										<span className='h-2 w-2 rounded-full bg-white/20' />
										<span className='h-2 w-2 rounded-full bg-white/20' />
										<span className='h-2 w-2 rounded-full bg-primary' />
										<span className='ml-2 font-mono text-2xs text-muted'>
											Planner Desktop · Windows
										</span>
									</div>
									<div className='flex items-center gap-3 font-mono text-2xs text-subtle'>
										<span className='hidden sm:inline'>Ctrl + K</span>
										<span className='text-primary'>● Звук активен</span>
									</div>
								</div>

								{/* Внутренняя сетка окна ПК */}
								<div className='grid min-h-[340px] flex-1 sm:grid-cols-[170px_1fr]'>
									{/* Боковое меню ПК */}
									<div className='hidden flex-col justify-between border-r border-border bg-surface/30 p-3 sm:flex'>
										<div className='space-y-1'>
											{[
												{
													id: 'dashboard' as const,
													label: 'Главная',
													icon: LayoutGrid
												},
												{
													id: 'archive' as const,
													label: 'Архив',
													icon: BookOpen
												},
												{
													id: 'breathing' as const,
													label: 'Дыхание',
													icon: Wind
												},
												{
													id: 'blocking' as const,
													label: 'Тайм-блокинг',
													icon: Calendar
												}
											].map(nav => {
												const Icon = nav.icon
												const active = stageTab === nav.id
												return (
													<button
														key={nav.id}
														type='button'
														onClick={() => {
															setStageTab(nav.id)
															setAutoCycleStage(false)
														}}
														className={cn(
															'flex w-full items-center gap-2.5 border-l-2 px-2.5 py-2 text-left text-xs transition-colors',
															active
																? 'border-primary bg-primary/10 font-medium text-fg'
																: 'border-transparent text-muted hover:text-fg'
														)}
													>
														<Icon
															size={13}
															className={active ? 'text-primary' : 'text-subtle'}
														/>
														{nav.label}
													</button>
												)
											})}
										</div>

										<div className='border-t border-border pt-2.5 font-mono text-2xs text-subtle'>
											Синхронизировано
										</div>
									</div>

									{/* Контент активного экрана на ПК */}
									<div className='p-4 sm:p-6'>
										{stageTab === 'dashboard' && (
											<div className='space-y-4'>
												<div className='flex items-center justify-between border-b border-border pb-3'>
													<div>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Сводка дня
														</p>
														<h3 className='text-base font-semibold'>
															Главная панель
														</h3>
													</div>
													<span className='border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-2xs text-primary'>
														Фокус {pomoMin}:{pomoSec}
													</span>
												</div>

												<div className='grid grid-cols-3 gap-2.5'>
													<div className='border border-border bg-surface/40 p-3'>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Всего задач
														</p>
														<p className='mt-1 font-mono text-2xl font-semibold'>
															{tasks.length}
														</p>
													</div>
													<div className='border border-border bg-surface/40 p-3'>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Выполнено
														</p>
														<p className='mt-1 font-mono text-2xl font-semibold text-primary'>
															{doneCount}
														</p>
													</div>
													<div className='border border-border bg-surface/40 p-3'>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Часов в плане
														</p>
														<p className='mt-1 font-mono text-2xl font-semibold'>
															{totalHours} ч
														</p>
													</div>
												</div>

												<div className='space-y-1.5'>
													{tasks.slice(0, 3).map(t => (
														<div
															key={t.id}
															onClick={() => toggleTask(t.id)}
															className='flex cursor-pointer items-center justify-between border border-border bg-surface/20 px-3 py-2 text-xs transition-colors hover:bg-white/[0.03]'
														>
															<div className='flex items-center gap-2.5 truncate'>
																<span
																	className={cn(
																		'grid h-3.5 w-3.5 shrink-0 place-items-center border',
																		t.isCompleted
																			? 'border-primary bg-primary text-white'
																			: 'border-white/30'
																	)}
																>
																	{t.isCompleted && (
																		<Check size={9} strokeWidth={3} />
																	)}
																</span>
																<span
																	className={cn(
																		'truncate',
																		t.isCompleted &&
																			'text-subtle line-through'
																	)}
																>
																	{t.name}
																</span>
															</div>
															<span className='font-mono text-2xs text-subtle'>
																{t.reminder}
															</span>
														</div>
													))}
												</div>
											</div>
										)}

										{stageTab === 'archive' && (
											<div className='space-y-4'>
												<div className='flex items-center justify-between border-b border-border pb-3'>
													<div>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Архив · ЕГЭ Русский · Задание 1
														</p>
														<h3 className='text-base font-semibold'>
															Карточки для самопроверки
														</h3>
													</div>
													<span className='font-mono text-2xs text-primary'>
														Нажмите на карточку
													</span>
												</div>

												<div className='space-y-2'>
													{FLASHCARDS.map((card, idx) => {
														const isOpen = !!revealedCards[idx]
														return (
															<button
																key={card.q}
																type='button'
																onClick={() =>
																	setRevealedCards(prev => ({
																		...prev,
																		[idx]: !prev[idx]
																	}))
																}
																className='w-full border border-border bg-surface/30 p-3 text-left transition-colors hover:border-white/25'
															>
																<p className='text-xs font-medium text-fg'>
																	{card.q}
																</p>
																<p
																	className={cn(
																		'mt-1.5 font-mono text-xs transition-all',
																		isOpen
																			? 'text-primary'
																			: 'select-none bg-white/10 text-transparent blur-[3px]'
																	)}
																>
																	{card.a}
																</p>
															</button>
														)
													})}
												</div>
											</div>
										)}

										{stageTab === 'breathing' && (
											<div className='space-y-4'>
												<div className='flex items-center justify-between border-b border-border pb-3'>
													<div>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Программы с задержками
														</p>
														<h3 className='text-base font-semibold'>
															{BREATH_PROTOCOLS[protocolIdx].name}
														</h3>
													</div>
													<span className='font-mono text-xs text-primary'>
														{breathPhase} · {breathTick + 1} с
													</span>
												</div>

												<div className='grid gap-4 sm:grid-cols-[140px_1fr] sm:items-center'>
													<div className='mx-auto flex h-32 w-32 items-center justify-center border border-border bg-surface/40'>
														<div
															className={cn(
																'flex h-20 w-20 flex-col items-center justify-center rounded-full border border-primary bg-primary/15 transition-transform duration-700',
																breathPhase === 'Вдох' && 'scale-110',
																breathPhase === 'Задержка' && 'scale-100',
																breathPhase === 'Выдох' && 'scale-75'
															)}
														>
															<span className='font-mono text-2xs uppercase text-primary'>
																{breathPhase}
															</span>
														</div>
													</div>
													<div className='space-y-2 text-xs text-muted'>
														<p className='text-fg'>
															{BREATH_PROTOCOLS[protocolIdx].subtitle}
														</p>
														<p>
															1. Вдох глубокий волной. Сначала живот, затем
															грудь.
														</p>
														<p>
															2. Выдох свободный без пауз. Таймер ведет фазы
															автоматически.
														</p>
													</div>
												</div>
											</div>
										)}

										{stageTab === 'blocking' && (
											<div className='space-y-4'>
												<div className='flex items-center justify-between border-b border-border pb-3'>
													<div>
														<p className='font-mono text-2xs uppercase text-subtle'>
															Распределение 24 часов
														</p>
														<h3 className='text-base font-semibold'>
															Тайм-блокинг дня
														</h3>
													</div>
													<span className='font-mono text-xs text-primary'>
														Занято {totalHours} ч
													</span>
												</div>

												<div className='flex h-4 w-full overflow-hidden border border-border bg-bg'>
													{blocks.map(b => (
														<div
															key={b.id}
															style={{
																width: `${(b.duration / 24) * 100}%`,
																backgroundColor: b.color
															}}
															className='h-full border-r border-bg transition-all duration-300'
														/>
													))}
												</div>

												<div className='grid gap-2 sm:grid-cols-2'>
													{blocks.map(b => (
														<div
															key={b.id}
															className='flex items-center justify-between border border-border bg-surface/30 px-3 py-2 text-xs'
														>
															<span className='flex items-center gap-2 truncate'>
																<span
																	className='h-2 w-2 shrink-0'
																	style={{ backgroundColor: b.color }}
																/>
																<span className='truncate'>{b.name}</span>
															</span>
															<span className='font-mono text-muted'>
																{b.duration} ч
															</span>
														</div>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							</div>

							{/* Живой экран телефона */}
							<div className='mx-auto flex w-full max-w-[290px] flex-col justify-between rounded-[24px] border border-white/15 bg-bg p-3 shadow-[0_24px_80px_rgba(0,0,0,0.75)]'>
								<div>
									<div className='flex items-center justify-between px-2 pb-2.5'>
										<span className='font-mono text-2xs text-subtle'>16.25</span>
										<span className='h-1.5 w-10 rounded-full bg-white/15' />
										<span className='font-mono text-2xs text-primary'>5G</span>
									</div>

									<div className='border border-border bg-surface/30 p-3'>
										<div className='flex items-center justify-between border-b border-border pb-2'>
											<span className='font-display text-xs font-semibold'>
												Planner
											</span>
											<span className='font-mono text-2xs uppercase text-primary'>
												Android
											</span>
										</div>

										<div className='mt-3 space-y-2'>
											<div className='border border-border bg-bg p-2.5'>
												<div className='flex items-center justify-between font-mono text-2xs text-subtle'>
													<span>POMODORO</span>
													<span className='text-primary'>АКТИВЕН</span>
												</div>
												<p className='mt-1 font-mono text-xl font-semibold tabular-nums'>
													{pomoMin}:{pomoSec}
												</p>
											</div>

											<div className='border border-border bg-bg p-2.5'>
												<p className='font-mono text-2xs uppercase text-subtle'>
													Настроение дня
												</p>
												<p
													className='mt-1 font-mono text-xs font-medium'
													style={{ color: activeMoodItem.color }}
												>
													● {activeMoodItem.label}
												</p>
											</div>

											<div className='border border-border bg-bg p-2.5'>
												<p className='font-mono text-2xs uppercase text-subtle'>
													Дыхание · {BREATH_PROTOCOLS[protocolIdx].name}
												</p>
												<p className='mt-1 font-mono text-xs text-fg'>
													Фаза {breathPhase} · {breathTick + 1} с
												</p>
											</div>
										</div>
									</div>
								</div>

								{/* Нижняя навигация смартфона */}
								<div className='mt-3 grid grid-cols-4 border border-border bg-surface/60 py-1.5 text-center font-mono text-[10px] text-muted'>
									{(
										[
											{ id: 'dashboard', label: 'Главная' },
											{ id: 'archive', label: 'Архив' },
											{ id: 'breathing', label: 'Дыхание' },
											{ id: 'blocking', label: 'Блоки' }
										] as const
									).map(m => (
										<button
											key={m.id}
											type='button'
											onClick={() => {
												setStageTab(m.id)
												setAutoCycleStage(false)
											}}
											className={cn(
												'py-1 transition-colors',
												stageTab === m.id
													? 'font-semibold text-primary'
													: 'text-subtle hover:text-fg'
											)}
										>
											{m.label}
										</button>
									))}
								</div>
							</div>
						</div>
					</section>

					{/* ===== [ 02 ] ИНТЕРАКТИВНЫЕ ВИДЖЕТЫ ===== */}
					<section
						id='widgets'
						className='scroll-mt-14 border-x border-b border-border'
					>
						<div className='flex flex-col gap-2 border-b border-border px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-10'>
							<div>
								<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
									[ 02 ] Живые виджеты интерфейса
								</p>
								<h2 className='mt-1 text-xl font-semibold tracking-tight sm:text-2xl'>
									Испытайте модули программы в действии
								</h2>
							</div>
							<p className='font-mono text-xs text-muted'>
								Все 4 виджета ниже полностью интерактивны
							</p>
						</div>

						<div className='grid lg:grid-cols-12'>
							{/* Виджет 1: Задачи и напоминания */}
							<div className='border-b border-border p-5 sm:p-8 lg:col-span-7 lg:border-r'>
								<div className='flex items-center justify-between pb-4'>
									<span className='font-mono text-xs uppercase tracking-wider text-primary'>
										01 · Задачи и напоминания
									</span>
									<span className='font-mono text-xs tabular-nums text-muted'>
										Выполнено {doneCount} из {tasks.length}
									</span>
								</div>

								<p className='mb-4 text-xs text-muted'>
									Перетаскивайте задачи мышью, отмечайте выполнение и меняйте
									приоритет нажатием на индикатор.
								</p>

								<ul className='border border-border bg-surface/40'>
									{tasks.map((task, index) => (
										<li
											key={task.id}
											draggable
											onDragStart={() => handleDragStart(task.id)}
											onDragOver={handleDragOver}
											onDrop={() => handleDrop(task.id)}
											onDragEnd={handleDragEnd}
											className={cn(
												'group grid cursor-grab grid-cols-[1.25rem_1.25rem_minmax(0,1fr)_auto] items-center gap-x-2.5 border-b border-border px-3.5 py-3 transition-colors last:border-b-0 hover:bg-white/[0.03] active:cursor-grabbing sm:grid-cols-[1.25rem_1.25rem_minmax(0,1fr)_auto_auto]',
												dragId === task.id && 'opacity-30'
											)}
										>
											<GripVertical
												size={14}
												className='text-subtle transition-colors group-hover:text-muted'
											/>
											<button
												type='button'
												aria-label={
													task.isCompleted
														? 'Отметить как невыполненную'
														: 'Отметить как выполненную'
												}
												onClick={() => toggleTask(task.id)}
												className={cn(
													'grid h-4 w-4 place-items-center border transition-colors',
													task.isCompleted
														? 'border-primary bg-primary text-white'
														: 'border-white/30 hover:border-primary'
												)}
											>
												{task.isCompleted && (
													<Check size={11} strokeWidth={3} />
												)}
											</button>
											<div className='min-w-0'>
												<p
													className={cn(
														'truncate text-sm',
														task.isCompleted
															? 'text-subtle line-through'
															: 'text-fg'
													)}
												>
													{String(index + 1).padStart(2, '0')}. {task.name}
												</p>
												{task.note && (
													<p className='mt-0.5 truncate text-xs text-subtle'>
														{task.note}
													</p>
												)}
											</div>

											<span className='hidden items-center gap-1 border border-border bg-bg px-2 py-0.5 font-mono text-2xs text-muted sm:inline-flex'>
												<Bell size={10} className='text-primary' />
												{task.reminder}
											</span>

											<button
												type='button'
												onClick={() => cyclePriority(task.id)}
												title='Нажмите для смены приоритета'
												className='flex items-center gap-1.5 border border-transparent px-2 py-0.5 text-xs text-muted transition-colors hover:border-border hover:text-fg'
											>
												<span
													className={cn(
														'h-1.5 w-1.5',
														PRIORITY_DOT[task.priority]
													)}
												/>
												{PRIORITY_LABEL[task.priority]}
											</button>
										</li>
									))}
								</ul>
							</div>

							{/* Виджет 2: Pomodoro и тайм-блокинг */}
							<div className='border-b border-border p-5 sm:p-8 lg:col-span-5'>
								<div className='flex items-center justify-between pb-4'>
									<span className='font-mono text-xs uppercase tracking-wider text-primary'>
										02 · Pomodoro и тайм-блокинг
									</span>
									<span className='font-mono text-xs tabular-nums text-muted'>
										Занято {totalHours} ч из 24 ч
									</span>
								</div>

								<div className='flex flex-wrap items-center justify-between gap-4 border border-border bg-surface/50 p-4'>
									<div>
										<p className='font-mono text-2xs uppercase tracking-wider text-subtle'>
											Таймер фокуса
										</p>
										<p className='mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight'>
											{pomoMin}:{pomoSec}
										</p>
									</div>

									<div className='flex items-center gap-1.5'>
										{[25, 50, 15].map(min => (
											<button
												key={min}
												type='button'
												onClick={() => {
													setPomoPreset(min)
													setPomoSeconds(min * 60)
												}}
												className={cn(
													'border px-2.5 py-1 font-mono text-xs transition-colors',
													pomoPreset === min
														? 'border-primary bg-primary/15 text-fg'
														: 'border-border text-muted hover:text-fg'
												)}
											>
												{min}м
											</button>
										))}
										<button
											type='button'
											onClick={() => setPomoRunning(r => !r)}
											className='inline-flex h-8 w-8 items-center justify-center bg-primary text-white transition-opacity hover:opacity-90'
											aria-label={pomoRunning ? 'Пауза' : 'Старт'}
										>
											{pomoRunning ? <Pause size={14} /> : <Play size={14} />}
										</button>
										<button
											type='button'
											onClick={() => setPomoSeconds(pomoPreset * 60)}
											className='inline-flex h-8 w-8 items-center justify-center border border-border text-muted transition-colors hover:text-fg'
											aria-label='Сброс'
										>
											<RotateCcw size={13} />
										</button>
									</div>
								</div>

								<div className='mt-4'>
									<div className='flex h-3 w-full overflow-hidden border border-border bg-bg'>
										{blocks.map(block => (
											<div
												key={block.id}
												style={{
													width: `${(block.duration / 24) * 100}%`,
													backgroundColor: block.color
												}}
												className='h-full border-r border-bg transition-all duration-300'
											/>
										))}
									</div>

									<div className='mt-3 space-y-2'>
										{blocks.map(block => (
											<div
												key={block.id}
												className='flex items-center justify-between border border-border bg-surface/30 px-3 py-2 text-xs'
											>
												<div className='flex items-center gap-2.5 truncate'>
													<span
														className='h-2.5 w-2.5 shrink-0'
														style={{ backgroundColor: block.color }}
													/>
													<span className='truncate text-fg'>{block.name}</span>
												</div>
												<div className='flex items-center gap-1.5 font-mono'>
													<button
														type='button'
														onClick={() => adjustBlockDuration(block.id, -1)}
														className='h-5 w-5 border border-border text-muted hover:text-fg'
													>
														-
													</button>
													<span className='w-8 text-center tabular-nums text-fg'>
														{block.duration} ч
													</span>
													<button
														type='button'
														onClick={() => adjustBlockDuration(block.id, 1)}
														className='h-5 w-5 border border-border text-muted hover:text-fg'
													>
														+
													</button>
												</div>
											</div>
										))}
									</div>
								</div>
							</div>

							{/* Виджет 3: Дыхание и задержки */}
							<div className='border-b border-border p-5 sm:p-8 lg:col-span-6 lg:border-b-0 lg:border-r'>
								<div className='flex items-center justify-between pb-4'>
									<span className='font-mono text-xs uppercase tracking-wider text-primary'>
										03 · Практики дыхания и задержки
									</span>
									<span className='inline-flex items-center gap-1.5 font-mono text-xs text-muted'>
										<Wind size={13} className='text-primary' />
										16 режимов
									</span>
								</div>

								<div className='grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center'>
									<div className='relative mx-auto flex h-40 w-40 items-center justify-center border border-border bg-surface/40'>
										<div
											className={cn(
												'flex h-28 w-28 flex-col items-center justify-center rounded-full border border-primary/50 bg-primary/10 transition-transform duration-1000',
												breathPhase === 'Вдох' && 'scale-105',
												breathPhase === 'Задержка' && 'scale-100',
												breathPhase === 'Выдох' && 'scale-75'
											)}
										>
											<span className='font-mono text-xs uppercase tracking-wider text-primary'>
												{breathPhase}
											</span>
											<span className='mt-1 font-mono text-lg font-semibold tabular-nums text-fg'>
												{breathTick + 1} с
											</span>
										</div>
									</div>

									<div className='space-y-2'>
										{BREATH_PROTOCOLS.map((p, idx) => (
											<button
												key={p.id}
												type='button'
												onClick={() => {
													setProtocolIdx(idx)
													setBreathTick(0)
												}}
												className={cn(
													'w-full border p-3 text-left transition-colors',
													protocolIdx === idx
														? 'border-primary bg-primary/10'
														: 'border-border bg-surface/30 hover:border-white/25'
												)}
											>
												<div className='flex items-center justify-between'>
													<span className='text-sm font-medium text-fg'>
														{p.name}
													</span>
													<span className='font-mono text-2xs text-primary'>
														{p.inhale}·{p.hold}·{p.exhale} с
													</span>
												</div>
												<p className='mt-1 text-xs text-muted'>{p.subtitle}</p>
											</button>
										))}
									</div>
								</div>
							</div>

							{/* Виджет 4: Настроение, Архив и Звук */}
							<div className='p-5 sm:p-8 lg:col-span-6'>
								<div className='flex items-center justify-between pb-4'>
									<span className='font-mono text-xs uppercase tracking-wider text-primary'>
										04 · Настроение, графики и озвучка
									</span>
									<span className='inline-flex items-center gap-1.5 font-mono text-xs text-muted'>
										<Volume2 size={13} className='text-primary' />
										Supertonic 3
									</span>
								</div>

								<div className='flex flex-wrap items-center justify-between gap-3 border border-border bg-surface/40 px-4 py-3'>
									<span className='font-mono text-xs text-muted'>
										Самочувствие в дневнике мыслей
									</span>
									<div className='flex items-center gap-2'>
										<div className='flex items-center gap-1'>
											{MOOD_ITEMS.map(item => (
												<button
													key={item.value}
													type='button'
													onClick={() => setMood(item.value)}
													className='grid h-6 w-6 place-items-center'
													aria-label={item.label}
												>
													<span
														className='rounded-full transition-all'
														style={{
															width: mood === item.value ? 12 : 7,
															height: mood === item.value ? 12 : 7,
															backgroundColor:
																mood === item.value
																	? item.color
																	: 'rgba(255,255,255,0.22)'
														}}
													/>
												</button>
											))}
										</div>
										<span
											className='inline-grid min-w-[78px] text-right font-mono text-xs font-medium'
											style={{ color: activeMoodItem.color }}
										>
											{activeMoodItem.label}
										</span>
									</div>
								</div>

								<div className='mt-4 border border-border bg-surface/30 p-4'>
									<div className='flex items-center justify-between text-xs'>
										<span className='text-muted'>
											Интерактивная диаграмма из конспекта Архива
										</span>
										<span className='font-mono text-primary'>
											{ARCHIVE_BARS[activeBar].label} ·{' '}
											{ARCHIVE_BARS[activeBar].value}%
										</span>
									</div>

									<div className='mt-4 grid h-24 grid-cols-6 items-end gap-2'>
										{ARCHIVE_BARS.map((bar, idx) => (
											<button
												key={bar.label}
												type='button'
												onMouseEnter={() => setActiveBar(idx)}
												onClick={() => setActiveBar(idx)}
												className='group flex h-full flex-col items-center justify-end'
											>
												<span className='mb-1 font-mono text-2xs tabular-nums text-muted group-hover:text-fg'>
													{bar.value}%
												</span>
												<span
													style={{ height: `${bar.value * 2.1}px` }}
													className={cn(
														'w-full transition-colors',
														activeBar === idx
															? 'bg-primary'
															: 'bg-primary/45 group-hover:bg-primary/75'
													)}
												/>
											</button>
										))}
									</div>
								</div>
							</div>
						</div>
					</section>

					{/* ===== [ 03 ] ТЕХНИЧЕСКИЕ ХАРАКТЕРИСТИКИ ===== */}
					<section className='grid border-x border-b border-border sm:grid-cols-2 lg:grid-cols-4'>
						{SPECS.map((item, idx) => (
							<div
								key={item.title}
								className='border-b border-border px-5 py-8 last:border-b-0 sm:px-8 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0'
							>
								<div className='flex items-center justify-between'>
									<span className='font-mono text-xs text-subtle'>
										0{idx + 1}
									</span>
									<span className='font-mono text-xs font-semibold text-primary'>
										{item.num}
									</span>
								</div>
								<h3 className='mt-5 text-base font-semibold'>{item.title}</h3>
								<p className='mt-2 text-xs leading-5 text-muted'>{item.text}</p>
							</div>
						))}
					</section>

					{/* ===== [ 04 ] СКАЧАТЬ ПРОГРАММУ И ПЛАТФОРМЫ ===== */}
					<section
						id='download'
						className='scroll-mt-14 border-x border-b border-border'
					>
						<div className='border-b border-border px-5 py-6 sm:px-10'>
							<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
								[ 03 ] Загрузка и платформы
							</p>
							<h2 className='mt-1 text-2xl font-semibold tracking-tight'>
								Скачать Planner для компьютера и телефона
							</h2>
							<p className='mt-1.5 text-sm text-muted'>
								Прямые установщики для Windows 64 бита, Windows 32 бита, пакет
								APK для Android и ссылка на веб-приложение.
							</p>
						</div>

						<div className='grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-5'>
							{/* Windows 64-bit */}
							<div className='flex flex-col justify-between bg-bg p-6'>
								<div>
									<div className='flex items-center justify-between'>
										<Laptop size={18} className='text-primary' />
										<span className='border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-2xs uppercase text-primary'>
											64 бита · x64
										</span>
									</div>
									<h3 className='mt-4 text-base font-semibold'>
										Windows 64 бита
									</h3>
									<p className='mt-2 text-xs leading-5 text-muted'>
										Основная версия для Windows 10 и Windows 11. Работает в
										системном трее, поддерживает автозапуск и глобальные
										уведомления.
									</p>
								</div>
								<div className='mt-6'>
									<p className='mb-2 font-mono text-2xs text-subtle'>
										Файл Planner-x64.exe · 842 КБ
									</p>
									<a
										href='/downloads/Planner-x64.exe'
										download='Planner-x64.exe'
										className='flex h-10 w-full items-center justify-center gap-2 bg-fg text-xs font-semibold text-bg transition-colors hover:bg-white'
									>
										<Download size={14} />
										Скачать 64 бита
									</a>
								</div>
							</div>

							{/* Windows 32-bit */}
							<div className='flex flex-col justify-between bg-bg p-6'>
								<div>
									<div className='flex items-center justify-between'>
										<Laptop size={18} className='text-fg' />
										<span className='border border-border px-2 py-0.5 font-mono text-2xs uppercase text-muted'>
											32 бита · x86
										</span>
									</div>
									<h3 className='mt-4 text-base font-semibold'>
										Windows 32 бита
									</h3>
									<p className='mt-2 text-xs leading-5 text-muted'>
										Сборка для 32-разрядных выпусков Windows и легких ноутбуков
										с архитектурой процессора x86.
									</p>
								</div>
								<div className='mt-6'>
									<p className='mb-2 font-mono text-2xs text-subtle'>
										Файл Planner-x86.exe · 795 КБ
									</p>
									<a
										href='/downloads/Planner-x86.exe'
										download='Planner-x86.exe'
										className='flex h-10 w-full items-center justify-center gap-2 border border-border bg-white/[0.03] text-xs font-semibold text-fg transition-colors hover:border-white/30 hover:bg-white/[0.06]'
									>
										<Download size={14} />
										Скачать 32 бита
									</a>
								</div>
							</div>

							{/* Android APK */}
							<div className='flex flex-col justify-between bg-bg p-6'>
								<div>
									<div className='flex items-center justify-between'>
										<Smartphone size={18} className='text-emerald-400' />
										<span className='border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-2xs uppercase text-emerald-400'>
											Android 8+
										</span>
									</div>
									<h3 className='mt-4 text-base font-semibold'>Android</h3>
									<p className='mt-2 text-xs leading-5 text-muted'>
										Установочный файл APK с офлайн-кэшем страниц, системными
										напоминаниями и фоновым воспроизведением музыки.
									</p>
								</div>
								<div className='mt-6'>
									<p className='mb-2 font-mono text-2xs text-subtle'>
										Файл Planner.apk · GitHub Release
									</p>
									<a
										href='https://github.com/HakerSpase/planner/releases/download/android/Planner.apk'
										className='flex h-10 w-full items-center justify-center gap-2 border border-border bg-white/[0.03] text-xs font-semibold text-fg transition-colors hover:border-white/30 hover:bg-white/[0.06]'
									>
										<Download size={14} />
										Скачать APK
									</a>
								</div>
							</div>

							{/* iOS Not Supported */}
							<div className='flex flex-col justify-between bg-bg/60 p-6'>
								<div>
									<div className='flex items-center justify-between'>
										<Smartphone size={18} className='text-subtle' />
										<span className='border border-border px-2 py-0.5 font-mono text-2xs uppercase text-subtle'>
											Нет приложения
										</span>
									</div>
									<h3 className='mt-4 text-base font-semibold text-muted'>
										iOS не поддерживается
									</h3>
									<p className='mt-2 text-xs leading-5 text-subtle'>
										Отдельный установщик для iPhone и iPad не выпускается. На
										устройствах Apple используйте веб-версию в браузере.
									</p>
								</div>
								<div className='mt-6'>
									<p className='mb-2 font-mono text-2xs text-subtle'>
										Доступно через браузер Safari
									</p>
									<span className='flex h-10 w-full cursor-not-allowed items-center justify-center border border-border/60 font-mono text-2xs uppercase text-subtle'>
										На iOS не поддерживается
									</span>
								</div>
							</div>

							{/* Web Version Link */}
							<div className='flex flex-col justify-between bg-bg p-6 sm:col-span-2 lg:col-span-1'>
								<div>
									<div className='flex items-center justify-between'>
										<Globe size={18} className='text-primary' />
										<span className='border border-border px-2 py-0.5 font-mono text-2xs uppercase text-muted'>
											Браузер
										</span>
									</div>
									<h3 className='mt-4 text-base font-semibold'>Веб-сайт</h3>
									<p className='mt-2 text-xs leading-5 text-muted'>
										Полная версия Planner открывается по прямой ссылке в любом
										современном браузере без установки.
									</p>
								</div>
								<div className='mt-6'>
									<p className='mb-2 truncate font-mono text-2xs text-subtle'>
										mplanner-dun.vercel.app
									</p>
									<a
										href='https://mplanner-dun.vercel.app'
										className='flex h-10 w-full items-center justify-center gap-1.5 border border-primary/50 bg-primary/15 text-xs font-semibold text-fg transition-colors hover:bg-primary hover:text-white'
									>
										Открыть сайт
										<ArrowUpRight size={14} />
									</a>
								</div>
							</div>
						</div>
					</section>

					{/* ===== ПОДВАЛ ===== */}
					<footer className='flex flex-col gap-3 border-x border-border px-5 py-8 font-mono text-2xs uppercase tracking-wider text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-10'>
						<div className='flex flex-wrap items-center gap-4'>
							<span className='text-fg'>© 2026 Planner</span>
							<a
								href='https://mplanner-dun.vercel.app'
								className='transition-colors hover:text-fg'
							>
								mplanner-dun.vercel.app
							</a>
							<a
								href='https://github.com/HakerSpase/planner'
								target='_blank'
								rel='noreferrer'
								className='transition-colors hover:text-fg'
							>
								GitHub ↗
							</a>
						</div>
						<a
							href='https://t.me/w_dtc'
							target='_blank'
							rel='noreferrer'
							className='transition-colors hover:text-fg'
						>
							Telegram разработчика ↗
						</a>
					</footer>
				</main>
			</div>
		</>
	)
}
