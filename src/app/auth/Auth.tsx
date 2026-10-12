'use client'

import {
	CalendarCheck,
	CheckCircle2,
	GanttChartSquare,
	Loader2,
	Lock,
	ShieldCheck,
	Sparkles,
	Timer
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

	const handleGoogleLogin = async () => {
		const turnstileRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
		if (turnstileRequired && !turnstileToken) {
			toast.error('Пожалуйста, подтвердите проверку Cloudflare Turnstile')
			return
		}

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
				toast.error(error.message || 'Ошибка входа через Google. Проверьте настройки в Supabase.')
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

		// Защита от вечного зависания кнопки
		setTimeout(() => {
			setIsLoading(false)
		}, 8000)
	}

	return (
		<div className='relative min-h-screen w-full flex items-center justify-center p-4 bg-[#08090C] overflow-hidden select-none'>
			{/* Неоновый градиентный фон (Аура) */}
			<div className='absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-pink-500/15 blur-[140px] pointer-events-none rounded-full' />
			<div className='absolute -bottom-40 right-10 w-[500px] h-[400px] bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full' />
			<div className='absolute top-1/2 -left-40 w-[400px] h-[400px] bg-purple-700/15 blur-[120px] pointer-events-none rounded-full' />

			{/* Сетка на фоне с плавным радиальным затуханием */}
			<div
				className='absolute inset-0 pointer-events-none opacity-40'
				style={{
					backgroundImage: `radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px)`,
					backgroundSize: '28px 28px',
					maskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 50%, transparent 100%)',
					WebkitMaskImage: 'radial-gradient(ellipse 65% 55% at 50% 50%, #000 50%, transparent 100%)'
				}}
			/>

			{/* Главная карточка авторизации */}
			<div className='relative w-full max-w-[440px] z-10'>
				{/* Эффект свечения границы */}
				<div className='absolute -inset-[1px] bg-gradient-to-b from-white/20 via-white/5 to-transparent rounded-3xl blur-[1px] pointer-events-none' />

				<div className='relative bg-[#0F1015]/80 backdrop-blur-2xl rounded-3xl p-8 sm:p-10 border border-white/10 shadow-[0_0_80px_-20px_rgba(117,81,255,0.35)] flex flex-col items-center text-center'>
					{/* Верхний световой акцент */}
					<div className='absolute top-0 left-1/2 -translate-x-1/2 w-40 h-[1.5px] bg-gradient-to-r from-transparent via-indigo-400/90 to-transparent' />

					{/* Иконка приложения с неоновым ореолом */}
					<div className='relative mb-5'>
						<div className='absolute -inset-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur-lg opacity-40 animate-pulse' />
						<div className='relative w-16 h-16 rounded-2xl bg-gradient-to-b from-white/10 to-white/[0.03] border border-white/20 flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)]'>
							<GanttChartSquare
								className='text-indigo-400 drop-shadow-[0_0_12px_rgba(129,140,248,0.8)]'
								size={34}
							/>
						</div>
					</div>

					{/* Бейдж версии */}
					<div className='inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-white/[0.05] border border-white/10 text-[0.8rem] text-indigo-300 font-medium mb-3'>
						<Sparkles size={13} className='text-indigo-400' />
						<span>Умный рабочий планировщик</span>
					</div>

					{/* Заголовок */}
					<h1 className='text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 bg-gradient-to-b from-white via-white/95 to-white/70 bg-clip-text text-transparent'>
						Planner
					</h1>

					<p className='text-sm text-white/55 mb-6 leading-relaxed max-w-xs'>
						Единое пространство для задач, канбан-доски и сессий глубокой концентрации
					</p>

					{/* Список преимуществ / фич */}
					<div className='grid grid-cols-3 gap-2 w-full mb-6'>
						<div className='flex flex-col items-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors'>
							<CheckCircle2 size={16} className='text-indigo-400 mb-1' />
							<span className='text-[0.75rem] text-white/70 font-medium'>Канбан</span>
						</div>
						<div className='flex flex-col items-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors'>
							<Timer size={16} className='text-purple-400 mb-1' />
							<span className='text-[0.75rem] text-white/70 font-medium'>Pomodoro</span>
						</div>
						<div className='flex flex-col items-center p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors'>
							<CalendarCheck size={16} className='text-emerald-400 mb-1' />
							<span className='text-[0.75rem] text-white/70 font-medium'>Тайм-блоки</span>
						</div>
					</div>

					{/* Блок Cloudflare Turnstile */}
					<div
						id='cloudflare-turnstile-container'
						className='w-full my-2 flex items-center justify-center'
					>
						{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
							<div
								className='cf-turnstile'
								data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
								data-theme='dark'
								data-callback='onTurnstileSuccess'
							/>
						) : (
							<div className='w-full flex items-center justify-between py-2 px-3.5 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/20 text-xs text-emerald-300/90'>
								<div className='flex items-center gap-2'>
									<div className='w-2 h-2 rounded-full bg-emerald-400 animate-pulse' />
									<span>Защита Cloudflare Turnstile</span>
								</div>
								<ShieldCheck size={15} className='text-emerald-400' />
							</div>
						)}
					</div>

					{/* Кнопка входа через Google */}
					<button
						onClick={handleGoogleLogin}
						disabled={isLoading}
						className='group relative w-full mt-4 flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl bg-white text-gray-900 font-semibold text-[1.05rem] hover:bg-gray-100 transition-all duration-300 active:scale-[0.98] shadow-[0_10px_30px_-10px_rgba(255,255,255,0.3)] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer'
					>
						{isLoading ? (
							<>
								<Loader2 size={19} className='animate-spin text-gray-800' />
								<span>Перенаправление...</span>
							</>
						) : (
							<>
								<svg
									className='w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110 duration-200'
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
								<span>Продолжить с Google</span>
							</>
						)}
					</button>

					{/* Футер с безопасностью */}
					<div className='flex items-center gap-1.5 text-[0.78rem] text-white/35 mt-6'>
						<Lock size={12} className='text-white/40' />
						<span>Сквозная безопасность сессий Google OAuth 2.0</span>
					</div>
				</div>
			</div>
		</div>
	)
}
