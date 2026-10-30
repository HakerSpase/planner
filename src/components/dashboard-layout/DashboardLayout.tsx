'use client'

import cn from 'clsx'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { type PropsWithChildren, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { useBackground } from '@/lib/background-preference'
import { watchKeyboard } from '@/lib/keyboard-state'
import { watchLocalReminders } from '@/lib/local-reminders'
import { registerServiceWorker } from '@/lib/push'

import { taskService } from '@/services/task.service'
import { haptic, usePreferences } from '@/lib/preferences'

import { useBackClose } from '@/hooks/useBackClose'

import { AppBackground } from './AppBackground'
import { MobileNav } from './MobileNav'
import { MusicController } from './MusicController'
import { UploadProgress } from './UploadProgress'
import { Header } from './header/Header'
import { Sidebar } from './sidebar/Sidebar'
import { MENU } from './sidebar/menu.data'

export default function DashboardLayout({
	children
}: PropsWithChildren<unknown>) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	const router = useRouter()
	const pathname = usePathname()
	const [appBackground] = useBackground('app')
	const [libraryBackground] = useBackground('library')
	const background = pathname.startsWith('/i/library') ? libraryBackground : appBackground

	const [preferences] = usePreferences()

	useBackClose(isMobileOpen, () => setIsMobileOpen(false))
	useEffect(() => watchKeyboard(), [])
	// Напоминания, пока планер открыт, — если на этом устройстве нет веб-пуша (настольное приложение)
	const { data: tasks } = useQuery({
		queryKey: ['tasks'],
		queryFn: () => taskService.getTasks(),
		staleTime: 60_000
	})
	const tasksRef = useRef(tasks?.data)
	tasksRef.current = tasks?.data
	useEffect(
		() =>
			watchLocalReminders(
				() => tasksRef.current,
				(title, body) => toast(title, { description: body, duration: 20_000 })
			),
		[]
	)

	// Service worker нужен для уведомлений о задачах; регистрируем заранее, чтобы он обновлялся
	useEffect(() => {
		registerServiceWorker()?.catch(() => {})
	}, [])

	// Вибрация на телефоне: переходы, кнопки, отметки — по настройкам
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType !== 'touch') return
			const target = event.target as HTMLElement
			const check = target.closest('input[type=checkbox], [role=checkbox], label')
			if (check && (check.matches('input, [role=checkbox]') || check.querySelector('input[type=checkbox]')))
				return haptic('check')
			if (target.closest('a[href^="/i"]')) return haptic('nav')
			if (target.closest('button')) return haptic('button')
		}
		document.addEventListener('pointerdown', onPointerDown, { passive: true })
		return () => document.removeEventListener('pointerdown', onPointerDown)
	}, [])

	// Переход по ссылке [[лист]] из любого редактора
	useEffect(() => {
		const onNavigate = (event: Event) => {
			const { href, missing } = (event as CustomEvent).detail || {}
			if (href) router.push(href)
			else if (missing) toast.info(`Листа «${missing}» в архиве пока нет`)
		}
		window.addEventListener('planner:navigate', onNavigate)
		return () => window.removeEventListener('planner:navigate', onNavigate)
	}, [router])

	// Alt+1…8 — быстрый переход между разделами (порядок как в меню)
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!event.altKey || event.ctrlKey || event.metaKey) return
			const index = Number(event.code.replace('Digit', '')) - 1
			const item = MENU[index]
			if (!event.code.startsWith('Digit') || !item) return
			event.preventDefault()
			router.push(item.link)
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [router])

	// Запоминание состояния сворачивания в localStorage
	useEffect(() => {
		const saved = localStorage.getItem('sidebar-collapsed')
		if (saved !== null) {
			setIsCollapsed(saved === 'true')
		}
	}, [])

	const handleToggleCollapse = () => {
		setIsCollapsed(prev => {
			const next = !prev
			localStorage.setItem('sidebar-collapsed', String(next))
			return next
		})
	}

	return (
		<div className='relative flex h-[100dvh] w-full overflow-hidden bg-bg text-fg'>
			{/* Мобильный бэкдроп (затемнение фона при открытом меню) */}
			{isMobileOpen && (
				<div
					className='fixed inset-0 z-40 animate-fade-in bg-black/60 backdrop-blur-sm lg:hidden'
					onClick={() => setIsMobileOpen(false)}
				/>
			)}

			{/* Живой фон — под рабочей областью, сайдбар его перекрывает */}
			<AppBackground
				variant={background}
				className='fixed inset-0 z-0'
			/>

			{/* Сайдбар (десктопный и мобильный) */}
			<Sidebar
				isCollapsed={isCollapsed}
				onToggleCollapse={handleToggleCollapse}
				isMobileOpen={isMobileOpen}
				onCloseMobile={() => setIsMobileOpen(false)}
			/>

			{/* Основная рабочая область */}
			<main className='relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pb-6 lg:px-8 lg:pt-3 xl:px-10'>
				<Header onToggleMobile={() => setIsMobileOpen(true)} />
				{/* Плавный переход между разделами: новый раздел мягко проявляется */}
				<div
					key={pathname}
					className={cn(
						'w-full flex-1 pb-10 pt-2 sm:pt-4',
						preferences.transition === 'soft' && 'page-enter-soft',
						preferences.transition === 'smooth' && 'page-enter-smooth'
					)}
				>
					{children}
				</div>
			</main>

			<MobileNav onOpenMore={() => setIsMobileOpen(true)} />
			<UploadProgress />
			<MusicController />
		</div>
	)
}
