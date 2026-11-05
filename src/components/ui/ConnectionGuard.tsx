'use client'

import { RefreshCw, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { canReachServer } from '@/lib/supabase/connection'

const RETRY_EVERY = 8000

/** Сервер не отвечает — говорим об этом и даём обновить, а не показываем пустой экран */
export function ConnectionGuard() {
	const [lost, setLost] = useState(false)
	const [dismissed, setDismissed] = useState(false)
	const [checking, setChecking] = useState(false)

	const check = async () => {
		setChecking(true)
		const ok = await canReachServer()
		setChecking(false)
		setLost(!ok)
		if (ok) setDismissed(false)
		return ok
	}

	useEffect(() => {
		void check()
		const onOnline = () => void check()
		window.addEventListener('online', onOnline)
		return () => window.removeEventListener('online', onOnline)
	}, [])

	// Связь вернулась — экран исчезает сам
	useEffect(() => {
		if (!lost) return
		const timer = setInterval(check, RETRY_EVERY)
		return () => clearInterval(timer)
	}, [lost])

	if (!lost || dismissed) return null

	return (
		<div
			role='alertdialog'
			aria-label='Нет связи с сервером'
			className='fixed inset-0 z-[200] grid animate-fade-in place-items-center bg-bg px-6 text-center'
		>
			<div className='w-full max-w-sm'>
				<span className='mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary'>
					<WifiOff size={24} />
				</span>
				<h1 className='mt-5 text-xl font-semibold text-fg'>
					Нет связи с сервером
				</h1>
				<p className='mt-2 text-sm leading-6 text-muted'>
					Проверьте интернет. Если сеть есть, сервер может быть недоступен у
					вашего провайдера — тогда поможет другая сеть. Как только связь
					появится, Planner откроется сам.
				</p>
				<button
					type='button'
					onClick={() => window.location.reload()}
					className='mt-6 flex h-12 w-full items-center justify-center gap-2 bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover'
				>
					<RefreshCw
						size={16}
						className={checking ? 'animate-spin' : undefined}
					/>
					Обновить
				</button>
				<button
					type='button'
					onClick={() => setDismissed(true)}
					className='mt-2 h-10 w-full text-sm text-subtle transition-colors hover:text-fg'
				>
					Всё равно продолжить
				</button>
			</div>
		</div>
	)
}
