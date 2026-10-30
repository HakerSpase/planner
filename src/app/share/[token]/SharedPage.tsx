'use client'

import dayjs from 'dayjs'
import 'dayjs/locale/ru'
import { Eye, Printer } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { ErrorScreen } from '@/components/ui/ErrorScreen'

import { createClient } from '@/lib/supabase/client'

const RichEditor = dynamic(
	() => import('@/components/editor/RichEditor').then(mod => mod.RichEditor),
	{ ssr: false, loading: () => <div className='h-64 animate-pulse bg-white/[0.02]' /> }
)

interface ISharedPage {
	title: string
	content: string
	updated_at: string
	topic: string | null
	section: string | null
}

const noop = () => {}

/** Лист архива по публичной ссылке — только чтение, без входа */
export function SharedPage({ token }: { token: string }) {
	const [page, setPage] = useState<ISharedPage | null | undefined>(undefined)
	const [selfCheck, setSelfCheck] = useState(false)

	useEffect(() => {
		createClient()
			.rpc('get_shared_page', { p_token: token })
			.then(({ data }) => {
				const row = (data as ISharedPage[] | null)?.[0] ?? null
				setPage(row)
				if (row?.title) document.title = `${row.title} | Planner`
			})
	}, [token])

	if (page === null)
		return (
			<ErrorScreen
				code='404'
				title='Ссылка не работает'
				description='Владелец закрыл доступ к листу или ссылка скопирована не полностью.'
			/>
		)

	return (
		<div className='h-[100dvh] overflow-y-auto bg-bg text-fg'>
			<header className='sticky top-0 z-20 border-b border-border bg-bg print:hidden'>
				<div className='mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4 sm:px-6'>
					<Link
						href='/'
						className='font-display text-sm font-semibold tracking-tight text-fg'
					>
						Planner
					</Link>
					<div className='flex items-center gap-2'>
						<span className='hidden font-mono text-2xs uppercase tracking-wider text-subtle sm:inline'>
							Только чтение
						</span>
						<button
							type='button'
							onClick={() => setSelfCheck(value => !value)}
							aria-pressed={selfCheck}
							className={`flex h-9 items-center gap-1.5 border px-3 text-sm transition-colors ${selfCheck ? 'border-primary/60 text-fg' : 'border-border text-muted hover:text-fg'}`}
						>
							<Eye size={14} />
							Проверка
						</button>
						<button
							type='button'
							onClick={() => window.print()}
							aria-label='Печать или PDF'
							title='Печать или PDF'
							className='grid h-9 w-9 place-items-center border border-border text-muted transition-colors hover:text-fg'
						>
							<Printer size={15} />
						</button>
					</div>
				</div>
			</header>

			<main className='library-article mx-auto max-w-3xl px-4 pb-24 pt-10 sm:px-6 sm:pt-14'>
				{page === undefined ? (
					<div className='space-y-4'>
						<div className='h-9 w-2/3 animate-pulse bg-white/[0.05]' />
						<div className='h-4 w-full animate-pulse bg-white/[0.04]' />
						<div className='h-4 w-5/6 animate-pulse bg-white/[0.04]' />
					</div>
				) : (
					<>
						{(page.section || page.topic) && (
							<p className='eyebrow'>{[page.section, page.topic].filter(Boolean).join(' / ')}</p>
						)}
						<h1 className='mt-2 break-words text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl'>
							{page.title || 'Без названия'}
						</h1>
						<p className='mb-8 mt-3 font-mono text-2xs uppercase tracking-wider text-subtle'>
							{dayjs(page.updated_at).locale('ru').format('D MMMM YYYY, HH:mm')}
						</p>
						<RichEditor
							value={page.content}
							onChange={noop}
							editable={false}
							selfCheck={selfCheck}
							contentClassName='library-reading'
						/>
					</>
				)}
			</main>
		</div>
	)
}
