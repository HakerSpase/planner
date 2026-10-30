'use client'

import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import { evaluateConstant, formatNumber, formatPi } from './expression'
import { useElementWidth } from './shared'

/*
 * Блок ```circle — тригонометрическая окружность: точку можно тянуть пальцем,
 * видно cos и sin как проекции, для табличных углов — точные значения.
 *
 *   angle = 45      начальный угол в градусах (или π/4)
 *   tan = on        показать линию тангенсов
 */

const SIN_EXACT: Record<number, string> = { 0: '0', 30: '1/2', 45: '√2/2', 60: '√3/2', 90: '1' }
const TAN_EXACT: Record<number, string> = { 0: '0', 30: '√3/3', 45: '1', 60: '√3' }

const COS_COLOR = '#38bdf8'
const SIN_COLOR = '#f472b6'
const TAN_COLOR = '#fbbf24'

function exactValues(degrees: number) {
	const angle = ((Math.round(degrees) % 360) + 360) % 360
	const quadrantSign = (value: number) => (value < -1e-9 ? '−' : '')
	const reference = (() => {
		const inHalf = angle % 180
		return inHalf > 90 ? 180 - inHalf : inHalf
	})()
	const rad = (angle * Math.PI) / 180
	const sin = SIN_EXACT[reference]
	const cos = SIN_EXACT[90 - reference]
	if (sin === undefined || Math.abs(degrees - Math.round(degrees)) > 1e-6) return null
	const tan = reference === 90 ? 'не сущ.' : TAN_EXACT[reference]
	const signed = (text: string, value: number) => (text === '0' ? '0' : quadrantSign(value) + text)
	return {
		sin: signed(sin, Math.sin(rad)),
		cos: signed(cos, Math.cos(rad)),
		tan: tan === 'не сущ.' ? tan : signed(tan, Math.tan(rad))
	}
}

function parseCircle(source: string) {
	let angle = 45
	let showTan = false
	for (const line of source.split('\n')) {
		const [key, value] = line.split(/[=:]/).map(part => part?.trim())
		if (!value) continue
		if (/^(angle|угол|θ)$/i.test(key)) {
			try {
				angle = /π|pi/.test(value) ? (evaluateConstant(value) * 180) / Math.PI : evaluateConstant(value)
			} catch {}
		}
		if (/^(tan|tg)$/i.test(key)) showTan = /^(on|да|true|1)$/i.test(value)
	}
	return { angle, showTan }
}

