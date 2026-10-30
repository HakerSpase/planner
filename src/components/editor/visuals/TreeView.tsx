'use client'

import { Fragment, useMemo } from 'react'

import { MathExcerpt } from '../MathExcerpt'

import { VISUAL_COLORS } from './shared'

/*
 * Блок ```tree — схема-разветвление. Вложенность — отступом (2 пробела или «-»):
 *
 *   Средство связи в СПП
 *     Подчинительный союз #purple
 *       НЕ член предложения
 *       Примеры: что, чтобы, если
 *     Союзное слово #green
 *       Член предложения
 *
 * «#цвет» в конце строки красит ветку, **жирный** и $формулы$ работают.
 * Узел, у которого дети — только листья, рисуется карточкой со списком.
 */

interface ITreeNode {
	text: string
	color?: string
	children: ITreeNode[]
}

const NAMED: Record<string, string> = {
	red: '#fb7185',
	красный: '#fb7185',
	orange: '#fb923c',
	оранжевый: '#fb923c',
	yellow: '#fbbf24',
	жёлтый: '#fbbf24',
	желтый: '#fbbf24',
	green: '#4ade80',
	зелёный: '#4ade80',
	зеленый: '#4ade80',
	teal: '#2dd4bf',
	blue: '#38bdf8',
	синий: '#38bdf8',
	голубой: '#38bdf8',
	purple: '#8b7bff',
	фиолетовый: '#8b7bff',
	pink: '#f472b6',
	розовый: '#f472b6',
	gray: '#a1a1aa',
	серый: '#a1a1aa'
}

export function parseTree(source: string) {
	const root: ITreeNode = { text: '', children: [] }
	const stack: { indent: number; node: ITreeNode }[] = [
		{ indent: -1, node: root }
	]
	for (const raw of source.replace(/\t/g, '  ').split('\n')) {
		if (!raw.trim()) continue
		// Отступ + необязательный маркер списка или псевдографика «├──», «└─», «│»
		const match = /^([\s│|]*)(?:[├└┌┬┼─]+\s*|[-–*•+]\s+|\d+[.)]\s+)?(.*)$/.exec(
			raw
		)!
		const indent =
			match[1].replace(/[│|]/g, ' ').length +
			(match[0].length - match[1].length - match[2].length > 0 ? 1 : 0)
		let text = match[2].trim()
		let color: string | undefined
		const colorMatch = /\s+#([a-zа-яё]+|[0-9a-f]{6})$/i.exec(text)
		if (colorMatch) {
			const name = colorMatch[1].toLowerCase()
			color =
				NAMED[name] ?? (/^[0-9a-f]{6}$/.test(name) ? `#${name}` : undefined)
			if (color) text = text.slice(0, colorMatch.index)
		}
		if (!text) continue
		while (stack.length > 1 && stack[stack.length - 1].indent >= indent)
			stack.pop()
		const node: ITreeNode = { text, color, children: [] }
		stack[stack.length - 1].node.children.push(node)
		stack.push({ indent, node })
	}
	return root.children
}

function Label({ text }: { text: string }) {
	const parts = text.split(/(\*\*[^*]+\*\*)/g)
	return (
		<>
			{parts.map((part, index) =>
				part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
					<strong key={index}>
						<MathExcerpt text={part.slice(2, -2)} />
					</strong>
				) : (
					<Fragment key={index}>
						<MathExcerpt text={part} />
					</Fragment>
				)
			)}
		</>
	)
}

function Branch({
	node,
	color,
	depth
}: {
	node: ITreeNode
	color: string
	depth: number
}) {
	const tint = node.color ?? color
	const leavesOnly =
		node.children.length > 0 &&
		node.children.every(child => !child.children.length)

	// Карточка: заголовок и список листьев
	if (leavesOnly && depth > 0)
		return (
			<div
				className='tree-card'
				style={{ '--tree': tint } as React.CSSProperties}
			>
				<div className='tree-card-title'>
					<Label text={node.text} />
				</div>
				<ul>
					{node.children.map((child, index) => (
						<li
							key={index}
							style={
								child.color
									? ({ '--tree': child.color } as React.CSSProperties)
									: undefined
							}
						>
							<Label text={child.text} />
						</li>
					))}
				</ul>
			</div>
		)

	return (
		<div className='tree-branch'>
			<div
				className={depth === 0 ? 'tree-node tree-root' : 'tree-node'}
				style={{ '--tree': tint } as React.CSSProperties}
			>
				<Label text={node.text} />
			</div>
			{node.children.length > 0 && (
				<div
					className='tree-children'
					style={{ '--tree': tint } as React.CSSProperties}
				>
					{node.children.map((child, index) => (
						<div
							key={index}
							className='tree-child'
						>
							<Branch
								node={child}
								color={
									depth === 0
										? (child.color ??
											VISUAL_COLORS[index % VISUAL_COLORS.length])
										: tint
								}
								depth={depth + 1}
							/>
						</div>
					))}
				</div>
			)}
		</div>
	)
}

export function TreeView({ source }: { source: string }) {
	const roots = useMemo(() => parseTree(source), [source])
	if (!roots.length)
		return (
			<div className='visual-block p-4 text-sm text-subtle'>
				Пустая схема — опишите узлы с отступами
			</div>
		)
	return (
		<div className='visual-block tree-view'>
			{roots.map((root, index) => (
				<Branch
					key={index}
					node={root}
					color={root.color ?? '#a1a1aa'}
					depth={0}
				/>
			))}
		</div>
	)
}
