'use client'

import { type PropsWithChildren, useEffect, useState } from 'react'

import { Header } from './header/Header'
import { Sidebar } from './sidebar/Sidebar'

export default function DashboardLayout({
	children
}: PropsWithChildren<unknown>) {
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [isMobileOpen, setIsMobileOpen] = useState(false)

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
		<div className='relative flex h-[100dvh] w-full overflow-hidden bg-[#0E0F0F] text-white'>
			{/* Мобильный бэкдроп (затемнение фона при открытом меню) */}
			{isMobileOpen && (
				<div
					className='fixed inset-0 bg-black/75 z-40 lg:hidden transition-opacity'
					onClick={() => setIsMobileOpen(false)}
				/>
			)}

			{/* Сайдбар (десктопный и мобильный) */}
			<Sidebar
				isCollapsed={isCollapsed}
				onToggleCollapse={handleToggleCollapse}
				isMobileOpen={isMobileOpen}
				onCloseMobile={() => setIsMobileOpen(false)}
			/>

			{/* Основная рабочая область */}
			<main className='relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:px-layout lg:pb-layout lg:pt-5 xl:px-big-layout xl:pb-big-layout'>
				<Header onToggleMobile={() => setIsMobileOpen(true)} />
				<div className='flex-1 pb-10'>{children}</div>
			</main>
		</div>
	)
}