export function UnitCircleView({ source }: { source: string }) {
	const spec = useMemo(() => parseCircle(source), [source])
	const [degrees, setDegrees] = useState(spec.angle)
	useEffect(() => setDegrees(spec.angle), [spec.angle])
	const [containerRef, width] = useElementWidth<HTMLDivElement>()
	const svgRef = useRef<SVGSVGElement>(null)
	const dragging = useRef(false)

	const size = Math.min(width, 360)
	const center = size / 2
	const radius = size * 0.36
	const rad = (degrees * Math.PI) / 180
	const px = center + radius * Math.cos(rad)
	const py = center - radius * Math.sin(rad)
	const exact = exactValues(degrees)

	const setFromPointer = (event: ReactPointerEvent) => {
		const rect = svgRef.current!.getBoundingClientRect()
		const x = event.clientX - rect.left - center
		const y = center - (event.clientY - rect.top)
		let value = (Math.atan2(y, x) * 180) / Math.PI
		if (value < 0) value += 360
		// Притягиваем к табличным углам — их и нужно запоминать
		const snap = Math.round(value / 15) * 15
		setDegrees(Math.abs(snap - value) < 4 ? snap % 360 : Math.round(value))
	}

	const arcEnd = { x: center + radius * 0.28 * Math.cos(rad), y: center - radius * 0.28 * Math.sin(rad) }
	const normalized = ((degrees % 360) + 360) % 360
	const tanY = center - radius * Math.tan(rad)

	return (
		<figure
			className='visual-block not-prose'
			contentEditable={false}
		>
			<div className='grid gap-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]'>
				<div
					ref={containerRef}
					className='flex justify-center px-2 py-3'
				>
					{size > 0 && (
						<svg
							ref={svgRef}
							width={size}
							height={size}
							className='block select-none'
						>
							<line
								x1={8}
								x2={size - 8}
								y1={center}
								y2={center}
								className='stroke-white/30'
							/>
							<line
								x1={center}
								x2={center}
								y1={8}
								y2={size - 8}
								className='stroke-white/30'
							/>
							<text
								x={size - 10}
								y={center - 6}
								textAnchor='end'
								className='visual-tick'
							>
								cos
							</text>
							<text
								x={center + 6}
								y={16}
								className='visual-tick'
							>
								sin
							</text>

							{/* Табличные углы — риски на окружности */}
							{Array.from({ length: 24 }, (_, index) => index * 15)
								.filter(angle => angle % 30 === 0 || angle % 45 === 0)
								.map(angle => {
									const a = (angle * Math.PI) / 180
									return (
										<line
											key={angle}
											x1={center + (radius - 4) * Math.cos(a)}
											y1={center - (radius - 4) * Math.sin(a)}
											x2={center + (radius + 4) * Math.cos(a)}
											y2={center - (radius + 4) * Math.sin(a)}
											className='stroke-white/30'
										/>
									)
								})}

							<circle
								cx={center}
								cy={center}
								r={radius}
								fill='none'
								stroke='#8b7bff'
								strokeWidth={2}
							/>

							{spec.showTan && Math.abs(Math.cos(rad)) > 0.02 && (
								<>
									<line
										x1={center + radius}
										x2={center + radius}
										y1={8}
										y2={size - 8}
										stroke={TAN_COLOR}
										strokeOpacity={0.35}
									/>
									<line
										x1={center}
										y1={center}
										x2={center + radius}
										y2={tanY}
										stroke={TAN_COLOR}
										strokeDasharray='4 4'
									/>
									<line
										x1={center + radius}
										x2={center + radius}
										y1={center}
										y2={tanY}
										stroke={TAN_COLOR}
										strokeWidth={3}
									/>
								</>
							)}

							{/* Дуга угла */}
							<path
								d={`M${center + radius * 0.28},${center} A${radius * 0.28},${radius * 0.28} 0 ${normalized > 180 ? 1 : 0} 0 ${arcEnd.x},${arcEnd.y}`}
								fill='none'
								className='stroke-white/50'
							/>
							<text
								x={center + radius * 0.4 * Math.cos(rad / 2)}
								y={center - radius * 0.4 * Math.sin(rad / 2) + 4}
								textAnchor='middle'
								className='visual-label'
							>
								θ
							</text>

							<line
								x1={center}
								y1={center}
								x2={px}
								y2={py}
								stroke='#8b7bff'
								strokeWidth={2}
							/>
							{/* Проекции: cos — на ось x, sin — на ось y */}
							<line
								x1={px}
								y1={py}
								x2={px}
								y2={center}
								stroke={SIN_COLOR}
								strokeDasharray='4 4'
							/>
							<line
								x1={px}
								y1={py}
								x2={center}
								y2={py}
								stroke={COS_COLOR}
								strokeDasharray='4 4'
								strokeOpacity={0.6}
							/>
							<line
								x1={center}
								y1={center}
								x2={px}
								y2={center}
								stroke={COS_COLOR}
								strokeWidth={3.5}
							/>
							<line
								x1={center}
								y1={center}
								x2={center}
								y2={py}
								stroke={SIN_COLOR}
								strokeWidth={3.5}
							/>

							{/* Точку тянем пальцем; вокруг неё — большая зона касания */}
							<circle
								cx={px}
								cy={py}
								r={18}
								fill='transparent'
								className='cursor-grab touch-none active:cursor-grabbing'
								onPointerDown={event => {
									dragging.current = true
									;(event.target as Element).setPointerCapture(event.pointerId)
								}}
								onPointerMove={event => dragging.current && setFromPointer(event)}
								onPointerUp={() => (dragging.current = false)}
								onPointerCancel={() => (dragging.current = false)}
							/>
							<circle
								cx={px}
								cy={py}
								r={6}
								className='pointer-events-none fill-white'
							/>
							<text
								x={px + (Math.cos(rad) >= 0 ? 10 : -10)}
								y={py + (Math.sin(rad) >= 0 ? -10 : 18)}
								textAnchor={Math.cos(rad) >= 0 ? 'start' : 'end'}
								className='visual-label pointer-events-none'
							>
								P
							</text>
						</svg>
					)}
				</div>

				<div className='flex flex-col justify-center gap-3 border-t border-border px-4 py-4 sm:border-l sm:border-t-0'>
					<div>
						<p className='eyebrow'>Угол</p>
						<p className='mt-1 font-mono text-lg text-fg'>
							{formatNumber(normalized)}° <span className='text-sm text-muted'>= {formatPi((normalized * Math.PI) / 180)}</span>
						</p>
					</div>
					<Value
						label='cos θ'
						color={COS_COLOR}
						exact={exact?.cos}
						value={Math.cos(rad)}
					/>
					<Value
						label='sin θ'
						color={SIN_COLOR}
						exact={exact?.sin}
						value={Math.sin(rad)}
					/>
					<Value
						label='tg θ'
						color={TAN_COLOR}
						exact={exact?.tan}
						value={Math.abs(Math.cos(rad)) < 1e-9 ? NaN : Math.tan(rad)}
					/>
					<input
						type='range'
						min={0}
						max={360}
						step={1}
						value={normalized}
						aria-label='Угол'
						onChange={event => setDegrees(Number(event.target.value))}
						className='h-1 w-full cursor-pointer appearance-none bg-white/15 accent-primary'
					/>
				</div>
			</div>
		</figure>
	)
}

function Value({ label, color, exact, value }: { label: string; color: string; exact?: string; value: number }) {
	return (
		<div className='flex items-baseline justify-between gap-3'>
			<span
				className='font-mono text-sm'
				style={{ color }}
			>
				{label}
			</span>
			<span className='font-mono text-sm text-fg'>
				{exact ?? formatNumber(value)}
				{exact && exact !== 'не сущ.' && !/^−?[01]$/.test(exact) && (
					<span className='ml-2 text-xs text-subtle'>≈ {formatNumber(value)}</span>
				)}
			</span>
		</div>
	)
}
