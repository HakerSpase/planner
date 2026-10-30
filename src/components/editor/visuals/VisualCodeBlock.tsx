'use client'

import CodeBlock from '@tiptap/extension-code-block'
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import cn from 'clsx'
import { BarChart3, ChevronDown, Code2, LineChart, Orbit } from 'lucide-react'
import { useEffect, useState } from 'react'

import { ChartView } from './ChartView'
import { PlotView } from './PlotView'
import { UnitCircleView } from './UnitCircleView'

/*
 * Блоки кода с особым языком превращаются в наглядные блоки:
 *   ```plot   — графики функций
 *   ```circle — тригонометрическая окружность
 *   ```chart  — диаграммы по данным
 * Остальные языки — обычный код. В Markdown всё хранится как обычный ```блок.
 */

export const VISUAL_LANGUAGES: Record<string, 'plot' | 'circle' | 'chart'> = {
	plot: 'plot',
	graph: 'plot',
	график: 'plot',
	function: 'plot',
	circle: 'circle',
	'unit-circle': 'circle',
	окружность: 'circle',
	chart: 'chart',
	диаграмма: 'chart'
}

const META = {
	plot: { icon: LineChart, title: 'График' },
	circle: { icon: Orbit, title: 'Окружность' },
	chart: { icon: BarChart3, title: 'Диаграмма' }
}

/*
 * Нейросети (Gemini, ChatGPT) при копировании часто теряют язык блока — узнаём график,
 * окружность и диаграмму по содержимому
 */
function detectKind(language: string, source: string) {
	const known = VISUAL_LANGUAGES[language.toLowerCase()]
	if (known || (language && !/^(text|plaintext|txt)$/i.test(language))) return known
	if (/^\s*(type|тип)\s*:\s*(bar|line|pie|столб|лин|круг)/im.test(source)) return 'chart'
	if (/^\s*(angle|угол|θ)\s*[=:]/im.test(source) && source.trim().split('\n').length <= 4) return 'circle'
	if (/^\s*[xy]\s*:\s*[-−]?[\dπ.,\s]*(pi|π)?\s*\.\./im.test(source) || /^\s*(y|f\(x\))\s*=/im.test(source))
		return 'plot'
	return undefined
}

function CodeBlockView({ node, editor }: NodeViewProps) {
	const kind = detectKind(node.attrs.language || '', node.textContent)
	const [showCode, setShowCode] = useState(false)
	const [editable, setEditable] = useState(editor.isEditable)
	useEffect(() => {
		const update = () => setEditable(editor.isEditable)
		editor.on('update', update)
		editor.on('transaction', update)
		return () => {
			editor.off('update', update)
			editor.off('transaction', update)
		}
	}, [editor])

	if (!kind)
		return (
			<NodeViewWrapper as='pre'>
				<NodeViewContent
					as='code'
					className={node.attrs.language ? `language-${node.attrs.language}` : undefined}
				/>
			</NodeViewWrapper>
		)

	const source = node.textContent
	const { icon: Icon, title } = META[kind]
	const codeOpen = editable && (showCode || !source.trim())

	return (
		<NodeViewWrapper className='visual-node'>
			{kind === 'plot' && <PlotView source={source} />}
			{kind === 'circle' && <UnitCircleView source={source} />}
			{kind === 'chart' && <ChartView source={source} />}

			{editable && (
				<div
					contentEditable={false}
					className='flex items-center justify-between border-x border-b border-border bg-surface-2 px-3'
				>
					<span className='flex items-center gap-2 py-1.5 text-xs text-subtle'>
						<Icon size={13} />
						{title}
					</span>
					<button
						type='button'
						onClick={() => setShowCode(value => !value)}
						className='flex items-center gap-1.5 py-1.5 text-xs text-muted transition-colors hover:text-fg'
					>
						<Code2 size={13} />
						{codeOpen ? 'Скрыть описание' : 'Изменить'}
						<ChevronDown
							size={13}
							className={cn('transition-transform', codeOpen && 'rotate-180')}
						/>
					</button>
				</div>
			)}
			{/* Описание остаётся в документе всегда — его просто не видно, пока не открыли */}
			<pre className={cn('visual-source', !codeOpen && 'hidden')}>
				<NodeViewContent as='code' />
			</pre>
		</NodeViewWrapper>
	)
}

export const VisualCodeBlock = CodeBlock.extend({
	addNodeView() {
		return ReactNodeViewRenderer(CodeBlockView)
	}
})
