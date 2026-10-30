'use client'

import { useQuery } from '@tanstack/react-query'
import { Brain, ChevronRight } from 'lucide-react'
import Link from 'next/link'

import { flashcardsService, isDue } from '@/services/flashcards.service'

/** Полоска на главной: сколько карточек пора повторить */
export function CardsDue() {
	const { data: deck } = useQuery({
		queryKey: ['library', 'flashcards'],
		queryFn: flashcardsService.getDeck,
		staleTime: 5 * 60_000
	})
	const due = (deck || []).filter(card => isDue(card)).length
	if (!due) return null
	return (
		<Link
			href='/i/library?view=cards'
			className='group mb-4 flex items-center gap-3 border border-primary/30 bg-primary/[0.07] px-4 py-3 transition-colors hover:bg-primary/[0.12]'
		>
			<Brain
				size={18}
				className='shrink-0 text-primary'
			/>
			<span className='min-w-0 flex-1 text-sm text-fg'>
				Пора повторить карточки: <span className='font-mono font-semibold tabular-nums'>{due}</span>
			</span>
			<span className='flex items-center gap-1 text-sm text-primary'>
				Повторить
				<ChevronRight
					size={15}
					className='transition-transform group-hover:translate-x-0.5'
				/>
			</span>
		</Link>
	)
}
