'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { AI_FORMAT_PROMPT } from '@/lib/ai-format-prompt'

/** Готовая инструкция для нейросети: скопировал, вставил в чат — конспект придёт уже оформленным */
export function AiPrompt() {
	const [copied, setCopied] = useState(false)

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(AI_FORMAT_PROMPT)
			setCopied(true)
			toast.success('Промпт скопирован')
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error('Не получилось скопировать — выделите текст вручную')
		}
	}

	return (
		<div>
			<div className='relative border border-border bg-bg'>
				<pre className='max-h-60 overflow-y-auto whitespace-pre-wrap break-words p-3 font-mono text-xs leading-5 text-muted'>
					{AI_FORMAT_PROMPT}
				</pre>
				<div className='pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-bg to-transparent' />
			</div>
			<div className='mt-3 flex flex-wrap items-center gap-3'>
				<button
					type='button'
					onClick={copy}
					className='flex h-9 items-center gap-2 bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover'
				>
					{copied ? <Check size={15} /> : <Copy size={14} />}
					{copied ? 'Скопировано' : 'Скопировать промпт'}
				</button>
				<span className='text-xs leading-5 text-subtle'>
					Вставьте в начало чата с ChatGPT или Claude, затем копируйте ответ кнопкой «Копировать».
				</span>
			</div>
		</div>
	)
}
