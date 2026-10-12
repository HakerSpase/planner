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
		<div className='flex h-screen w-full bg-[#0E0F0F] text-white relative overflow-hidden'>
			{/* Мобильный бэкдроп (затемнение фона при открытом меню) */}
			{isMobileOpen && (
				<div
					className='fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden transition-opacity'
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
			<main className='flex-1 min-w-0 min-h-0 px-4 pb-4 pt-4 sm:px-6 sm:pb-6 lg:px-layout lg:pb-layout lg:pt-5 xl:px-big-layout xl:pb-big-layout overflow-x-hidden overflow-y-auto relative flex flex-col'>
				<Header
					onToggleMobile={() => setIsMobileOpen(true)}
				/>
				<div className='flex-1 pb-10'>{children}</div>
			</main>
		</div>
	)
}
