'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeSelection } from '@tiptap/pm/state'
import {
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer
} from '@tiptap/react'
import cn from 'clsx'
import {
	ArrowRight,
	Download,
	FileText,
	Loader2,
	Pause,
	Play,
	RotateCcw,
	X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

import { Waveform, useWaveform } from './voice'
import { getPreferences } from '@/lib/preferences'
import {
	type ITranscribeProgress,
	isModelCached,
	transcribeAudio
} from '@/lib/transcribe'

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
				name: {
					default: '',
					parseHTML: el => el.getAttribute('data-name') || ''
				},
				size: {
					default: 0,
					parseHTML: el => Number(el.getAttribute('data-size')) || 0
				},
				mime: {
					default: '',
					parseHTML: el => el.getAttribute('data-mime') || ''
				},
				// Расшифровка голосового — хранится вместе с ним, показывается по кнопке «→A»
				transcript: {
					default: '',
					parseHTML: el => el.getAttribute('data-transcript') || ''
				}
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
					'data-mime': HTMLAttributes.mime,
					...(HTMLAttributes.transcript && {
						'data-transcript': HTMLAttributes.transcript
					})
				})
			]
		},

		// Backspace/Delete по выделенному вложению — сначала спросить
		addKeyboardShortcuts() {
			const guard = () => {
				const { selection } = this.editor.state
				if (
					!(selection instanceof NodeSelection) ||
					selection.node.type.name !== name
				)
					return false
				window.dispatchEvent(
					new CustomEvent('planner:confirm-remove', {
						detail: { pos: selection.from }
					})
				)
				return true
			}
			return { Backspace: guard, Delete: guard }
		},

		addStorage() {
			return {
				markdown: {
					serialize(state: any, node: any) {
						const { src, name, size, mime, transcript } = node.attrs
						const extra = transcript
							? ` data-transcript="${escapeAttr(String(transcript).replace(/\s*\n\s*/g, ' '))}"`
							: ''
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
							`<div ${dataAttr} data-src="${escapeAttr(src)}" data-name="${escapeAttr(name)}" data-size="${size || 0}" data-mime="${escapeAttr(mime)}"${extra}></div>`
						)
						state.closeBlock(node)
					},
					parse: {}
				}
			}
		}
	})
}

export const FileAttachment = attachmentNode(
	'fileAttachment',
	'data-planner-file'
).extend({
	addNodeView() {
		return ReactNodeViewRenderer(FileView)
	}
})

export const AudioAttachment = attachmentNode(
	'audioAttachment',
	'data-planner-audio'
).extend({
	addNodeView() {
		return ReactNodeViewRenderer(AudioView)
	}
})

