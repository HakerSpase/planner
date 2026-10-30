import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Общий экран для 404 и сбоев: крупный код ошибки поверх тихой сетки,
 * короткое объяснение и понятные действия — в стиле остального планера.
 */
export function ErrorScreen({
	code,
	title,
	description,
	actions,
	details
}: {
	code: string
	title: string
	description: string
	actions?: ReactNode
	details?: string
}) {
	return (
		<main className='relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-bg px-5 py-16 text-fg'>
			<div
				aria-hidden
				className='app-bg-grid pointer-events-none absolute inset-0 opacity-70'
			/>
			<div
				aria-hidden
				className='pointer-events-none absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[110px]'
			/>

			<section className='relative w-full max-w-lg animate-fade-in'>
				<p className='eyebrow'>Planner · ошибка {code}</p>
				<p
					aria-hidden
					className='mt-4 select-none bg-gradient-to-b from-primary via-primary/60 to-primary/10 bg-clip-text font-mono text-[clamp(5rem,22vw,9rem)] font-semibold leading-none tracking-[-0.06em] text-transparent'
				>
					{code}
				</p>
				<h1 className='mt-6 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl'>{title}</h1>
				<p className='mt-3 max-w-md text-sm leading-6 text-muted'>{description}</p>
				{details && (
					<p className='mt-4 break-all border-l-2 border-danger/60 bg-white/[0.03] px-3 py-2 font-mono text-xs leading-5 text-subtle'>
						{details}
					</p>
				)}
				<div className='mt-8 flex flex-wrap gap-2'>
					{actions}
					<Link
						href='/i'
						className='inline-flex h-10 items-center border border-border px-4 text-sm text-fg transition-colors hover:bg-white/[0.05]'
					>
						На главную
					</Link>
				</div>
			</section>
		</main>
	)
}
