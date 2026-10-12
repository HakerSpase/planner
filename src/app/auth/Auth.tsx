'use client'

import { Check, GanttChartSquare, Loader2, Timer } from 'lucide-react'
import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
	const turnstileContainerRef = useRef<HTMLDivElement>(null)

	const siteKey =
		process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '0x4AAAAAAFUvK-Ot88Si8C4y'

	// Инициализация виджета Cloudflare Turnstile
	useEffect(() => {
		;(window as any).onTurnstileSuccess = (token: string) => {
			setTurnstileToken(token)
		}

		const initTurnstile = () => {
			if (
				(window as any).turnstile &&
				turnstileContainerRef.current &&
				turnstileContainerRef.current.childElementCount === 0
			) {
				try {
					;(window as any).turnstile.render(turnstileContainerRef.current, {
						sitekey: siteKey,
						theme: 'dark',
						callback: (token: string) => {
							setTurnstileToken(token)
						}
					})
				} catch (e) {
					console.log('Turnstile widget render:', e)
				}
			}
		}

		if ((window as any).turnstile) {
			initTurnstile()
		} else {
			const interval = setInterval(() => {
				if ((window as any).turnstile) {
					initTurnstile()
					clearInterval(interval)
				}
			}, 300)
			return () => clearInterval(interval)
		}
	}, [siteKey])

	const handleGoogleLogin = async () => {
		setIsLoading(true)

		try {
			const supabase = createClient()
			const redirectTo = `${window.location.origin}/auth/callback`

			const { data, error } = await supabase.auth.signInWithOAuth({
				provider: 'google',
				options: {
					redirectTo
				}
			})

			if (error) {
				console.error('OAuth error:', error)
				toast.error(
					error.message ||
						'Ошибка входа через Google. Убедитесь, что провайдер Google включен в панели Supabase.'
				)
				setIsLoading(false)
				return
			}

			if (data.url) {
				window.location.href = data.url
			}
		} catch (error: any) {
			console.error('Login error:', error)
			toast.error('Не удалось подключиться к сервису авторизации')
			setIsLoading(false)
		}

		setTimeout(() => {
			setIsLoading(false)
		}, 8000)
	}

	return (
		<>
			{/* Скрипт Cloudflare Turnstile */}
			<Script
				src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
				strategy='afterInteractive'
			/>

			<div className='min-h-screen w-full grid grid-cols-1 lg:grid-cols-2 bg-[#0E0F0F] text-white selection:bg-[#7551FF]/30 select-none'>
				{/* Левая сторона: Минималистичная презентация в стиле Planner */}
				<div className='hidden lg:flex flex-col justify-between p-12 lg:p-16 bg-[#141515] border-r border-white/[0.08] relative overflow-hidden'>
					{/* Фоновый мягкий рассеянный свет */}
					<div className='absolute top-0 right-0 w-[500px] h-[500px] bg-[#7551FF]/10 blur-[130px] pointer-events-none rounded-full' />
					<div className='absolute bottom-0 left-0 w-[350px] h-[350px] bg-white/[0.02] blur-[100px] pointer-events-none rounded-full' />

					{/* Логотип Planner beta */}
					<div className='relative z-10 flex items-center gap-3'>
						<GanttChartSquare color='#7551FF' size={36} />
						<div className='text-2xl font-bold tracking-tight relative'>
							Planner
							<span className='absolute -top-1 -right-6 text-xs text-[#7551FF] opacity-70 rotate-[18deg] font-mono font-normal'>
								beta
							</span>
						</div>
					</div>

					{/* Центральный строгий блок интерфейса Planner */}
					<div className='relative z-10 max-w-lg my-auto space-y-6'>
						<div>
							<h2 className='text-2xl font-semibold text-white tracking-tight mb-2'>
								Пространство фокуса и продуктивности
							</h2>
							<p className='text-sm text-white/50 leading-relaxed'>
								Канбан-доска, тайм-блокинг и таймер Pomodoro, объединенные в строгом и чистом интерфейсе.
							</p>
						</div>

						{/* Интерактивное превью задач Planner */}
						<div className='rounded-xl border border-white/[0.08] bg-[#0E0F0F]/90 p-5 backdrop-blur space-y-4'>
							<div className='flex items-center justify-between pb-3 border-b border-white/[0.06] text-xs text-white/40 font-mono'>
								<span>ЗАДАЧИ НА СЕГОДНЯ</span>
								<span className='text-[#7551FF] font-medium'>2 ИЗ 3</span>
							</div>

							{/* Строка 1: Выполненная */}
							<div className='flex items-center justify-between text-sm py-1.5 opacity-50'>
								<div className='flex items-center gap-3'>
									<div className='w-4 h-4 rounded bg-[#7551FF] flex items-center justify-center text-white'>
										<Check size={12} strokeWidth={3} />
									</div>
									<span className='line-through italic text-white/80'>
										Настроить архитектуру Supabase
									</span>
								</div>
								<span className='text-xs text-white/40 font-mono'>Готово</span>
							</div>

							{/* Строка 2: В фокусе */}
							<div className='flex items-center justify-between text-sm py-1.5'>
								<div className='flex items-center gap-3'>
									<div className='w-4 h-4 rounded border border-[#7551FF] bg-[#7551FF]/10' />
									<span className='text-white font-medium'>Фокус-сессия: разработка проекта</span>
								</div>
								<span className='text-xs px-2 py-0.5 rounded bg-[#7551FF]/15 text-[#8b6eff] font-medium font-mono'>
									Высокий
								</span>
							</div>

							{/* Строка 3: Обычная */}
							<div className='flex items-center justify-between text-sm py-1.5'>
								<div className='flex items-center gap-3'>
									<div className='w-4 h-4 rounded border border-white/20' />
									<span className='text-white/70'>Обзор спринта и синхронизация</span>
								</div>
								<span className='text-xs text-white/40 font-mono'>18:00</span>
							</div>

							{/* Мини-таймер Pomodoro */}
							<div className='pt-3 border-t border-white/[0.06] flex items-center justify-between'>
								<div className='flex items-center gap-2 text-xs text-white/50'>
									<Timer size={14} className='text-[#7551FF]' />
									<span>Pomodoro таймер</span>
								</div>
								<div className='flex items-center gap-2'>
									<span className='text-xs font-mono text-white/40'>25:00</span>
									<span className='w-2 h-2 rounded-full bg-[#7551FF] animate-pulse' />
								</div>
							</div>
						</div>
					</div>

					{/* Слева снизу: актуальный копирайт */}
					<div className='relative z-10 text-xs text-white/30 font-normal'>
						&copy; 2026 Planner. Все права защищены.
					</div>
				</div>

				{/* Правая сторона: Минималистичная форма входа */}
				<div className='flex flex-col justify-between p-8 sm:p-12 lg:p-16 bg-[#0E0F0F] relative'>
					{/* Мобильный логотип */}
					<div className='lg:hidden flex items-center gap-2.5 mb-10'>
						<GanttChartSquare color='#7551FF' size={30} />
						<span className='text-xl font-bold tracking-tight'>Planner</span>
					</div>

					{/* Центрированный аккуратный блок входа */}
					<div className='w-full max-w-[340px] mx-auto my-auto flex flex-col items-center text-center'>
						<div className='mb-6'>
							<h1 className='text-3xl font-semibold tracking-tight text-white mb-2.5'>
								Вход в систему
							</h1>
							<p className='text-sm text-white/50 leading-relaxed max-w-[300px]'>
								Используйте аккаунт Google для быстрого входа в Planner
							</p>
						</div>

						{/* Виджет Cloudflare Turnstile */}
						<div className='w-full mb-6 flex justify-center min-h-[65px] items-center'>
							<div ref={turnstileContainerRef} id='turnstile-widget' />
						</div>

						{/* Идеально выровненная кнопка Google */}
						<button
							onClick={handleGoogleLogin}
							disabled={isLoading}
							style={{
								backgroundColor: '#FFFFFF',
								color: '#111827'
							}}
							className='w-full max-w-[300px] h-[48px] relative flex items-center justify-center rounded-xl font-medium text-sm transition-all duration-200 hover:bg-neutral-100 active:scale-[0.98] shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
						>
							{isLoading ? (
								<div className='flex items-center gap-2.5'>
									<Loader2 size={18} className='animate-spin text-neutral-800' />
									<span className='font-semibold text-sm' style={{ color: '#111827' }}>
										Перенаправление...
									</span>
								</div>
							) : (
								<>
									<span className='absolute left-4.5 flex items-center justify-center'>
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
									</span>
									<span
										className='font-semibold text-sm tracking-tight'
										style={{ color: '#111827' }}
									>
										Войти через Google
									</span>
								</>
							)}
						</button>

						{/* Мелкий текст условий */}
						<p className='mt-5 text-xs text-white/35 text-center leading-relaxed max-w-[280px]'>
							Авторизуясь в сервисе, вы соглашаетесь с условиями использования и политикой конфиденциальности.
						</p>
					</div>

					{/* Пустой невидимый блок для идеальной центровки формы */}
					<div className='hidden lg:block' />
				</div>
			</div>
		</>
	)
}
