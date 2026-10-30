'use client'

import type { Editor } from '@tiptap/react'
import cn from 'clsx'
import { BarChart3, GitFork, LineChart, Orbit } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const TEMPLATES = [
	{
		icon: LineChart,
		title: 'График функции',
		hint: 'Кривые, ползунки параметров, точки',
		language: 'plot',
		code: 'x: -5..5\ny = x^2 - 2 "парабола"\ny = a*x + 1\na = 1 (-3..3)'
	},
	{
		icon: Orbit,
		title: 'Тригонометрическая окружность',
		hint: 'Точку можно двигать, точные значения',
		language: 'circle',
		code: 'angle = 30\ntan = on'
	},
	{
		icon: BarChart3,
		title: 'Диаграмма',
		hint: 'Столбцы, линии или круговая',
		language: 'chart',
		code: 'type: bar\ntitle: Результаты\nПн: 3\nВт: 5\nСр: 4'
	},
	{
		icon: GitFork,
		title: 'Схема-разветвление',
		hint: 'Понятие и его ветви, вложенность отступом',
		language: 'tree',
		code: 'Главное понятие\n  Ветвь 1 #purple\n    Признак\n    Пример\n  Ветвь 2 #green\n    Признак\n    Пример'
	}
]

/** Кнопка панели: вставить наглядный блок с готовым примером, который легко поправить */
export function InsertVisualMenu({ editor }: { editor: Editor }) {
	const [open, setOpen] = useState(false)
	const rootRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const close = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
		}
		document.addEventListener('pointerdown', close)
		return () => document.removeEventListener('pointerdown', close)
	}, [open])

	return (
		<div
			ref={rootRef}
			className='contents'
		>
			<button
				type='button'
				title='График, окружность или диаграмма'
				aria-label='Вставить график или диаграмму'
				aria-expanded={open}
				onMouseDown={event => event.preventDefault()}
				onClick={() => setOpen(value => !value)}
				className={cn(
					'grid h-8 w-8 place-items-center transition-colors',
					open ? 'bg-white/[0.08] text-fg' : 'text-subtle hover:bg-white/[0.04] hover:text-fg'
				)}
			>
				<LineChart size={15} />
			</button>
			{open && (
				<div
					onMouseDown={event => event.preventDefault()}
					className='absolute inset-x-1 top-full z-30 mt-1 animate-pop-in border border-border bg-elevated p-1 shadow-pop sm:left-auto sm:w-80'
				>
					{TEMPLATES.map(({ icon: Icon, title, hint, language, code }) => (
						<button
							key={language}
							type='button'
							onClick={() => {
								editor
									.chain()
									.focus()
									.insertContent({
										type: 'codeBlock',
										attrs: { language },
										content: [{ type: 'text', text: code }]
									})
									.run()
								setOpen(false)
							}}
							className='flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.05]'
						>
							<Icon
								size={16}
								className='mt-0.5 shrink-0 text-primary'
							/>
							<span>
								<span className='block text-sm text-fg'>{title}</span>
								<span className='block text-xs text-subtle'>{hint}</span>
							</span>
						</button>
					))}
				</div>
			)}
		</div>
	)
}
