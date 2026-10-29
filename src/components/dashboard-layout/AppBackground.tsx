'use client'

import cn from 'clsx'
import { useEffect, useRef } from 'react'

import type { TypeBackground } from '@/lib/background-preference'

/** Неинтерактивный фон рабочей области. Всё движение медленное и выключается при reduced motion. */
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
			{variant === 'stars' && (
				<>
					<div className='app-bg-nebula' />
					<CanvasScene scene={starsScene} />
				</>
			)}
			{variant === 'constellation' && <CanvasScene scene={constellationScene} />}
			{variant === 'waves' && <CanvasScene scene={wavesScene} />}
			{variant === 'fireflies' && <CanvasScene scene={firefliesScene} />}
			{variant === 'aurora' && (
				<>
					<div className='app-bg-aurora app-bg-aurora-1' />
					<div className='app-bg-aurora app-bg-aurora-2' />
					<div className='app-bg-aurora app-bg-aurora-3' />
				</>
			)}
			{variant === 'grid' && <div className='app-bg-grid absolute -inset-16' />}
			{variant === 'dots' && <div className='app-bg-dots absolute -inset-8' />}
		</div>
	)
}

/* ------------------------------------------------------------------ */
/* Общий цикл отрисовки на canvas                                       */
/* ------------------------------------------------------------------ */

type TypeScene = (
	ctx: CanvasRenderingContext2D,
	size: { width: number; height: number }
) => (time: number, dt: number) => void

function CanvasScene({ scene }: { scene: TypeScene }) {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		const ctx = canvas?.getContext('2d')
		if (!canvas || !ctx) return

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
		const dpr = Math.min(window.devicePixelRatio || 1, 2)
		const size = { width: 0, height: 0 }
		let draw: ReturnType<TypeScene>
		let raf = 0
		let last = 0
		let time = 0

		const setup = () => {
			size.width = canvas.clientWidth
			size.height = canvas.clientHeight
			canvas.width = size.width * dpr
			canvas.height = size.height * dpr
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
			draw = scene(ctx, size)
		}
		setup()

		const frame = (now: number) => {
			// ~30 кадров в секунду — для медленного фона более чем достаточно
			if (now - last >= 33) {
				const dt = last ? Math.min(0.1, (now - last) / 1000) : 0
				last = now
				time += dt
				ctx.clearRect(0, 0, size.width, size.height)
				draw(time, dt)
			}
			if (!reduceMotion) raf = requestAnimationFrame(frame)
		}
		raf = requestAnimationFrame(frame)

		// Вкладка в фоне — не рисуем, бережём батарею
		const onVisibility = () => {
			cancelAnimationFrame(raf)
			if (!document.hidden && !reduceMotion) {
				last = 0
				raf = requestAnimationFrame(frame)
			}
		}
		let resizeTimer: ReturnType<typeof setTimeout>
		const onResize = () => {
			clearTimeout(resizeTimer)
			resizeTimer = setTimeout(setup, 150)
		}
		window.addEventListener('resize', onResize)
		document.addEventListener('visibilitychange', onVisibility)
		return () => {
			cancelAnimationFrame(raf)
			clearTimeout(resizeTimer)
			window.removeEventListener('resize', onResize)
			document.removeEventListener('visibilitychange', onVisibility)
		}
	}, [scene])

	return (
		<canvas
			ref={canvasRef}
			className='absolute inset-0 h-full w-full'
		/>
	)
}

const rand = (min: number, max: number) => min + Math.random() * (max - min)

/* ------------------------------------------------------------------ */
/* Звёздное небо: три слоя глубины, мерцание, редкие падающие звёзды    */
/* ------------------------------------------------------------------ */

const STAR_TINTS = ['255,255,255', '210,225,255', '255,236,210', '200,190,255']

const starsScene: TypeScene = (ctx, size) => {
	const area = size.width * size.height
	const layers = [
		{ count: area / 2600, speed: 1.2, radius: [0.35, 0.7], alpha: [0.25, 0.55] },
		{ count: area / 9000, speed: 2.8, radius: [0.6, 1.05], alpha: [0.4, 0.75] },
		{ count: area / 32000, speed: 5, radius: [1, 1.6], alpha: [0.6, 0.95] }
	]
	const stars = layers.flatMap(layer =>
		Array.from({ length: Math.round(Math.min(layer.count, 700)) }, () => ({
			x: Math.random() * size.width,
			y: Math.random() * size.height,
			r: rand(layer.radius[0], layer.radius[1]),
			a: rand(layer.alpha[0], layer.alpha[1]),
			speed: layer.speed,
			twinkle: rand(0.4, 1.6),
			phase: rand(0, Math.PI * 2),
			tint: STAR_TINTS[Math.floor(Math.random() * STAR_TINTS.length)],
			bright: layer.speed > 4
		}))
	)

	let meteor: { x: number; y: number; vx: number; vy: number; life: number } | null = null
	let nextMeteor = rand(6, 14)

	return (time, dt) => {
		for (const star of stars) {
			star.x -= star.speed * dt
			if (star.x < -2) star.x += size.width + 4
			const alpha = star.a * (0.65 + 0.35 * Math.sin(time * star.twinkle + star.phase))
			ctx.fillStyle = `rgba(${star.tint},${alpha})`
			ctx.beginPath()
			ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
			ctx.fill()
			// у ярких звёзд — мягкий ореол
			if (star.bright) {
				ctx.fillStyle = `rgba(${star.tint},${alpha * 0.12})`
				ctx.beginPath()
				ctx.arc(star.x, star.y, star.r * 4, 0, Math.PI * 2)
				ctx.fill()
			}
		}

		nextMeteor -= dt
		if (!meteor && nextMeteor <= 0) {
			meteor = {
				x: rand(size.width * 0.2, size.width),
				y: rand(0, size.height * 0.4),
				vx: -rand(380, 520),
				vy: rand(140, 220),
				life: 1
			}
			nextMeteor = rand(9, 22)
		}
		if (meteor) {
			meteor.x += meteor.vx * dt
			meteor.y += meteor.vy * dt
			meteor.life -= dt * 0.9
			const tail = 0.12
			const gradient = ctx.createLinearGradient(
				meteor.x,
				meteor.y,
				meteor.x - meteor.vx * tail,
				meteor.y - meteor.vy * tail
			)
			gradient.addColorStop(0, `rgba(255,255,255,${0.7 * meteor.life})`)
			gradient.addColorStop(1, 'rgba(255,255,255,0)')
			ctx.strokeStyle = gradient
			ctx.lineWidth = 1.2
			ctx.beginPath()
			ctx.moveTo(meteor.x, meteor.y)
			ctx.lineTo(meteor.x - meteor.vx * tail, meteor.y - meteor.vy * tail)
			ctx.stroke()
			if (meteor.life <= 0 || meteor.x < -50 || meteor.y > size.height + 50) meteor = null
		}
	}
}

