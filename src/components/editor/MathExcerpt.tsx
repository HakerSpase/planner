'use client'

import katex from 'katex'
import 'katex/dist/katex.min.css'
import { memo } from 'react'

import { KATEX_MACROS } from './katex-macros'

/** Строка превью (из toExcerpt): текст как есть, $…$ — нарисованная формула, ⟦…⟧ — ссылка на лист */
export const MathExcerpt = memo(function MathExcerpt({ text }: { text: string }) {
	// Правило как в редакторе: «$5 и $10» — не формула
	const parts = text.split(/(\$(?!\s)[^$\n]+?(?<!\s)\$(?!\d)|⟦[^⟧]+⟧)/g)
	return (
		<>
			{parts.map((part, index) => {
				if (part.startsWith('⟦') && part.endsWith('⟧'))
					return (
						<span
							key={index}
							className='text-primary/90'
						>
							{part.slice(1, -1)}
						</span>
					)
				if (!(part.length > 2 && part.startsWith('$') && part.endsWith('$'))) return part
				let html: string
				try {
					html = katex.renderToString(part.slice(1, -1), {
						throwOnError: false,
						strict: 'ignore',
						macros: { ...KATEX_MACROS }
					})
				} catch {
					return part
				}
				return (
					<span
						key={index}
						className='math-excerpt'
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				)
			})}
		</>
	)
})
