'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import {
	NodeViewWrapper,
	type NodeViewProps,
	ReactNodeViewRenderer
} from '@tiptap/react'
import cn from 'clsx'
import { Download, FileText, Loader2, Pause, Play, ScrollText, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { getPreferences } from '@/lib/preferences'
import { type ITranscribeProgress, transcribeAudio } from '@/lib/transcribe'

const escapeAttr = (value: string) =>
	String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')

export const formatBytes = (bytes: number) => {
	if (!bytes) return ''
	if (bytes < 1024) return `${bytes} Б`
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`
	return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} МБ`
}

const formatTime = (seconds: number) => {
	if (!Number.isFinite(seconds)) return '0:00'
	const m = Math.floor(seconds / 60)
	const s = Math.floor(seconds % 60)
	return `${m}:${String(s).padStart(2, '0')}`
}

/* Общая часть: блок со src/name/size/mime, хранится в Markdown как <div data-…> */
function attachmentNode(name: string, dataAttr: string) {
	return Node.create({
		name,
		group: 'block',
		atom: true,
		draggable: true,
		selectable: true,

		addAttributes() {
			return {
				src: { default: null, parseHTML: el => el.getAttribute('data-src') },
				name: { default: '', parseHTML: el => el.getAttribute('data-name') || '' },
				size: {
					default: 0,
					parseHTML: el => Number(el.getAttribute('data-size')) || 0
				},
				mime: { default: '', parseHTML: el => el.getAttribute('data-mime') || '' }
			}
		},

		parseHTML() {
			const kind = dataAttr === 'data-planner-audio' ? 'audio' : 'file'
			return [
				{ tag: `div[${dataAttr}]` },
				{
					// отметка «ещё загружается»
					tag: `div[data-planner-pending][data-kind="${kind}"]`,
					getAttrs: element => {
						const el = element as HTMLElement
						return {
							src: el.getAttribute('data-planner-pending'),
							name: el.getAttribute('data-name') || '',
							size: Number(el.getAttribute('data-size')) || 0,
							mime: el.getAttribute('data-mime') || ''
						}
					}
				}
			]
		},

		renderHTML({ HTMLAttributes }) {
			return [
				'div',
				mergeAttributes({
					[dataAttr]: '',
					'data-src': HTMLAttributes.src,
					'data-name': HTMLAttributes.name,
					'data-size': HTMLAttributes.size,
					'data-mime': HTMLAttributes.mime
				})
			]
		},

		addStorage() {
			return {
				markdown: {
					serialize(state: any, node: any) {
						const { src, name, size, mime } = node.attrs
						// пока файл грузится (blob:), в текст не пишем
						if (!src) return
						if (String(src).startsWith('blob:')) {
							const kind = dataAttr === 'data-planner-audio' ? 'audio' : 'file'
							state.write(
								`<div data-planner-pending="${escapeAttr(src)}" data-kind="${kind}" data-name="${escapeAttr(name)}" data-size="${size || 0}" data-mime="${escapeAttr(mime)}"></div>`
							)
							state.closeBlock(node)
							return
						}
						state.write(
							`<div ${dataAttr} data-src="${escapeAttr(src)}" data-name="${escapeAttr(name)}" data-size="${size || 0}" data-mime="${escapeAttr(mime)}"></div>`
						)
						state.closeBlock(node)
					},
					parse: {}
				}
			}
		}
	})
}

export const FileAttachment = attachmentNode('fileAttachment', 'data-planner-file').extend({
	addNodeView() {
		return ReactNodeViewRenderer(FileView)
	}
})

export const AudioAttachment = attachmentNode('audioAttachment', 'data-planner-audio').extend({
	addNodeView() {
		return ReactNodeViewRenderer(AudioView)
	}
})

function RemoveButton({ props }: { props: NodeViewProps }) {
	if (!props.editor.isEditable) return null
	return (
		<button
			type='button'
			aria-label='Убрать из заметки'
			onClick={() => props.deleteNode()}
			className='grid h-8 w-8 shrink-0 place-items-center text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100 [@media(hover:none)]:opacity-100'
		>
			<X size={14} />
		</button>
	)
}

function FileView(props: NodeViewProps) {
	const { src, name, size, mime } = props.node.attrs
	const isUploading = String(src || '').startsWith('blob:')
	const extension = (name.split('.').pop() || mime.split('/').pop() || 'файл')
		.slice(0, 4)
		.toUpperCase()

	return (
		<NodeViewWrapper
			className={cn(
				'group my-3 flex items-center gap-3 border border-border bg-white/[0.02] p-2 pr-1 transition-colors',
				props.selected && 'border-primary'
			)}
			data-drag-block
		>
			<span className='grid h-10 w-10 shrink-0 place-items-center bg-white/[0.05] font-mono text-[10px] text-muted'>
				{isUploading ? <FileText size={16} /> : extension}
			</span>
			<span className='min-w-0 flex-1'>
				<span className='block truncate text-sm text-fg'>{name || 'Файл'}</span>
				<span className='block font-mono text-2xs text-subtle'>
					{isUploading ? 'Загружается…' : formatBytes(size)}
				</span>
			</span>
			{!isUploading && (
				<a
					href={src}
					target='_blank'
					rel='noopener noreferrer'
					download={name}
					contentEditable={false}
					className='flex h-8 items-center gap-1.5 px-2.5 text-xs text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
				>
					<Download size={14} />
					Открыть
				</a>
			)}
			<RemoveButton props={props} />
		</NodeViewWrapper>
	)
}

const SPEEDS = [1, 1.5, 2]

function AudioView(props: NodeViewProps) {
	const { src, name } = props.node.attrs
	const audioRef = useRef<HTMLAudioElement>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [current, setCurrent] = useState(0)
	const [duration, setDuration] = useState(0)
	const [speed, setSpeed] = useState(1)
	const isUploading = String(src || '').startsWith('blob:')
	const [transcribing, setTranscribing] = useState<ITranscribeProgress | null>(null)

	useEffect(() => {
		if (audioRef.current) audioRef.current.playbackRate = speed
	}, [speed])

	// Расшифровка локальной нейросетью — текст встаёт выноской сразу под аудио
	const transcribe = async () => {
		if (transcribing) return
		if (getPreferences().sttModel === 'off') {
			toast('Расшифровка выключена', {
				description: 'Выберите модель в настройках — она скачается один раз и будет работать без интернета.',
				action: { label: 'Настройки', onClick: () => (window.location.href = '/i/settings#transcription') }
			})
			return
		}
		setTranscribing({ stage: 'prepare' })
		try {
			const text = await transcribeAudio(src, setTranscribing)
			if (!text) {
				toast('Речь не распознана')
				return
			}
			const position = typeof props.getPos === 'function' ? props.getPos() : undefined
			if (position === undefined) return
			const quoted = text.replace(/\s*\n\s*/g, ' ')
			props.editor
				.chain()
				.insertContentAt(position + props.node.nodeSize, `> [!note] Расшифровка: ${name || 'аудио'}\n> ${quoted}\n\n`)
				.run()
		} catch (error) {
			toast.error('Не получилось расшифровать', {
				description: error instanceof Error ? error.message.slice(0, 160) : undefined
			})
		} finally {
			setTranscribing(null)
		}
	}

	const toggle = () => {
		const audio = audioRef.current
		if (!audio) return
		if (audio.paused) audio.play().catch(() => {})
		else audio.pause()
	}

	const seek = (clientX: number, element: HTMLElement) => {
		const audio = audioRef.current
		if (!audio || !duration) return
		const rect = element.getBoundingClientRect()
		audio.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * duration
	}

	const progress = duration ? (current / duration) * 100 : 0

	return (
		<NodeViewWrapper
			className={cn(
				'group my-3 flex flex-wrap items-center gap-x-3 border border-border bg-white/[0.02] p-2 pr-1',
				props.selected && 'border-primary'
			)}
			data-drag-block
		>
			<audio
				ref={audioRef}
				src={src}
				preload='metadata'
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
				onEnded={() => setIsPlaying(false)}
				onTimeUpdate={event => setCurrent(event.currentTarget.currentTime)}
				onLoadedMetadata={event => {
					const value = event.currentTarget.duration
					// у записей из MediaRecorder длительность часто Infinity до первой перемотки
					if (Number.isFinite(value)) setDuration(value)
					else {
						event.currentTarget.currentTime = 1e9
						event.currentTarget.ontimeupdate = function () {
							const audio = this as HTMLAudioElement
							audio.ontimeupdate = null
							setDuration(audio.duration)
							audio.currentTime = 0
						}
					}
				}}
			/>
			<button
				type='button'
				onClick={toggle}
				disabled={isUploading}
				aria-label={isPlaying ? 'Пауза' : 'Слушать'}
				contentEditable={false}
				className='grid h-10 w-10 shrink-0 place-items-center bg-primary text-white transition-colors hover:bg-primary-hover disabled:opacity-40'
			>
				{isPlaying ? (
					<Pause size={16} />
				) : (
					<Play
						size={16}
						fill='currentColor'
					/>
				)}
			</button>
			<div
				className='min-w-0 flex-1'
				contentEditable={false}
			>
				<div className='flex items-baseline justify-between gap-3'>
					<span className='truncate text-sm text-fg'>
						{name || 'Голосовое'}
					</span>
					<span className='shrink-0 font-mono text-2xs tabular-nums text-subtle'>
						{isUploading
							? 'Загружается…'
							: `${formatTime(current)} / ${formatTime(duration)}`}
					</span>
				</div>
				<div
					role='slider'
					aria-label='Перемотка'
					aria-valuemin={0}
					aria-valuemax={Math.round(duration)}
					aria-valuenow={Math.round(current)}
					onPointerDown={event => seek(event.clientX, event.currentTarget)}
					className='mt-2 h-4 cursor-pointer py-1.5'
				>
					<div className='h-1 bg-white/10'>
						<div
							className='h-full bg-primary'
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			</div>
			<button
				type='button'
				contentEditable={false}
				onClick={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
				aria-label='Скорость воспроизведения'
				className='h-8 w-10 shrink-0 font-mono text-xs text-muted transition-colors hover:bg-white/[0.06] hover:text-fg'
			>
				{speed}×
			</button>
			{!isUploading && (
				<button
					type='button'
					contentEditable={false}
					onClick={transcribe}
					disabled={Boolean(transcribing)}
					title='Расшифровать в текст'
					aria-label='Расшифровать в текст'
					className='grid h-8 w-8 shrink-0 place-items-center text-muted transition-colors hover:bg-white/[0.06] hover:text-fg disabled:text-primary'
				>
					{transcribing ? (
						<Loader2
							size={15}
							className='animate-spin'
						/>
					) : (
						<ScrollText size={15} />
					)}
				</button>
			)}
			<RemoveButton props={props} />
			{transcribing && (
				<div
					contentEditable={false}
					className='mt-2 flex basis-full items-center gap-3 border-t border-border pt-2 text-xs text-muted'
				>
					<span className='shrink-0'>
						{transcribing.stage === 'download'
							? 'Скачиваю модель (один раз)…'
							: transcribing.stage === 'prepare'
								? 'Готовлю звук…'
								: 'Распознаю речь…'}
					</span>
					<span className='relative h-1 flex-1 overflow-hidden bg-white/10'>
						{transcribing.stage === 'download' ? (
							<span
								className='absolute inset-y-0 left-0 bg-primary transition-[width]'
								style={{ width: `${Math.round((transcribing.progress ?? 0) * 100)}%` }}
							/>
						) : (
							<span className='absolute inset-y-0 w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] bg-primary' />
						)}
					</span>
					{transcribing.stage === 'download' && (
						<span className='shrink-0 font-mono tabular-nums'>{Math.round((transcribing.progress ?? 0) * 100)}%</span>
					)}
				</div>
			)}
		</NodeViewWrapper>
	)
}
