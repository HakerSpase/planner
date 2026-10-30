'use client'

import { useMemo, useState } from 'react'

import { formatNumber } from './expression'
import { VISUAL_COLORS, useElementWidth } from './shared'

/*
 * Блок ```chart — диаграмма по данным:
 *
 *   type: bar        bar (столбцы), line (линии) или pie (круговая)
 *   title: Баллы
 *   series: Я, Класс  названия рядов, если значений несколько
 *   Пн: 12, 10
 *   Вт: 18, 14
 */

type TypeChart = 'bar' | 'line' | 'pie'

function parseChart(source: string) {
	let type: TypeChart = 'bar'
	let title = ''
	let series: string[] = []
	const rows: { label: string; values: number[] }[] = []
	for (const raw of source.split('\n')) {
		const line = raw.trim()
		if (!line || line.startsWith('#')) continue
		const index = line.lastIndexOf(':')
		if (index < 0) continue
		const key = line.slice(0, index).trim()
		const value = line.slice(index + 1).trim()
		if (/^(type|тип)$/i.test(key)) {
			const kind = value.toLowerCase()
			type = /pie|круг/.test(kind) ? 'pie' : /line|лин|граф/.test(kind) ? 'line' : 'bar'
		} else if (/^(title|заголовок)$/i.test(key)) title = value
		else if (/^(series|ряды)$/i.test(key)) series = value.split(/[,;]/).map(item => item.trim())
		else {
			const values = value.split(/[;,]\s*(?=-?\d)|\s+(?=-?\d)/).map(item => Number(item.replace(',', '.').replace('%', '')))
			if (values.length && values.every(Number.isFinite)) rows.push({ label: key, values })
		}
	}
	const count = Math.max(1, ...rows.map(row => row.values.length))
	return { type, title, rows, series: Array.from({ length: count }, (_, i) => series[i] || `Ряд ${i + 1}`) }
}

export function ChartView({ source }: { source: string }) {
	const chart = useMemo(() => parseChart(source), [source])
	const [containerRef, width] = useElementWidth<HTMLDivElement>()
	const [active, setActive] = useState<number | null>(null)

	if (!chart.rows.length)
		return (
			<figure className='visual-block not-prose px-3 py-4 text-sm text-subtle' contentEditable={false}>
				Нет данных: строки вида «Название: 12»
			</figure>
		)

	return (
		<figure
			className='visual-block not-prose'
			contentEditable={false}
		>
			{chart.title && <figcaption className='visual-title'>{chart.title}</figcaption>}
			<div
				ref={containerRef}
				className='overflow-x-auto overscroll-x-contain px-2 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
			>
				{width > 0 &&
					(chart.type === 'pie' ? (
						<Pie
							chart={chart}
							width={width}
							active={active}
							setActive={setActive}
						/>
					) : (
						<Cartesian
							chart={chart}
							width={width}
							active={active}
							setActive={setActive}
						/>
					))}
			</div>
			{(chart.series.length > 1 || chart.type === 'pie') && (
				<div className='flex flex-wrap gap-x-4 gap-y-1 border-t border-border px-3 py-2 text-xs text-muted'>
					{(chart.type === 'pie' ? chart.rows.map(row => row.label) : chart.series).map((label, index) => (
						<span
							key={label + index}
							onPointerEnter={() => chart.type === 'pie' && setActive(index)}
							onPointerLeave={() => chart.type === 'pie' && setActive(null)}
							className={`flex items-center gap-1.5 transition-colors ${
								chart.type === 'pie' && active === index ? 'text-fg' : ''
							}`}
						>
							<span
								className='h-2.5 w-2.5 shrink-0'
								style={{ background: VISUAL_COLORS[index % VISUAL_COLORS.length] }}
							/>
							{label}
						</span>
					))}
				</div>
			)}
		</figure>
	)
}

type TypeParsed = ReturnType<typeof parseChart>

