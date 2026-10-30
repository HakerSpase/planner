'use client'

import { Minus, Plus, RotateCcw } from 'lucide-react'
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react'

import { type TypeCompiled, compile, evaluateConstant, formatNumber, formatPi } from './expression'
import { VISUAL_COLORS, useElementWidth } from './shared'

/*
 * Блок ```plot — график функций, как в ответах ChatGPT, только живой:
 *
 *   x: -2π..2π          диапазон по x (по y — сам, или y: -2..2)
 *   y = sin(x) "sin x"  кривые с подписью
 *   y = a*cos(x)
 *   a = 1 (0..3)        ползунок параметра
 *   point (π/2, 1) "max"
 */

interface ICurve {
	source: string
	label: string
	fn: TypeCompiled
	vertical?: number
}

interface IParameter {
	name: string
	value: number
	min: number
	max: number
	step: number
}

interface IPlotSpec {
	title?: string
	x?: [number, number]
	y?: [number, number]
	piAxis: boolean
	curves: ICurve[]
	parameters: IParameter[]
	points: { x: TypeCompiled; y: TypeCompiled; label: string }[]
	errors: string[]
}

const LABEL = /\s*"([^"]*)"\s*$/

function parseRange(value: string): [number, number] | undefined {
	const [from, to] = value.split(/\.\.|…|;/).map(part => evaluateConstant(part.trim()))
	return Number.isFinite(from) && Number.isFinite(to) && from < to ? [from, to] : undefined
}

export function parsePlot(source: string): IPlotSpec {
	const spec: IPlotSpec = { curves: [], parameters: [], points: [], errors: [], piAxis: /π|pi/.test(source) }
	const lines = source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'))

	// Сначала параметры — чтобы кривые знали их имена
	for (const line of lines) {
		const match = /^([a-zA-Zα-ω]\w*)\s*=\s*([^()]+?)\s*\(\s*(.+?)\s*\.\.\s*(.+?)\s*\)\s*$/.exec(line)
		if (!match || ['x', 'y'].includes(match[1])) continue
		try {
			const min = evaluateConstant(match[3])
			const max = evaluateConstant(match[4])
			spec.parameters.push({
				name: match[1],
				value: evaluateConstant(match[2]),
				min,
				max,
				step: (max - min) / 100
			})
		} catch {
			spec.errors.push(line)
		}
	}
	const variables = ['x', ...spec.parameters.map(parameter => parameter.name)]

	for (const line of lines) {
		try {
			const label = LABEL.exec(line)?.[1]
			const body = line.replace(LABEL, '')
			let match: RegExpExecArray | null
			if ((match = /^title\s*:\s*(.+)$/i.exec(body))) spec.title = match[1]
			else if ((match = /^x\s*:\s*(.+)$/i.exec(body))) spec.x = parseRange(match[1])
			else if ((match = /^y\s*:\s*(.+)$/i.exec(body))) spec.y = parseRange(match[1])
			else if ((match = /^(?:point|точка)\s*\(\s*(.+?)\s*[,;]\s*(.+?)\s*\)$/i.exec(body)))
				spec.points.push({
					x: compile(match[1], variables),
					y: compile(match[2], variables),
					label: label || ''
				})
			else if ((match = /^x\s*=\s*(.+)$/.exec(body))) {
				const fn = compile(match[1], variables)
				spec.curves.push({ source: body, label: label || body, fn, vertical: 0 })
			} else if ((match = /^(?:y|[a-zA-Z]\(x\))\s*=\s*(.+)$/.exec(body))) {
				spec.curves.push({ source: body, label: label || body, fn: compile(match[1], variables) })
			} else if (/=/.test(body) && /\(.*\.\..*\)/.test(body)) continue
			else if (/=/.test(body)) {
				// «y=» забыли — всё равно рисуем как функцию от x
				spec.curves.push({ source: body, label: label || body, fn: compile(body.split('=').pop()!, variables) })
			} else spec.curves.push({ source: body, label: label || `y = ${body}`, fn: compile(body, variables) })
		} catch (error) {
			spec.errors.push(`${line} — ${(error as Error).message}`)
		}
	}
	return spec
}

/** Аккуратные деления оси: 1, 2, 5 × 10ⁿ или кратные π/2 */
function ticks(min: number, max: number, pixels: number, pi: boolean) {
	const target = Math.max(2, Math.floor(pixels / 70))
	const raw = (max - min) / target
	let step: number
	if (pi) {
		const unit = Math.PI / 6
		const multiples = [1, 2, 3, 6, 12, 24, 48]
		step = unit * (multiples.find(item => unit * item >= raw) ?? 96)
	} else {
		const power = Math.pow(10, Math.floor(Math.log10(raw)))
		step = power * ([1, 2, 5, 10].find(item => power * item >= raw) ?? 10)
	}
	const result: number[] = []
	for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-6; value += step)
		result.push(Math.abs(value) < step * 1e-6 ? 0 : value)
	return result
}

