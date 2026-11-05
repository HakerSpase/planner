'use client'

import cn from 'clsx'
import { Check, Copy, Link2, Share2, Unlink, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { useBackClose } from '@/hooks/useBackClose'

import { copyText } from '@/lib/clipboard'
import { shareLink } from '@/lib/share'
import {
	type IBundleRow,
	type TypeBundleKind,
	libraryShareService
} from '@/services/library-share.service'
import type {
	ILibrarySection,
	ILibraryTopic
} from '@/services/library.service'

/**
 * Поделиться разделом или подразделами. Галочками выбирается, что войдёт в ссылку;
 * у раздела по умолчанию всё (и то, что появится позже).
 */
export function BundleShareDialog({
	kind,
	section,
	topics,
	topicId,
	onClose
}: {
	kind: TypeBundleKind
	section: ILibrarySection
	/** Подразделы этого раздела */
	topics: ILibraryTopic[]
	/** С какого подраздела начали */
	topicId?: string
	onClose: () => void
}) {
	useBackClose(true, onClose)
	const [row, setRow] = useState<IBundleRow | null | undefined>(undefined)
	const [unavailable, setUnavailable] = useState(false)
	const [selected, setSelected] = useState<Set<string>>(
		() =>
			new Set(
				kind === 'section'
					? topics.map(topic => topic.id)
					: topicId
						? [topicId]
						: []
			)
	)
	const [allowCopy, setAllowCopy] = useState(true)
	const [busy, setBusy] = useState(false)
	const [copied, setCopied] = useState(false)

	useEffect(() => {
		libraryShareService
			.getBundleRow(section.id, kind)
			.then(existing => {
				setRow(existing)
				if (!existing) return
				setAllowCopy(existing.allow_copy)
				if (existing.topic_ids) setSelected(new Set(existing.topic_ids))
				else setSelected(new Set(topics.map(topic => topic.id)))
			})
			.catch(() => {
				setRow(null)
				setUnavailable(true)
			})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [section.id, kind])

	const url = row
		? `${window.location.origin}/share/b/${row.token}`
		: ''
	const title = section.title

	// Всё выбрано у раздела — храним «все», чтобы новые подразделы тоже попадали в ссылку
	const toTopicIds = (ids: Set<string>) =>
		kind === 'section' && ids.size === topics.length ? null : Array.from(ids)

	const toggleTopic = async (id: string) => {
		const next = new Set(selected)
		if (next.has(id)) next.delete(id)
		else next.add(id)
		if (!next.size) return toast.info('Нужен хотя бы один подраздел')
		setSelected(next)
		if (!row) return
		try {
			await libraryShareService.updateBundle(row.token, {
				topic_ids: toTopicIds(next)
			})
		} catch {
			toast.error('Не получилось сохранить')
			setSelected(selected)
		}
	}

	const toggleCopy = async () => {
		const next = !allowCopy
		setAllowCopy(next)
		if (!row) return
		try {
			await libraryShareService.updateBundle(row.token, { allow_copy: next })
		} catch {
			toast.error('Не получилось сохранить')
			setAllowCopy(!next)
		}
	}

	const create = async () => {
		setBusy(true)
		try {
			setRow(
				await libraryShareService.createBundle({
					kind,
					section_id: section.id,
					topic_ids: toTopicIds(selected),
					allow_copy: allowCopy
				})
			)
		} catch {
			toast.error('Не получилось создать ссылку')
		}
		setBusy(false)
	}

	const revoke = async () => {
		if (!row) return
		setBusy(true)
		try {
			await libraryShareService.removeBundle(row.token)
			setRow(null)
			toast.success('Ссылка больше не работает')
		} catch {
			toast.error('Не получилось закрыть доступ')
		}
		setBusy(false)
	}

	const copy = async () => {
		try {
			await copyText(url)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			toast.error('Не получилось скопировать')
		}
	}

	const share = async () => {
		try {
			const result = await shareLink({ title, url })
			if (result === 'copied') toast.success('Ссылка скопирована')
		} catch {
			toast.error('Не получилось поделиться')
		}
	}

	if (typeof document === 'undefined') return null
	return createPortal(
		<div
			className='fixed inset-0 z-[110] flex animate-fade-in items-end justify-center bg-black/60 sm:items-center sm:p-4'
			onMouseDown={event => event.target === event.currentTarget && onClose()}
		>
			<section className='flex max-h-[85dvh] w-full max-w-md animate-pop-in flex-col border border-border bg-elevated p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-pop sm:pb-5'>
				<div className='flex items-start justify-between gap-3'>
					<div className='min-w-0'>
						<h2 className='text-base font-semibold text-fg'>
							{kind === 'section'
								? 'Поделиться разделом'
								: 'Поделиться подразделами'}
						</h2>
						<p className='mt-1 truncate text-sm text-muted'>{section.title}</p>
					</div>
					<button
						type='button'
						onClick={onClose}
						aria-label='Закрыть'
						className='grid h-8 w-8 shrink-0 place-items-center text-subtle hover:text-fg'
					>
						<X size={16} />
					</button>
				</div>

				{unavailable ? (
					<p className='mt-4 border border-warning/40 bg-warning/[0.06] p-3 text-sm leading-5 text-fg'>
						Эта функция заработает после обновления базы данных.
					</p>
				) : row === undefined ? (
					<div className='mt-4 h-40 animate-pulse bg-white/[0.04]' />
				) : (
					<>
						<p className='eyebrow mb-1.5 mt-4'>Что войдёт в ссылку</p>
						<ul className='min-h-0 flex-1 overflow-y-auto border border-border'>
							{topics.map(topic => {
								const on = selected.has(topic.id)
								return (
									<li
										key={topic.id}
										className='border-b border-border last:border-b-0'
									>
										<button
											type='button'
											role='checkbox'
											aria-checked={on}
											onClick={() => toggleTopic(topic.id)}
											className='flex min-h-10 w-full items-center gap-3 px-3 py-2 text-left text-sm text-fg transition-colors hover:bg-white/[0.03]'
										>
											<span
												className={cn(
													'grid h-4 w-4 shrink-0 place-items-center border',
													on
														? 'border-primary bg-primary text-white'
														: 'border-white/25'
												)}
											>
												{on && <Check size={11} />}
											</span>
											<span className='min-w-0 flex-1 truncate'>
												{topic.title}
											</span>
										</button>
									</li>
								)
							})}
							{!topics.length && (
								<li className='px-3 py-3 text-sm text-subtle'>
									В разделе пока нет подразделов
								</li>
							)}
						</ul>

						<button
							type='button'
							role='checkbox'
							aria-checked={allowCopy}
							onClick={toggleCopy}
							className='mt-3 flex w-full items-center gap-3 text-left text-sm text-fg'
						>
							<span
								className={cn(
									'grid h-4 w-4 shrink-0 place-items-center border',
									allowCopy
										? 'border-primary bg-primary text-white'
										: 'border-white/25'
								)}
							>
								{allowCopy && <Check size={11} />}
							</span>
							Разрешить добавить к себе
						</button>

						<div className='mt-4'>
							{row ? (
								<>
									<div className='flex border border-border bg-bg'>
										<input
											readOnly
											value={url}
											onFocus={event => event.currentTarget.select()}
											className='min-w-0 flex-1 bg-transparent px-3 font-mono text-xs text-fg outline-none'
										/>
										<button
											type='button'
											onClick={copy}
											className='flex h-10 shrink-0 items-center gap-1.5 bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover'
										>
											{copied ? <Check size={14} /> : <Copy size={14} />}
											<span className='sm-max:hidden'>
												{copied ? 'Готово' : 'Копировать'}
											</span>
										</button>
										<button
											type='button'
											onClick={share}
											title='Поделиться'
											aria-label='Поделиться'
											className='grid h-10 w-11 shrink-0 place-items-center border-l border-white/20 bg-primary text-white hover:bg-primary-hover'
										>
											<Share2 size={15} />
										</button>
									</div>
									<button
										type='button'
										disabled={busy}
										onClick={revoke}
										className='mt-3 flex items-center gap-1.5 text-xs text-subtle transition-colors hover:text-danger disabled:opacity-50'
									>
										<Unlink size={13} />
										Закрыть доступ по ссылке
									</button>
								</>
							) : (
								<button
									type='button'
									disabled={busy || !selected.size}
									onClick={create}
									className='flex h-10 w-full items-center justify-center gap-2 bg-primary text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50'
								>
									<Link2 size={15} />
									Создать ссылку
								</button>
							)}
						</div>
					</>
				)}
			</section>
		</div>,
		document.body
	)
}