function Cartesian({
	chart,
	width: containerWidth,
	active,
	setActive
}: {
	chart: TypeParsed
	width: number
	active: number | null
	setActive: (index: number | null) => void
}) {
	const maxChars = Math.max(8, ...chart.rows.map(row => Math.min(18, row.label.length)))
	const minBand = Math.max(76, Math.ceil(maxChars * 6.6) + 14)
	const left = 40
	const width = Math.max(containerWidth, left + 8 + chart.rows.length * minBand)
	const height = Math.round(Math.min(320, Math.max(200, containerWidth * 0.5)))
	const bottom = 26
	const top = 14
	const innerWidth = width - left - 8
	const innerHeight = height - top - bottom
	const all = chart.rows.flatMap(row => row.values)
	const max = Math.max(0, ...all)
	const min = Math.min(0, ...all)
	const span = max - min || 1
	const step = Math.pow(10, Math.floor(Math.log10(span / 4)))
	const tick = step * ([1, 2, 5, 10].find(item => step * item >= span / 4) ?? 10)
	const top_ = Math.ceil(max / tick) * tick
	const bottom_ = Math.floor(min / tick) * tick
	const toY = (value: number) => top + ((top_ - value) / (top_ - bottom_ || 1)) * innerHeight
	const band = innerWidth / chart.rows.length
	const ticks: number[] = []
	for (let value = bottom_; value <= top_ + tick / 2; value += tick) ticks.push(value)

	return (
		<svg
			width={width}
			height={height}
			className='block select-none'
			onPointerLeave={() => setActive(null)}
		>
			{ticks.map(value => (
				<g key={value}>
					<line
						x1={left}
						x2={width - 8}
						y1={toY(value)}
						y2={toY(value)}
						className={value === 0 ? 'stroke-white/35' : 'stroke-white/[0.07]'}
					/>
					<text
						x={left - 6}
						y={toY(value) + 4}
						textAnchor='end'
						className='visual-tick'
					>
						{formatNumber(value)}
					</text>
				</g>
			))}

			{chart.rows.map((row, index) => (
				<g
					key={row.label + index}
					onPointerEnter={() => setActive(index)}
					onPointerDown={() => setActive(index)}
				>
					<rect
						x={left + band * index}
						y={top}
						width={band}
						height={innerHeight}
						fill={active === index ? 'rgb(255 255 255 / 0.03)' : 'transparent'}
					/>
					{chart.type === 'bar' &&
						row.values.map((value, series) => {
							const group = band * 0.72
							const barWidth = group / row.values.length
							const x = left + band * index + (band - group) / 2 + barWidth * series
							const y = toY(Math.max(0, value))
							return (
								<g key={series}>
									<rect
										x={x + 1}
										y={y}
										width={Math.max(1, barWidth - 2)}
										height={Math.abs(toY(value) - toY(0))}
										fill={VISUAL_COLORS[series % VISUAL_COLORS.length]}
										opacity={active === null || active === index ? 1 : 0.55}
									/>
									{(active === index || chart.rows.length <= 8) && (
										<text
											x={x + barWidth / 2}
											y={y - 5}
											textAnchor='middle'
											className='visual-label'
										>
											{formatNumber(value)}
										</text>
									)}
								</g>
							)
						})}
					<text
						x={left + band * index + band / 2}
						y={height - 8}
						textAnchor='middle'
						className='visual-tick'
					>
						{row.label.length > 18 && band < 110 ? `${row.label.slice(0, 16)}…` : row.label}
					</text>
				</g>
			))}

			{chart.type === 'line' &&
				chart.series.map((_, series) => {
					const points = chart.rows.map((row, index) => [
						left + band * index + band / 2,
						toY(row.values[series] ?? 0)
					])
					return (
						<g key={series}>
							<polyline
								points={points.map(point => point.join(',')).join(' ')}
								fill='none'
								stroke={VISUAL_COLORS[series % VISUAL_COLORS.length]}
								strokeWidth={2.2}
								strokeLinejoin='round'
							/>
							{points.map(([x, y], index) => (
								<g key={index}>
									<circle
										cx={x}
										cy={y}
										r={active === index ? 5 : 3.5}
										fill={VISUAL_COLORS[series % VISUAL_COLORS.length]}
									/>
									{active === index && (
										<text
											x={x}
											y={y - 9}
											textAnchor='middle'
											className='visual-label'
										>
											{formatNumber(chart.rows[index].values[series] ?? 0)}
										</text>
									)}
								</g>
							))}
						</g>
					)
				})}
		</svg>
	)
}

function Pie({
	chart,
	width,
	active,
	setActive
}: {
	chart: TypeParsed
	width: number
	active: number | null
	setActive: (index: number | null) => void
}) {
	const size = Math.min(width, 280)
	const radius = size / 2 - 10
	const center = size / 2
	const values = chart.rows.map(row => Math.max(0, row.values[0]))
	const total = values.reduce((sum, value) => sum + value, 0) || 1
	let angle = -Math.PI / 2

	return (
		<div className='flex flex-col items-center'>
			<svg
				width={size}
				height={size}
				className='block shrink-0 select-none'
				onPointerLeave={() => setActive(null)}
			>
				{values.map((value, index) => {
					const start = angle
					const sweep = (value / total) * Math.PI * 2
					angle += sweep
					const end = angle
					const mid = (start + end) / 2
					const offset = active === index ? 6 : 0
					const cx = center + Math.cos(mid) * offset
					const cy = center + Math.sin(mid) * offset
					const large = sweep > Math.PI ? 1 : 0
					const path =
						sweep >= Math.PI * 2 - 1e-6
							? `M${cx - radius},${cy}a${radius},${radius} 0 1,0 ${radius * 2},0a${radius},${radius} 0 1,0 ${-radius * 2},0`
							: `M${cx},${cy}L${cx + radius * Math.cos(start)},${cy + radius * Math.sin(start)}A${radius},${radius} 0 ${large} 1 ${cx + radius * Math.cos(end)},${cy + radius * Math.sin(end)}Z`
					return (
						<g
							key={index}
							onPointerEnter={() => setActive(index)}
							onPointerDown={() => setActive(index)}
						>
							<path
								d={path}
								fill={VISUAL_COLORS[index % VISUAL_COLORS.length]}
								stroke='rgb(var(--bg))'
								strokeWidth={2}
							/>
							{sweep > 0.35 && (
								<text
									x={cx + Math.cos(mid) * radius * 0.62}
									y={cy + Math.sin(mid) * radius * 0.62 + 4}
									textAnchor='middle'
									className='visual-label fill-white'
								>
									{Math.round((value / total) * 100)}%
								</text>
							)}
						</g>
					)
				})}
			</svg>
			<div className='mt-2 flex min-h-[2.5rem] flex-col items-center justify-center text-center text-sm'>
				{active !== null ? (
					<>
						<p className='text-fg'>{chart.rows[active].label}</p>
						<p className='font-mono text-xs text-muted'>
							{formatNumber(values[active])} · {Math.round((values[active] / total) * 100)}%
						</p>
					</>
				) : (
					<p className='text-xs text-subtle'>Наведите на сектор</p>
				)}
			</div>
		</div>
	)
}