/* ------------------------------------------------------------------ */
/* Созвездие: точки дрейфуют, близкие соединяются линиями               */
/* ------------------------------------------------------------------ */

const constellationScene: TypeScene = (ctx, size) => {
	const count = Math.round(Math.min(70, (size.width * size.height) / 22000))
	const points = Array.from({ length: count }, () => ({
		x: Math.random() * size.width,
		y: Math.random() * size.height,
		vx: rand(-3, 3),
		vy: rand(-3, 3)
	}))
	return (_time, dt) => {
		for (const p of points) {
			p.x = (p.x + p.vx * dt + size.width) % size.width
			p.y = (p.y + p.vy * dt + size.height) % size.height
		}
		ctx.lineWidth = 1
		for (let i = 0; i < points.length; i++) {
			for (let j = i + 1; j < points.length; j++) {
				const dist = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y)
				if (dist < 140) {
					ctx.strokeStyle = `rgba(255,255,255,${0.05 * (1 - dist / 140)})`
					ctx.beginPath()
					ctx.moveTo(points[i].x, points[i].y)
					ctx.lineTo(points[j].x, points[j].y)
					ctx.stroke()
				}
			}
		}
		ctx.fillStyle = 'rgba(255,255,255,0.22)'
		for (const p of points) ctx.fillRect(p.x - 1, p.y - 1, 2, 2)
	}
}

/* ------------------------------------------------------------------ */
/* Волны: тонкие линии медленно колышутся                               */
/* ------------------------------------------------------------------ */

const wavesScene: TypeScene = (ctx, size) => {
	const lines = 14
	return time => {
		ctx.lineWidth = 1
		for (let i = 0; i < lines; i++) {
			const t = i / (lines - 1)
			const baseY = size.height * (0.35 + t * 0.6)
			const amplitude = 18 + t * 26
			ctx.strokeStyle =
				i % 4 === 0 ? `rgba(124,92,255,${0.1 + t * 0.06})` : `rgba(255,255,255,${0.03 + t * 0.03})`
			ctx.beginPath()
			for (let x = 0; x <= size.width + 20; x += 20) {
				const y =
					baseY +
					Math.sin(x * 0.004 + time * 0.25 + i * 0.5) * amplitude +
					Math.sin(x * 0.009 - time * 0.18 + i) * amplitude * 0.35
				if (x === 0) ctx.moveTo(x, y)
				else ctx.lineTo(x, y)
			}
			ctx.stroke()
		}
	}
}

/* ------------------------------------------------------------------ */
/* Светлячки: тёплые огоньки медленно поднимаются и мерцают             */
/* ------------------------------------------------------------------ */

const firefliesScene: TypeScene = (ctx, size) => {
	const count = Math.round(Math.min(45, (size.width * size.height) / 30000))
	const flies = Array.from({ length: count }, () => ({
		x: Math.random() * size.width,
		y: Math.random() * size.height,
		r: rand(1, 2.2),
		speed: rand(6, 14),
		sway: rand(10, 30),
		phase: rand(0, Math.PI * 2),
		pulse: rand(0.5, 1.4)
	}))
	return (time, dt) => {
		for (const fly of flies) {
			fly.y -= fly.speed * dt
			if (fly.y < -10) {
				fly.y = size.height + 10
				fly.x = Math.random() * size.width
			}
			const x = fly.x + Math.sin(time * 0.4 + fly.phase) * fly.sway
			const glow = 0.35 + 0.65 * Math.max(0, Math.sin(time * fly.pulse + fly.phase))
			const gradient = ctx.createRadialGradient(x, fly.y, 0, x, fly.y, fly.r * 7)
			gradient.addColorStop(0, `rgba(255,214,140,${0.55 * glow})`)
			gradient.addColorStop(1, 'rgba(255,214,140,0)')
			ctx.fillStyle = gradient
			ctx.beginPath()
			ctx.arc(x, fly.y, fly.r * 7, 0, Math.PI * 2)
			ctx.fill()
		}
	}
}