/** Убрать вложение — только после подтверждения (и по крестику, и по Backspace/Delete) */
function RemoveButton({ props }: { props: NodeViewProps }) {
	const [asking, setAsking] = useState(false)
	const isAudio = props.node.type.name === 'audioAttachment'

	useEffect(() => {
		const onRequest = (event: Event) => {
			const position =
				typeof props.getPos === 'function' ? props.getPos() : undefined
			if ((event as CustomEvent).detail?.pos === position) setAsking(true)
		}
		window.addEventListener('planner:confirm-remove', onRequest)
		return () => window.removeEventListener('planner:confirm-remove', onRequest)
	}, [props])

	if (!props.editor.isEditable) return null
	return (
		<>
			<button
				type='button'
				aria-label='Убрать из заметки'
				onClick={() => setAsking(true)}
				className='grid h-8 w-8 shrink-0 place-items-center rounded-full text-subtle opacity-0 transition hover:text-danger group-hover:opacity-100 [@media(hover:none)]:opacity-100'
			>
				<X size={14} />
			</button>
			<ConfirmDialog
				open={asking}
				title={isAudio ? 'Удалить голосовое?' : 'Удалить файл?'}
				description={`«${props.node.attrs.name || (isAudio ? 'Голосовое' : 'Файл')}» исчезнет из заметки.`}
				onConfirm={() => {
					setAsking(false)
					props.deleteNode()
				}}
				onClose={() => {
					setAsking(false)
					props.editor.commands.focus()
				}}
			/>
		</>
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

// Расшифровки, сделанные в этом браузере, — на случай, если лист открыт только для чтения
const TRANSCRIPT_KEY = 'planner:transcript:'
const readTranscript = (src: string) => {
	try {
		return localStorage.getItem(TRANSCRIPT_KEY + src) || ''
	} catch {
		return ''
	}
}

/** Голосовое как в Telegram: круглая кнопка, волна, время и размер, «→A» — расшифровка */
function AudioView(props: NodeViewProps) {
	const { src, name, size, transcript: savedTranscript } = props.node.attrs
	const audioRef = useRef<HTMLAudioElement>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [current, setCurrent] = useState(0)
	const [duration, setDuration] = useState(0)
	const [speed, setSpeed] = useState(1)
	const isUploading = String(src || '').startsWith('blob:')
	const peaks = useWaveform(src)
	const [transcribing, setTranscribing] = useState<ITranscribeProgress | null>(
		null
	)
	const [modelCached, setModelCached] = useState(false)
	// Текст скрыт, пока не нажмёшь «→A»; открыл заметку заново — снова скрыт
	const [showText, setShowText] = useState(false)
	const [localTranscript, setLocalTranscript] = useState('')
	const transcript: string = savedTranscript || localTranscript

	useEffect(() => {
		if (!savedTranscript && src) setLocalTranscript(readTranscript(src))
	}, [savedTranscript, src])

	useEffect(() => {
		if (audioRef.current) audioRef.current.playbackRate = speed
	}, [speed])

	const recognize = async () => {
		if (transcribing) return
		const model = getPreferences().sttModel
		if (model === 'off') {
			toast('Расшифровка выключена', {
				description:
					'Выберите модель в настройках — она скачается один раз и будет работать без интернета.',
				action: {
					label: 'Настройки',
					onClick: () => (window.location.href = '/i/settings#transcription')
				}
			})
			return
		}
		setShowText(true)
		setModelCached(await isModelCached(model))
		setTranscribing({ stage: 'prepare' })
		try {
			const text = (await transcribeAudio(src, setTranscribing))
				.replace(/\s*\n\s*/g, ' ')
				.trim()
			if (!text) {
				toast('Речь не распознана')
				return
			}
			setLocalTranscript(text)
			try {
				localStorage.setItem(TRANSCRIPT_KEY + src, text)
			} catch {}
			// Сохраняем в саму заметку — на другом устройстве распознавать заново не придётся
			if (props.editor.isEditable) props.updateAttributes({ transcript: text })
		} catch (error) {
			toast.error('Не получилось расшифровать', {
				description:
					error instanceof Error ? error.message.slice(0, 160) : undefined
			})
		} finally {
			setTranscribing(null)
		}
	}

	const onTranscriptButton = () => {
		if (transcribing) return
		if (transcript) setShowText(value => !value)
		else void recognize()
	}

	const toggle = () => {
		const audio = audioRef.current
		if (!audio) return
		if (audio.paused) audio.play().catch(() => {})
		else audio.pause()
	}

	const progress = duration ? current / duration : 0
	const started = isPlaying || current > 0

	return (
		<NodeViewWrapper
			className='group my-3'
			data-drag-block
		>
			<div
				contentEditable={false}
				className={cn(
					'flex max-w-md items-center gap-3 rounded-2xl border bg-white/[0.04] py-2 pl-2 pr-1.5 transition-colors',
					props.selected ? 'border-primary' : 'border-transparent'
				)}
			>
				<audio
					ref={audioRef}
					src={src}
					preload='metadata'
					onPlay={() => setIsPlaying(true)}
					onPause={() => setIsPlaying(false)}
					onEnded={() => {
						setIsPlaying(false)
						setCurrent(0)
					}}
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
					title={name || undefined}
					className='grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white transition-transform hover:scale-105 active:scale-95 disabled:opacity-40'
				>
					{isUploading ? (
						<Loader2
							size={18}
							className='animate-spin'
						/>
					) : isPlaying ? (
						<Pause
							size={18}
							fill='currentColor'
						/>
					) : (
						<Play
							size={18}
							fill='currentColor'
							className='translate-x-[1px]'
						/>
					)}
				</button>

				<div className='min-w-0 flex-1'>
					<Waveform
						peaks={peaks}
						progress={progress}
						onSeek={fraction => {
							const audio = audioRef.current
							if (audio && duration) audio.currentTime = fraction * duration
						}}
					/>
					<div className='mt-0.5 flex items-center gap-2 font-mono text-2xs tabular-nums text-subtle'>
						<span>
							{isUploading
								? 'Загружается…'
								: formatTime(started ? current : duration)}
						</span>
						{!isUploading && size > 0 && <span>{formatBytes(size)}</span>}
						{(isPlaying || speed !== 1) && (
							<button
								type='button'
								onClick={() =>
									setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])
								}
								aria-label='Скорость воспроизведения'
								className='rounded-full bg-white/[0.08] px-1.5 text-fg transition-colors hover:bg-white/[0.14]'
							>
								{speed}×
							</button>
						)}
					</div>
				</div>

				{!isUploading && (
					<button
						type='button'
						onClick={onTranscriptButton}
						title={
							transcript
								? showText
									? 'Скрыть текст'
									: 'Показать текст'
								: 'Расшифровать в текст'
						}
						aria-label='Расшифровка в текст'
						aria-pressed={showText}
						className={cn(
							'flex h-7 shrink-0 items-center gap-px self-start rounded-lg px-1.5 text-xs font-semibold transition-colors',
							showText
								? 'bg-primary text-white'
								: 'bg-primary/15 text-primary hover:bg-primary/25'
						)}
					>
						{transcribing ? (
							<Loader2
								size={13}
								className='mx-1 animate-spin'
							/>
						) : (
							<>
								<ArrowRight
									size={12}
									strokeWidth={2.5}
								/>
								A
							</>
						)}
					</button>
				)}
				<RemoveButton props={props} />
			</div>

			{showText && (
				<div
					contentEditable={false}
					className='mt-1.5 max-w-md animate-fade-in rounded-2xl bg-white/[0.03] px-4 py-3'
				>
					{transcribing ? (
						<div className='flex items-center gap-3 text-xs text-muted'>
							<span className='shrink-0'>
								{transcribing.stage === 'download'
									? modelCached
										? 'Загружаю модель…'
										: 'Скачиваю модель (один раз)…'
									: transcribing.stage === 'prepare'
										? 'Готовлю звук…'
										: 'Распознаю речь…'}
							</span>
							<span className='relative h-1 flex-1 overflow-hidden rounded-full bg-white/10'>
								{transcribing.stage === 'download' && !modelCached ? (
									<span
										className='absolute inset-y-0 left-0 bg-primary transition-[width]'
										style={{
											width: `${Math.round((transcribing.progress ?? 0) * 100)}%`
										}}
									/>
								) : (
									<span className='absolute inset-y-0 w-1/3 animate-[indeterminate_1.2s_ease-in-out_infinite] bg-primary' />
								)}
							</span>
						</div>
					) : transcript ? (
						<>
							<p className='select-text text-sm leading-6 text-fg/90'>
								{transcript}
							</p>
							<button
								type='button'
								onClick={() => void recognize()}
								className='mt-2 flex items-center gap-1.5 text-2xs text-subtle transition-colors hover:text-fg'
							>
								<RotateCcw size={11} />
								Перераспознать
							</button>
						</>
					) : (
						<p className='text-xs text-subtle'>Текста пока нет</p>
					)}
				</div>
			)}
		</NodeViewWrapper>
	)
}
