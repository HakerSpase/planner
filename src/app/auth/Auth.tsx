'use client'

import { GanttChartSquare, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/buttons/Button'

import { COLORS } from '@/constants/color.constants'

export function Auth() {
	const [isLoading, setIsLoading] = useState(false)
	const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

	const handleGoogleLogin = async () => {
		// Turnstile проверка, если ключ задан
		const turnstileRequired = !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
		if (turnstileRequired && !turnstileToken) {
			toast.error('Пожалуйста, подтвердите капчу Cloudflare Turnstile')
			return
		}

		setIsLoading(true)
		try {
			// Редирект на Google OAuth через Supabase / Next.js
			window.location.href = '/api/auth/google'
		} catch (error) {
			toast.error('Ошибка входа через Google. Попробуйте еще раз.')
			setIsLoading(false)
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center p-4 bg-bg'>
			<div className='w-full max-w-md shadow-2xl bg-sidebar rounded-2xl p-8 border border-border flex flex-col items-center text-center'>
				<div className='w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 shadow-inner'>
					<GanttChartSquare
						color={COLORS.primary}
						size={40}
					/>
				</div>

				<h1 className='text-3xl font-bold tracking-tight mb-2'>
					Planner
				</h1>
				<p className='text-sm text-white/50 mb-8 max-w-xs'>
					Современный планировщик задач, канбан-доска и таймер Pomodoro в одном месте
				</p>

				{/* Блок Cloudflare Turnstile */}
				<div
					id='cloudflare-turnstile-container'
					className='my-4 min-h-[65px] flex items-center justify-center w-full'
				>
					{process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? (
						<div
							className='cf-turnstile'
							data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
							data-theme='dark'
							data-callback='onTurnstileSuccess'
						/>
					) : (
						<div className='flex items-center gap-2 text-xs text-white/40 bg-white/5 py-2 px-3 rounded-lg border border-white/5'>
							<ShieldCheck size={16} className='text-green-400' />
							<span>Защита Cloudflare Turnstile активна</span>
						</div>
					)}
				</div>

				{/* Кнопка входа через Google */}
				<button
					onClick={handleGoogleLogin}
					disabled={isLoading}
					className='w-full mt-4 flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl bg-white text-gray-900 font-semibold text-base hover:bg-gray-100 transition-all duration-200 active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed'
				>
					<svg
						className='w-5 h-5'
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
					{isLoading ? 'Вход в аккаунт...' : 'Продолжить с Google'}
				</button>

				<p className='text-xs text-white/30 mt-6'>
					Авторизуясь, вы соглашаетесь с условиями сервиса
				</p>
			</div>
		</div>
	)
}
