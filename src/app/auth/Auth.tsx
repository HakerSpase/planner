'use client'

import cn from 'clsx'
import { Check, Loader2 } from 'lucide-react'
import Script from 'next/script'
import { useCallback, useEffect, useRef, useState } from 'react'
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

const FEATURES = [
	{
		title: 'Задачи',
		text: 'Список и доска, сроки и приоритеты. Перетаскивайте задачи между днями.'
	},
	{
		title: 'Pomodoro',
		text: 'Раунды фокуса и перерывы. Таймер помнит, на чём вы остановились.'
	},
	{
		title: 'Тайм-блокинг',
		text: 'Распределите день по блокам и видьте, сколько времени осталось.'
	},
	{
		title: 'Мысли',
		text: 'Дневник, привязанный к датам. Идеи, рефлексия, события дня.'
	}
]

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

	useEffect(() => {
		if (typeof window === 'undefined') return
		const params = new URLSearchParams(window.location.search)
		const error = params.get('error')
		if (error) {
			if (error === 'captcha_required') {
				toast.error('Сессия проверки безопасности истекла. Пожалуйста, подтвердите проверку и попробуйте снова.')
			} else if (error === 'oauth_failed') {
				toast.error('Не удалось завершить вход через Google. Пожалуйста, попробуйте ещё раз.')
			} else if (error === 'access_denied') {
				toast.error('Вход через Google был отменён.')
			} else if (error === 'no_code') {
				toast.error('Код авторизации не был получен от сервиса входа. Попробуйте снова.')
			} else {
				toast.error(`Ошибка авторизации: ${error}`)
			}
			const newUrl = window.location.pathname
			window.history.replaceState({}, '', newUrl)
		}
	}, [])

	const toggleTask = (id: string) => {
		setTasks(prev =>
			prev.map(t => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t))
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


	const doneCount = tasks.filter(t => t.isCompleted).length

	return (
		<>
			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
				onReady={renderTurnstile}
				onError={() => setCaptchaError('Не удалось загрузить проверку безопасности.')}
			/>

			{/* body глобально без прокрутки — у лендинга свой скролл-контейнер */}
			<div className='h-[100dvh] overflow-y-auto bg-bg text-fg'>
				{/* ===== ШАПКА ===== */}
				<header className='sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur'>
					<div className='mx-auto flex h-14 max-w-[1240px] items-center justify-between px-5 sm:px-8'>
						<div className='flex items-center gap-3'>
							<span className='font-display text-[17px] font-semibold tracking-[-0.03em]'>
								Planner
							</span>
							<span className='border border-border px-1.5 font-mono text-2xs uppercase text-subtle'>
								beta
							</span>
						</div>
						<a
							href='#login'
							className='font-mono text-xs uppercase tracking-wider text-muted transition-colors hover:text-fg'
						>
							Войти →
						</a>
					</div>
				</header>

				<main className='mx-auto max-w-[1240px] px-5 sm:px-8'>
					{/* ===== ПЕРВЫЙ ЭКРАН ===== */}
					<section className='grid border-x border-border lg:grid-cols-12'>
						<div className='border-b border-border px-5 py-12 sm:px-10 sm:py-16 lg:col-span-7 lg:border-r lg:py-24'>
							<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
								[ 00 ] Планировщик
							</p>
							<h1 className='mt-6 text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl xl:text-7xl'>
								Меньше шума.
								<br />
								<span className='text-subtle'>Больше дела.</span>
							</h1>
							<p className='mt-8 max-w-md text-base leading-7 text-muted'>
								Задачи, фокус-таймер, тайм-блокинг и дневник мыслей
								в&nbsp;одном спокойном интерфейсе. Ничего лишнего.
							</p>
						</div>

						{/* Вход */}
						<div
							id='login'
							className='flex scroll-mt-14 flex-col justify-center border-b border-border px-5 py-12 sm:px-10 lg:col-span-5'
						>
							<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
								Вход
							</p>
							<h2 className='mt-3 text-2xl font-semibold tracking-tight'>
								Продолжить работу
							</h2>
							<p className='mt-2 text-sm text-muted'>
								Один аккаунт Google — и все данные синхронизированы.
							</p>

							<div className='mt-8 flex min-h-[65px] w-full items-center'>
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
										<Loader2
											size={18}
											className='animate-spin'
										/>
									) : (
										<svg
											className='h-[18px] w-[18px] shrink-0'
											viewBox='0 0 24 24'
										>
											<path fill='#4285F4' d='M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z' />
											<path fill='#34A853' d='M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z' />
											<path fill='#FBBC05' d='M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z' />
											<path fill='#EA4335' d='M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z' />
										</svg>
									)}
									{isLoading ? 'Авторизация…' : 'Продолжить через Google'}
								</span>
								<span aria-hidden>→</span>
							</button>

							<p className='mt-4 font-mono text-2xs uppercase tracking-wider text-subtle'>
								Защищено Cloudflare Turnstile
							</p>
						</div>
					</section>

					{/* ===== ПРЕВЬЮ ЗАДАЧ ===== */}
					<section className='border-x border-b border-border'>
						<div className='flex items-center justify-between border-b border-border px-5 py-3 sm:px-10'>
							<p className='font-mono text-xs uppercase tracking-[0.2em] text-subtle'>
								[ 01 ] На этой неделе
							</p>
							<p className='font-mono text-xs tabular-nums text-muted'>
								{doneCount}/{tasks.length}
							</p>
						</div>
						<ul>
							{tasks.map((task, index) => (
								<li
									key={task.id}
									draggable
									onDragStart={() => handleDragStart(task.id)}
									onDragOver={handleDragOver}
									onDrop={() => handleDrop(task.id)}
									onDragEnd={handleDragEnd}
									className={cn(
										'group grid cursor-grab grid-cols-[2.5rem_1.25rem_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-white/[0.02] active:cursor-grabbing sm:grid-cols-[3rem_1.25rem_minmax(0,1fr)_6rem_6rem] sm:px-10',
										dragId === task.id && 'opacity-30'
									)}
								>
									<span className='font-mono text-xs tabular-nums text-subtle'>
										{String(index + 1).padStart(2, '0')}
									</span>
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
											<Check
												size={11}
												strokeWidth={3}
											/>
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
											{task.name}
										</p>
										{task.note && (
											<p className='mt-0.5 truncate text-xs text-subtle'>
												{task.note}
											</p>
										)}
									</div>
									<span className='hidden font-mono text-xs text-muted sm:block'>
										{task.date}
									</span>
									<span className='flex items-center gap-2 justify-self-end text-xs text-muted'>
										<span
											className={cn(
												'h-1.5 w-1.5',
												PRIORITY_DOT[task.priority]
											)}
										/>
										{PRIORITY_LABEL[task.priority]}
									</span>
								</li>
							))}
						</ul>
					</section>

					{/* ===== РАЗДЕЛЫ ===== */}
					<section className='grid border-x border-b border-border sm:grid-cols-2 lg:grid-cols-4'>
						{FEATURES.map((feature, index) => (
							<div
								key={feature.title}
								className='border-b border-border px-5 py-8 last:border-b-0 sm:px-8 sm:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0'
							>
								<p className='font-mono text-xs text-subtle'>
									{String(index + 2).padStart(2, '0')}
								</p>
								<h3 className='mt-6 text-base font-semibold'>
									{feature.title}
								</h3>
								<p className='mt-2 text-sm leading-6 text-muted'>
									{feature.text}
								</p>
							</div>
						))}
					</section>

					{/* ===== ПОДВАЛ ===== */}
					<footer className='flex flex-col gap-2 border-x border-border px-5 py-6 font-mono text-2xs uppercase tracking-wider text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-10'>
						<span>© 2026 Planner</span>
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
