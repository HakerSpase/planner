'use client'

import cn from 'clsx'
import { Check, RotateCcw, Shuffle, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'

import type { IFlashcard } from '@/components/editor/study'

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{
		ssr: false,
		loading: () => <div className='h-8 animate-pulse bg-white/[0.03]' />
	}
)

const noop = () => {}

function CardSide({ markdown }: { markdown: string }) {
	return (
		<RichEditor
			value={markdown}
			onChange={noop}
			editable={false}
			contentClassName='library-reading card-side'
		/>
	)
}

const shuffle = <T,>(items: T[]) => {
	const copy = [...items]
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1))
		;[copy[i], copy[j]] = [copy[j], copy[i]]
	}
	return copy
}

/**
 * Карточки листа по публичной ссылке: вопрос → «Показать ответ» → «Знаю» / «Не знаю».
 * Без входа и без сохранения прогресса: «Не знаю» возвращает карточку в конец круга,
 * в конце — итог и повтор ошибок.
 */
export function SharedCards({ cards }: { cards: IFlashcard[] }) {
	const [queue, setQueue] = useState(cards)
	const [round, setRound] = useState(cards.length)
	const [revealed, setRevealed] = useState(false)
	const [known, setKnown] = useState(0)
	const [missed, setMissed] = useState<IFlashcard[]>([])
	const [attempt, setAttempt] = useState(0)
	const card = queue[0]

	const restart = (list: IFlashcard[]) => {
		setQueue(list)
		setRound(list.length)
		setRevealed(false)
		setKnown(0)
		setMissed([])
		setAttempt(value => value + 1)
	}

	const answer = useCallback(
		(knows: boolean) => {
			if (!card) return
			setRevealed(false)
			setAttempt(value => value + 1)
			if (knows) {
				setKnown(value => value + 1)
				setQueue(current => current.slice(1))
			} else {
				setMissed(current =>
					current.some(item => item.id === card.id)
						? current
						: [...current, card]
				)
				setQueue(current => [...current.slice(1), card])
			}
		},
		[card]
	)

	// Пробел / Enter — показать ответ; → или 2 — знаю, ← или 1 — не знаю
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (!card || event.ctrlKey || event.metaKey || event.altKey) return
			if (!revealed && (event.key === ' ' || event.key === 'Enter')) {
				event.preventDefault()
				setRevealed(true)
			} else if (revealed && (event.key === 'ArrowRight' || event.key === '2'))
				answer(true)
			else if (revealed && (event.key === 'ArrowLeft' || event.key === '1'))
				answer(false)
		}
		window.addEventListener('keydown', onKey)
		return () => window.removeEventListener('keydown', onKey)
	}, [card, revealed, answer])

	const progress = round ? (known / round) * 100 : 100

	return (
		<div className='mx-auto w-full max-w-2xl'>
			<div className='mb-3 flex items-center justify-between gap-3'>
				<span className='font-mono text-xs tabular-nums text-muted'>
					{Math.min(known + (card ? 1 : 0), round)} / {round}
					{missed.length > 0 && (
						<span className='text-danger'> · ошибок {missed.length}</span>
					)}
				</span>
				{card && (
					<button
						type='button'
						onClick={() => restart(shuffle(cards))}
						className='flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-fg'
					>
						<Shuffle size={13} />
						Перемешать
					</button>
				)}
			</div>
			<div className='mb-5 h-1 bg-white/[0.06]'>
				<div
					className='h-full bg-primary transition-[width] duration-300'
					style={{ width: `${progress}%` }}
				/>
			</div>

			{card ? (
				<div
					key={`${card.id}:${attempt}`}
					className='animate-fade-in border border-border bg-surface'
				>
					<div
						onClick={() => setRevealed(true)}
						className={cn(
							'border-b border-border px-5 py-7 sm:px-8 sm:py-9',
							!revealed && 'cursor-pointer'
						)}
					>
						<p className='eyebrow mb-3'>Вопрос</p>
						<div className='text-lg'>
							<CardSide markdown={card.front} />
						</div>
					</div>

					{revealed ? (
						<>
							<div className='animate-fade-in border-b border-border bg-bg/40 px-5 py-6 sm:px-8'>
								<p className='eyebrow mb-3'>Ответ</p>
								<CardSide markdown={card.back} />
							</div>
							<div className='grid grid-cols-2 gap-2 p-3'>
								<button
									type='button'
									onClick={() => answer(false)}
									className='flex h-14 items-center justify-center gap-2 border border-danger/50 text-sm font-medium text-danger transition-colors hover:bg-danger/10'
								>
									<X size={16} />
									Не знаю
									<span className='key-hint hidden font-mono text-2xs opacity-70 sm:inline'>
										←
									</span>
								</button>
								<button
									type='button'
									onClick={() => answer(true)}
									className='flex h-14 items-center justify-center gap-2 border border-success/50 text-sm font-medium text-success transition-colors hover:bg-success/10'
								>
									<Check size={16} />
									Знаю
									<span className='key-hint hidden font-mono text-2xs opacity-70 sm:inline'>
										→
									</span>
								</button>
							</div>
						</>
					) : (
						<div className='p-3'>
							<button
								type='button'
								onClick={() => setRevealed(true)}
								className='h-14 w-full bg-primary text-sm font-medium text-white transition-colors hover:bg-primary-hover'
							>
								Показать ответ
								<span className='key-hint ml-2 hidden font-mono text-xs opacity-70 sm:inline'>
									пробел
								</span>
							</button>
						</div>
					)}
				</div>
			) : (
				<div className='animate-fade-in border border-border bg-surface px-6 py-14 text-center'>
					<Check
						size={28}
						className='mx-auto text-success'
					/>
					<p className='mt-3 text-lg font-semibold text-fg'>
						Все карточки пройдены
					</p>
					<p className='mt-1 text-sm text-muted'>
						{missed.length
							? `С первого раза: ${round - missed.length} из ${round}. Ошибок: ${missed.length}.`
							: `Все ${round} — с первого раза.`}
					</p>
					<div className='mt-6 flex flex-col justify-center gap-2 sm:flex-row'>
						{missed.length > 0 && (
							<button
								type='button'
								onClick={() => restart(missed)}
								className='flex h-11 items-center justify-center gap-2 bg-primary px-4 text-sm font-medium text-white hover:bg-primary-hover'
							>
								<RotateCcw size={14} />
								Повторить ошибки ({missed.length})
							</button>
						)}
						<button
							type='button'
							onClick={() => restart(shuffle(cards))}
							className={cn(
								'flex h-11 items-center justify-center gap-2 px-4 text-sm font-medium',
								missed.length
									? 'border border-border text-muted hover:text-fg'
									: 'bg-primary text-white hover:bg-primary-hover'
							)}
						>
							<Shuffle size={14} />
							Пройти заново
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
