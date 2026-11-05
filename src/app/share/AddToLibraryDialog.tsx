'use client'

import { FolderPlus, Loader2, LogIn, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { useBackClose } from '@/hooks/useBackClose'

import {
	AFTER_LOGIN_KEY,
	type IBundle,
	libraryShareService
} from '@/services/library-share.service'
import {
	type ILibrarySection,
	type ILibraryTopic,
	libraryService
} from '@/services/library.service'

const NEW = '__new'

const fieldClass =
	'h-11 w-full border border-border bg-bg px-3 text-sm text-fg outline-none transition-colors focus:border-primary/60'

/**
 * «Добавить к себе»: выбрать раздел и подраздел и скопировать лист (или всю ссылку) в свой архив.
 * Копия не связана с оригиналом: дальше каждый правит свою.
 */
export function AddToLibraryDialog({
	page,
	bundle,
	onClose
}: {
	/** Открытый лист */
	page?: { title: string; content: string }
	/** Раздел или подразделы по ссылке — их можно забрать целиком */
	bundle?: { token: string; data: IBundle }
	onClose: () => void
}) {
	useBackClose(true, onClose)
	const [signedIn, setSignedIn] = useState<boolean | null>(null)
	const [sections, setSections] = useState<ILibrarySection[]>([])
	const [topics, setTopics] = useState<ILibraryTopic[]>([])
	// Что забираем: открытый лист или всё по ссылке
	const [whole, setWhole] = useState(!page)
	const [sectionId, setSectionId] = useState(NEW)
	const [topicId, setTopicId] = useState(NEW)
	const [newSection, setNewSection] = useState(
		bundle?.data.kind === 'section' ? bundle.data.section_title : ''
	)
	const [newTopic, setNewTopic] = useState('')
	const [progress, setProgress] = useState<string | null>(null)

	useEffect(() => {
		libraryShareService.isSignedIn().then(async ok => {
			setSignedIn(ok)
			if (!ok) return
			try {
				const tree = await libraryService.getTree()
				setSections(tree.sections)
				setTopics(tree.topics)
				if (tree.sections.length && bundle?.data.kind !== 'section')
					setSectionId(tree.sections[0].id)
			} catch {
				toast.error('Не получилось загрузить ваш архив')
			}
		})
	}, [bundle?.data.kind])

	const sectionTopics = topics.filter(topic => topic.section_id === sectionId)

	// Сменили раздел — первая его тема, а если их нет, сразу новая
	useEffect(() => {
		setTopicId(sectionTopics[0]?.id ?? NEW)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sectionId, topics])

	const goToLogin = () => {
		try {
			localStorage.setItem(
				AFTER_LOGIN_KEY,
				JSON.stringify({ href: window.location.href, at: Date.now() })
			)
		} catch {}
		window.location.href = '/auth'
	}

	const canSubmit =
		(sectionId !== NEW || newSection.trim()) &&
		(whole || topicId !== NEW || newTopic.trim())

	const submit = async () => {
		setProgress('Добавляю…')
		try {
			const section = await libraryShareService.ensureSection(
				sectionId === NEW ? { newTitle: newSection.trim() } : { id: sectionId }
			)
			let href = '/i/library'
			if (whole && bundle) {
				const first = await libraryShareService.copyBundle(
					bundle.token,
					bundle.data,
					section,
					(done, total) => setProgress(`Листов: ${done} из ${total}`)
				)
				href = first?.page
					? `/i/library?topic=${first.topic}&page=${first.page}`
					: `/i/library?section=${section}`
			} else if (page) {
				const topic = await libraryShareService.ensureTopic(
					section,
					topicId === NEW ? { newTitle: newTopic.trim() } : { id: topicId }
				)
				const pages = await libraryService.getPages(topic)
				const id = await libraryShareService.copyPages(topic, [page], pages.length)
				href = `/i/library?topic=${topic}&page=${id}`
			}
			toast.success('Добавлено в ваш архив', {
				action: { label: 'Открыть', onClick: () => (window.location.href = href) },
				duration: 8000
			})
			onClose()
		} catch {
			toast.error('Не получилось добавить. Попробуйте ещё раз')
			setProgress(null)
		}
	}

	if (typeof document === 'undefined') return null
	return createPortal(
		<div
			className='fixed inset-0 z-[120] flex animate-fade-in items-end justify-center bg-black/60 sm:items-center sm:p-4'
			onMouseDown={event =>
				event.target === event.currentTarget && !progress && onClose()
			}
		>
			<section className='w-full max-w-md animate-pop-in border border-border bg-elevated p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-pop sm:pb-5'>
				<div className='flex items-start justify-between gap-3'>
					<div>
						<h2 className='text-base font-semibold text-fg'>Добавить к себе</h2>
						<p className='mt-1 text-sm leading-5 text-muted'>
							Копия появится в вашем архиве. Её можно править, оригинал не
							изменится.
						</p>
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

				{signedIn === null ? (
					<div className='mt-4 h-11 animate-pulse bg-white/[0.04]' />
				) : !signedIn ? (
					<button
						type='button'
						onClick={goToLogin}
						className='mt-4 flex h-11 w-full items-center justify-center gap-2 bg-primary text-sm font-medium text-white hover:bg-primary-hover'
					>
						<LogIn size={15} />
						Войти и добавить
					</button>
				) : (
					<div className='mt-4 space-y-3'>
						{page && bundle && (
							<div className='grid grid-cols-2 border border-border p-1'>
								{[
									{ value: false, label: 'Этот лист' },
									{
										value: true,
										label:
											bundle.data.kind === 'section'
												? 'Весь раздел'
												: 'Все подразделы'
									}
								].map(option => (
									<button
										key={option.label}
										type='button'
										aria-pressed={whole === option.value}
										onClick={() => setWhole(option.value)}
										className={
											whole === option.value
												? 'h-9 bg-white/[0.08] text-sm font-medium text-fg'
												: 'h-9 text-sm text-muted hover:text-fg'
										}
									>
										{option.label}
									</button>
								))}
							</div>
						)}

						<label className='block'>
							<span className='eyebrow mb-1.5 block'>Раздел</span>
							<select
								value={sectionId}
								onChange={event => setSectionId(event.target.value)}
								className={fieldClass}
							>
								{sections.map(section => (
									<option
										key={section.id}
										value={section.id}
									>
										{section.title}
									</option>
								))}
								<option value={NEW}>+ Новый раздел</option>
							</select>
						</label>
						{sectionId === NEW && (
							<input
								value={newSection}
								onChange={event => setNewSection(event.target.value)}
								placeholder='Название раздела'
								maxLength={200}
								className={fieldClass}
							/>
						)}

						{!whole && (
							<>
								<label className='block'>
									<span className='eyebrow mb-1.5 block'>Подраздел</span>
									<select
										value={topicId}
										onChange={event => setTopicId(event.target.value)}
										className={fieldClass}
									>
										{sectionTopics.map(topic => (
											<option
												key={topic.id}
												value={topic.id}
											>
												{topic.title}
											</option>
										))}
										<option value={NEW}>+ Новый подраздел</option>
									</select>
								</label>
								{topicId === NEW && (
									<input
										value={newTopic}
										onChange={event => setNewTopic(event.target.value)}
										placeholder='Название подраздела'
										maxLength={200}
										className={fieldClass}
									/>
								)}
							</>
						)}

						<button
							type='button'
							disabled={!canSubmit || Boolean(progress)}
							onClick={submit}
							className='flex h-11 w-full items-center justify-center gap-2 bg-primary text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50'
						>
							{progress ? (
								<>
									<Loader2
										size={15}
										className='animate-spin'
									/>
									{progress}
								</>
							) : (
								<>
									<FolderPlus size={15} />
									Добавить
								</>
							)}
						</button>
					</div>
				)}
			</section>
		</div>,
		document.body
	)
}
