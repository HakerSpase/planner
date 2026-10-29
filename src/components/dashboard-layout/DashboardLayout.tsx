'use client'

import { useRouter } from 'next/navigation'
import { type PropsWithChildren, useEffect, useState } from 'react'

import { useBackground } from '@/lib/background-preference'

import { AppBackground } from './AppBackground'
import { MobileNav } from './MobileNav'
import { Header } from './header/Header'
import { Sidebar } from './sidebar/Sidebar'
import { MENU } from './sidebar/menu.data'

export default function DashboardLayout({
	children
}: PropsWithChildren<unknown>) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)
	const router = useRouter()
	const [background] = useBackground()

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
				<div className='w-full flex-1 pb-10 pt-2 sm:pt-4'>
					{children}
				</div>
			</main>

			<MobileNav onOpenMore={() => setIsMobileOpen(true)} />
		</div>
	)
}
