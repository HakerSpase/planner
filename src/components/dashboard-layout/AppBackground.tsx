'use client'

import cn from 'clsx'
import { useEffect, useRef } from 'react'

import type { TypeBackground } from '@/lib/background-preference'

/** Неинтерактивный фон рабочей области. Всё движение очень медленное и выключается при reduced motion. */
export function AppBackground({
	variant,
	className
}: {
	variant: TypeBackground
	className?: string
}) {
	return (
		<div
			aria-hidden
			className={cn('pointer-events-none overflow-hidden bg-bg', className)}
		>
			{variant === 'dots' && <div className='app-bg-dots absolute -inset-8' />}
			{variant === 'grid' && <div className='app-bg-grid absolute -inset-16' />}
			{variant === 'aurora' && (
				<>
					<div className='app-bg-aurora app-bg-aurora-1' />
					<div className='app-bg-aurora app-bg-aurora-2' />
					<div className='app-bg-aurora app-bg-aurora-3' />
				</>
			)}
			{variant === 'stars' && <Constellation />}
		</div>
	)
}

/* Созвездие на canvas: ~60 точек дрейфуют, близкие соединяются линиями */
function Constellation() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!canvas || !ctx) return

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		let width = 0
		let height = 0
		let raf = 0
		let last = 0

		const resize = () => {
			width = canvas.clientWidth
			height = canvas.clientHeight
			canvas.width = width * dpr
			canvas.height = height * dpr
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
		}
		resize()

		const count = Math.round(Math.min(70, (width * height) / 22000))
		const points = Array.from({ length: count }, () => ({
			x: Math.random() * width,
			y: Math.random() * height,
			vx: (Math.random() - 0.5) * 6,
			vy: (Math.random() - 0.5) * 6
		}))

		const draw = (now: number) => {
			// ~30 кадров в секунду достаточно для такого медленного движения
			if (now - last < 33) {
				raf = requestAnimationFrame(draw)
				return
			}
			const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
			last = now
			ctx.clearRect(0, 0, width, height)

			for (const p of points) {
				p.x = (p.x + p.vx * dt + width) % width
				p.y = (p.y + p.vy * dt + height) % height
			}
			for (let i = 0; i < points.length; i++) {
				for (let j = i + 1; j < points.length; j++) {
					const dx = points[i].x - points[j].x
					const dy = points[i].y - points[j].y
					const dist = Math.hypot(dx, dy)
					if (dist < 140) {
						ctx.strokeStyle = `rgba(255,255,255,${0.05 * (1 - dist / 140)})`
						ctx.lineWidth = 1
						ctx.beginPath()
						ctx.moveTo(points[i].x, points[i].y)
						ctx.lineTo(points[j].x, points[j].y)
						ctx.stroke()
					}
				}
			}
			ctx.fillStyle = 'rgba(255,255,255,0.22)'
			for (const p of points) ctx.fillRect(p.x - 1, p.y - 1, 2, 2)

			if (!reduceMotion) raf = requestAnimationFrame(draw)
		}
		raf = requestAnimationFrame(draw)

		// Во вкладке в фоне не рисуем — экономим батарею
		const onVisibility = () => {
			cancelAnimationFrame(raf)
			if (!document.hidden && !reduceMotion) {
				last = 0
				raf = requestAnimationFrame(draw)
			}
		}
		window.addEventListener('resize', resize)
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			cancelAnimationFrame(raf)
			window.removeEventListener('resize', resize)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [])

	return (
		<canvas
			ref={canvasRef}
			className='absolute inset-0 h-full w-full'
		/>
	)
}