const PADDING = { left: 8, right: 8, top: 8, bottom: 8 }

export function PlotView({ source }: { source: string }) {
	const spec = useMemo(() => parsePlot(source), [source])
	const [containerRef, width] = useElementWidth<HTMLDivElement>()
	const height = Math.round(Math.min(380, Math.max(240, width * 0.62)))

	const [values, setValues] = useState<Record<string, number>>({})
	useEffect(() => {
		setValues(Object.fromEntries(spec.parameters.map(parameter => [parameter.name, parameter.value])))
	}, [spec])
	const scope = useMemo(() => ({ ...values }), [values])

	// Видимая область: из описания или по умолчанию; дальше её двигает пользователь
	const initialView = useMemo(() => {
		const x = spec.x ?? (spec.piAxis ? [-2 * Math.PI, 2 * Math.PI] : [-10, 10])
		let y = spec.y
		if (!y) {
			// Подбираем y по значениям кривых, отбрасывая выбросы (асимптоты)
			const samples: number[] = []
			const params = Object.fromEntries(spec.parameters.map(parameter => [parameter.name, parameter.value]))
			spec.curves
				.filter(curve => curve.vertical === undefined)
				.forEach(curve => {
					for (let i = 0; i <= 200; i++) {
						const value = curve.fn({ ...params, x: x[0] + ((x[1] - x[0]) * i) / 200 })
						if (Number.isFinite(value)) samples.push(value)
					}
				})
			samples.sort((a, b) => a - b)
			const low = samples[Math.floor(samples.length * 0.03)] ?? -5
			const high = samples[Math.ceil(samples.length * 0.97) - 1] ?? 5
			const pad = Math.max((high - low) * 0.15, 0.5)
			y = [Math.min(low - pad, -0.5), Math.max(high + pad, 0.5)]
		}
		return { x: x as [number, number], y: y as [number, number] }
	}, [spec])
	const [view, setView] = useState(initialView)
	useEffect(() => setView(initialView), [initialView])

	const innerWidth = Math.max(10, width - PADDING.left - PADDING.right)
	const innerHeight = height - PADDING.top - PADDING.bottom
	const toX = (value: number) => PADDING.left + ((value - view.x[0]) / (view.x[1] - view.x[0])) * innerWidth
	const toY = (value: number) => PADDING.top + ((view.y[1] - value) / (view.y[1] - view.y[0])) * innerHeight
	const fromX = (pixel: number) => view.x[0] + ((pixel - PADDING.left) / innerWidth) * (view.x[1] - view.x[0])

	const paths = useMemo(() => {
		if (!width) return []
		const yRange = view.y[1] - view.y[0]
		return spec.curves.map(curve => {
			if (curve.vertical !== undefined) {
				const value = curve.fn({ ...scope, x: 0 })
				const px = toX(value)
				return `M${px},${PADDING.top}V${PADDING.top + innerHeight}`
			}
			const samples = Math.min(1200, Math.max(300, innerWidth * 1.5))
			let d = ''
			let previous: number | null = null
			for (let i = 0; i <= samples; i++) {
				const x = view.x[0] + ((view.x[1] - view.x[0]) * i) / samples
				const y = curve.fn({ ...scope, x })
				// Разрыв: не число или скачок через всю область (асимптота tg x)
				if (!Number.isFinite(y) || (previous !== null && Math.abs(y - previous) > yRange * 1.5)) {
					previous = Number.isFinite(y) ? y : null
					if (!Number.isFinite(y)) continue
					d += `M${toX(x).toFixed(1)},${toY(y).toFixed(1)}`
					continue
				}
				const clamped = Math.max(view.y[0] - yRange * 2, Math.min(view.y[1] + yRange * 2, y))
				d += `${previous === null ? 'M' : 'L'}${toX(x).toFixed(1)},${toY(clamped).toFixed(1)}`
				previous = y
			}
			return d
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [spec, scope, view, width, height])

	/* ---------- Перемещение и масштаб ---------- */

	const pointers = useRef(new Map<number, { x: number; y: number }>())
	const [hoverX, setHoverX] = useState<number | null>(null)

	const zoom = (factor: number, centerX = (view.x[0] + view.x[1]) / 2, centerY = (view.y[0] + view.y[1]) / 2) =>
		setView(current => ({
			x: [centerX - (centerX - current.x[0]) * factor, centerX + (current.x[1] - centerX) * factor],
			y: [centerY - (centerY - current.y[0]) * factor, centerY + (current.y[1] - centerY) * factor]
		}))

	const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
		pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
		if (event.pointerType === 'mouse') event.currentTarget.setPointerCapture(event.pointerId)
	}

	const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
		const rect = event.currentTarget.getBoundingClientRect()
		setHoverX(fromX(event.clientX - rect.left))
		const previous = pointers.current.get(event.pointerId)
		if (!previous) return
		const all = Array.from(pointers.current.values())
		const unitX = (view.x[1] - view.x[0]) / innerWidth
		const unitY = (view.y[1] - view.y[0]) / innerHeight
		if (pointers.current.size === 2) {
			// щипок двумя пальцами — масштаб
			const other = all.find(point => point !== previous)!
			const before = Math.hypot(previous.x - other.x, previous.y - other.y)
			const after = Math.hypot(event.clientX - other.x, event.clientY - other.y)
			if (before > 10 && after > 10) zoom(before / after)
		} else {
			const dx = (event.clientX - previous.x) * unitX
			const dy = (event.clientY - previous.y) * unitY
			setView(current => ({
				x: [current.x[0] - dx, current.x[1] - dx],
				y: [current.y[0] + dy, current.y[1] + dy]
			}))
		}
		pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
	}

	const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
		pointers.current.delete(event.pointerId)
	}

	const xTicks = width ? ticks(view.x[0], view.x[1], innerWidth, spec.piAxis) : []
	const yTicks = width ? ticks(view.y[0], view.y[1], innerHeight, false) : []
	const axisY = Math.min(Math.max(toY(0), PADDING.top), PADDING.top + innerHeight)
	const axisX = Math.min(Math.max(toX(0), PADDING.left), PADDING.left + innerWidth)

	return (
		<figure
			className='visual-block not-prose'
			contentEditable={false}
		>
			{spec.title && <figcaption className='visual-title'>{spec.title}</figcaption>}
			<div
				ref={containerRef}
				className='relative'
			>
				{width > 0 && (
					<svg
						width={width}
						height={height}
						className='block touch-pan-y select-none'
						onPointerDown={onPointerDown}
						onPointerMove={onPointerMove}
						onPointerUp={onPointerUp}
						onPointerCancel={onPointerUp}
						onPointerLeave={event => {
							onPointerUp(event)
							setHoverX(null)
						}}
						onWheel={event => {
							if (!event.ctrlKey && !event.metaKey) return
							event.preventDefault()
							const rect = event.currentTarget.getBoundingClientRect()
							const cx = fromX(event.clientX - rect.left)
							const cy = view.y[1] - ((event.clientY - rect.top - PADDING.top) / innerHeight) * (view.y[1] - view.y[0])
							zoom(event.deltaY > 0 ? 1.15 : 1 / 1.15, cx, cy)
						}}
					>
						<defs>
							<clipPath id={`clip-${width}-${height}`}>
								<rect
									x={PADDING.left}
									y={PADDING.top}
									width={innerWidth}
									height={innerHeight}
								/>
							</clipPath>
						</defs>

						{/* Сетка */}
						{xTicks.map(value => (
							<line
								key={`gx${value}`}
								x1={toX(value)}
								x2={toX(value)}
								y1={PADDING.top}
								y2={PADDING.top + innerHeight}
								className='stroke-white/[0.06]'
							/>
						))}
						{yTicks.map(value => (
							<line
								key={`gy${value}`}
								x1={PADDING.left}
								x2={PADDING.left + innerWidth}
								y1={toY(value)}
								y2={toY(value)}
								className='stroke-white/[0.06]'
							/>
						))}

						{/* Оси */}
						<line
							x1={PADDING.left}
							x2={PADDING.left + innerWidth}
							y1={axisY}
							y2={axisY}
							className='stroke-white/35'
						/>
						<line
							x1={axisX}
							x2={axisX}
							y1={PADDING.top}
							y2={PADDING.top + innerHeight}
							className='stroke-white/35'
						/>
						{xTicks.map(value =>
							value === 0 ? null : (
								<text
									key={`tx${value}`}
									x={toX(value)}
									y={Math.min(axisY + 14, PADDING.top + innerHeight - 4)}
									textAnchor='middle'
									className='visual-tick'
								>
									{spec.piAxis ? formatPi(value) : formatNumber(value)}
								</text>
							)
						)}
						{yTicks.map(value =>
							value === 0 ? null : (
								<text
									key={`ty${value}`}
									x={Math.max(axisX - 5, PADDING.left + 22)}
									y={toY(value) + 4}
									textAnchor='end'
									className='visual-tick'
								>
									{formatNumber(value)}
								</text>
							)
						)}

						<g clipPath={`url(#clip-${width}-${height})`}>
							{paths.map((d, index) => (
								<path
									key={index}
									d={d}
									fill='none'
									stroke={VISUAL_COLORS[index % VISUAL_COLORS.length]}
									strokeWidth={2.2}
									strokeLinejoin='round'
									strokeLinecap='round'
								/>
							))}

							{spec.points.map((point, index) => {
								const x = point.x(scope)
								const y = point.y(scope)
								if (!Number.isFinite(x) || !Number.isFinite(y)) return null
								return (
									<g key={index}>
										<circle
											cx={toX(x)}
											cy={toY(y)}
											r={4.5}
											className='fill-fg stroke-bg'
											strokeWidth={2}
										/>
										{point.label && (
											<text
												x={toX(x) + 8}
												y={toY(y) - 8}
												className='visual-label'
											>
												{point.label}
											</text>
										)}
									</g>
								)
							})}

							{/* Перекрестие: значения всех кривых под курсором */}
							{hoverX !== null && (
								<g>
									<line
										x1={toX(hoverX)}
										x2={toX(hoverX)}
										y1={PADDING.top}
										y2={PADDING.top + innerHeight}
										className='stroke-white/25'
										strokeDasharray='3 4'
									/>
									{spec.curves.map((curve, index) => {
										if (curve.vertical !== undefined) return null
										const y = curve.fn({ ...scope, x: hoverX })
										if (!Number.isFinite(y) || y < view.y[0] || y > view.y[1]) return null
										return (
											<circle
												key={index}
												cx={toX(hoverX)}
												cy={toY(y)}
												r={3.5}
												fill={VISUAL_COLORS[index % VISUAL_COLORS.length]}
											/>
										)
									})}
								</g>
							)}
						</g>
					</svg>
				)}

				<div className='absolute right-2 top-2 flex border border-border bg-bg/80'>
					<PlotButton
						label='Приблизить'
						onClick={() => zoom(1 / 1.4)}
					>
						<Plus size={14} />
					</PlotButton>
					<PlotButton
						label='Отдалить'
						onClick={() => zoom(1.4)}
					>
						<Minus size={14} />
					</PlotButton>
					<PlotButton
						label='Вернуть вид'
						onClick={() => setView(initialView)}
					>
						<RotateCcw size={13} />
					</PlotButton>
				</div>

				{hoverX !== null && (
					<div className='pointer-events-none absolute left-2 top-2 border border-border bg-bg/90 px-2 py-1 font-mono text-[11px] leading-4 text-muted'>
						<div>x = {spec.piAxis ? `${formatNumber(hoverX)} (${formatPi(Math.round(hoverX / (Math.PI / 12)) * (Math.PI / 12))})` : formatNumber(hoverX)}</div>
						{spec.curves.map((curve, index) =>
							curve.vertical !== undefined ? null : (
								<div
									key={index}
									style={{ color: VISUAL_COLORS[index % VISUAL_COLORS.length] }}
								>
									{curve.label.length > 18 ? `y${index + 1}` : curve.label} = {formatNumber(curve.fn({ ...scope, x: hoverX }))}
								</div>
							)
						)}
					</div>
				)}
			</div>

			{spec.parameters.length > 0 && (
				<div className='grid gap-2 border-t border-border px-3 py-3 sm:grid-cols-2'>
					{spec.parameters.map(parameter => (
						<label
							key={parameter.name}
							className='flex items-center gap-3'
						>
							<span className='w-6 font-mono text-sm italic text-fg'>{parameter.name}</span>
							<input
								type='range'
								min={parameter.min}
								max={parameter.max}
								step={parameter.step}
								value={values[parameter.name] ?? parameter.value}
								onChange={event =>
									setValues(current => ({ ...current, [parameter.name]: Number(event.target.value) }))
								}
								className='h-1 min-w-0 flex-1 cursor-pointer appearance-none bg-white/15 accent-primary'
							/>
							<span className='w-12 text-right font-mono text-xs tabular-nums text-muted'>
								{formatNumber(values[parameter.name] ?? parameter.value)}
							</span>
						</label>
					))}
				</div>
			)}

			{spec.curves.length > 1 && (
				<div className='flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted'>
					{spec.curves.map((curve, index) => (
						<span
							key={index}
							className='flex items-center gap-1.5'
						>
							<span
								className='h-0.5 w-4'
								style={{ background: VISUAL_COLORS[index % VISUAL_COLORS.length] }}
							/>
							{curve.label}
						</span>
					))}
				</div>
			)}

			{spec.errors.length > 0 && (
				<div className='border-t border-danger/30 px-3 py-2 font-mono text-xs leading-5 text-danger'>
					{spec.errors.map(error => (
						<div key={error}>{error}</div>
					))}
				</div>
			)}
		</figure>
	)
}

function PlotButton({
	label,
	onClick,
	children
}: {
	label: string
	onClick: () => void
	children: React.ReactNode
}) {
	return (
		<button
			type='button'
			title={label}
			aria-label={label}
			onClick={onClick}
			className='grid h-7 w-7 place-items-center text-subtle transition-colors hover:bg-white/[0.06] hover:text-fg'
		>
			{children}
		</button>
	)
}
