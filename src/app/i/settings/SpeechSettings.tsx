'use client'

import cn from 'clsx'
import {
	AudioLines,
	Check,
	Cpu,
	Download,
	Loader2,
	Sparkles,
	Square,
	Trash2
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import {
	NEURAL_VOICES,
	isNeuralCached,
	preloadNeural,
	removeNeural
} from '@/lib/neural-tts'
import { type TypeSttModel, usePreferences } from '@/lib/preferences'
import {
	getVoices,
	isNativeSpeech,
	onVoicesChanged,
	sortVoices,
	speak,
	stopSpeech,
	useSpeech
} from '@/lib/speech'
import { STT_MODELS, isModelCached, preloadModel } from '@/lib/transcribe'

const SAMPLE =
	'Привет! Так будут звучать твои конспекты. Формулы я пропускаю, а текст читаю по предложениям.'

/** Озвучка: движок (нейросеть на устройстве или системный голос), голос, скорость */
export function SpeechSettings() {
	const [preferences, setPreferences] = usePreferences()
	const speech = useSpeech()
	const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([])
	const [showAll, setShowAll] = useState(false)
	const [native, setNative] = useState(false)
	const [cached, setCached] = useState<boolean | null>(null)
	const [download, setDownload] = useState<number | null>(null)
	const neural = preferences.ttsEngine === 'neural'
	const testing = speech.status !== 'idle' && speech.title === 'Проверка голоса'

	useEffect(() => {
		setNative(isNativeSpeech())
		isNeuralCached().then(setCached)
		const update = () => setSystemVoices(sortVoices(getVoices()))
		update()
		return onVoicesChanged(update)
	}, [])

	const startDownload = async () => {
		if (download !== null) return
		setDownload(0)
		try {
			await preloadNeural(setDownload)
			setCached(true)
			setPreferences({ ttsEngine: 'neural' })
			toast.success('Нейроголос готов', {
				description:
					'Теперь озвучка работает на устройстве, даже без интернета.'
			})
		} catch (error) {
			toast.error('Не удалось скачать модель', {
				description:
					error instanceof Error ? error.message.slice(0, 160) : undefined
			})
		} finally {
			setDownload(null)
		}
	}

	const chooseEngine = (engine: 'neural' | 'system') => {
		stopSpeech()
		if (engine === 'neural' && !cached) return void startDownload()
		setPreferences({ ttsEngine: engine })
	}

	const russian = systemVoices.filter(voice =>
		voice.lang.toLowerCase().startsWith('ru')
	)
	const systemList = showAll || !russian.length ? systemVoices : russian
	const systemSelected =
		systemVoices.find(voice => voice.voiceURI === preferences.ttsVoice) ??
		systemVoices[0]

	return (
		<div className='space-y-5'>
			{/* Движок */}
			<div className='grid gap-px border border-border bg-border sm:grid-cols-2'>
				<EngineCard
					active={neural}
					icon={<Sparkles size={15} />}
					title='Нейросеть на устройстве'
					hint={
						download !== null
							? `Скачиваю… ${Math.round(download * 100)}%`
							: cached
								? 'Supertonic 3 · скачана, работает без интернета'
								: 'Supertonic 3 · ≈ 400 МБ один раз'
					}
					progress={download}
					onClick={() => chooseEngine('neural')}
				/>
				<EngineCard
					active={!neural}
					icon={<AudioLines size={15} />}
					title='Системный голос'
					hint={native ? 'Голос Android' : 'Голос браузера или Windows'}
					onClick={() => chooseEngine('system')}
				/>
			</div>

			{neural ? (
				<div>
					<p className='eyebrow mb-2'>Голос</p>
					<div className='grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-5'>
						{NEURAL_VOICES.map(voice => {
							const active = preferences.ttsNeuralVoice === voice.id
							return (
								<button
									key={voice.id}
									type='button'
									onClick={() => {
										setPreferences({ ttsNeuralVoice: voice.id })
										speak(SAMPLE, 'Проверка голоса')
									}}
									className={cn(
										'flex items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
										active
											? 'bg-primary/10 text-fg'
											: 'bg-surface text-muted hover:bg-white/[0.04] hover:text-fg'
									)}
								>
									<span
										className={cn(
											'grid h-6 w-6 shrink-0 place-items-center rounded-full text-2xs',
											active
												? 'bg-primary text-white'
												: 'bg-white/[0.05] text-subtle'
										)}
									>
										{active ? <Check size={12} /> : voice.id}
									</span>
									{voice.name}
								</button>
							)
						})}
					</div>

					<p className='eyebrow mb-2 mt-5'>Качество</p>
					<div className='grid grid-cols-3 gap-px border border-border bg-border'>
						{QUALITY.map(option => (
							<button
								key={option.steps}
								type='button'
								onClick={() => setPreferences({ ttsSteps: option.steps })}
								className={cn(
									'px-3 py-2.5 text-left transition-colors',
									preferences.ttsSteps === option.steps
										? 'bg-primary/10'
										: 'bg-surface hover:bg-white/[0.04]'
								)}
							>
								<span className='block text-sm text-fg'>{option.label}</span>
								<span className='block text-2xs text-subtle'>
									{option.hint}
								</span>
							</button>
						))}
					</div>

					<div className='mt-3 flex items-start justify-between gap-3 text-xs leading-5 text-subtle'>
						<p className='flex gap-2'>
							<Cpu
								size={14}
								className='mt-0.5 shrink-0'
							/>
							Модель Supertonic 3 работает прямо на этом устройстве: 31 язык,
							русский и английский переключаются сами. Следующая фраза
							готовится, пока звучит текущая.
						</p>
						{cached && (
							<button
								type='button'
								onClick={async () => {
									stopSpeech()
									await removeNeural()
									setCached(false)
									setPreferences({ ttsEngine: 'system' })
									toast('Модель удалена с устройства')
								}}
								className='flex shrink-0 items-center gap-1 text-subtle transition-colors hover:text-danger'
							>
								<Trash2 size={12} />
								Удалить
							</button>
						)}
					</div>
				</div>
			) : native ? (
				<p className='border border-border px-4 py-3 text-sm leading-6 text-muted'>
					Читает голос Android. Сменить или скачать голос получше: Настройки
					Android → «Синтез речи».
				</p>
			) : (
				<div>
					<div className='mb-2 flex items-center justify-between gap-3'>
						<p className='eyebrow'>Голос системы</p>
						{russian.length > 0 && russian.length < systemVoices.length && (
							<button
								type='button'
								onClick={() => setShowAll(value => !value)}
								className='text-xs text-subtle transition-colors hover:text-fg'
							>
								{showAll
									? 'Только русские'
									: `Все языки (${systemVoices.length})`}
							</button>
						)}
					</div>
					{systemList.length ? (
						<div className='grid max-h-72 gap-px overflow-y-auto border border-border bg-border sm:grid-cols-2'>
							{systemList.map(voice => {
								const active = systemSelected?.voiceURI === voice.voiceURI
								return (
									<button
										key={voice.voiceURI}
										type='button'
										onClick={() => {
											setPreferences({ ttsVoice: voice.voiceURI })
											speak(SAMPLE, 'Проверка голоса')
										}}
										className={cn(
											'flex min-w-0 items-center gap-3 px-3 py-2.5 text-left transition-colors',
											active
												? 'bg-primary/10'
												: 'bg-surface hover:bg-white/[0.04]'
										)}
									>
										<span
											className={cn(
												'grid h-7 w-7 shrink-0 place-items-center rounded-full',
												active
													? 'bg-primary text-white'
													: 'bg-white/[0.05] text-subtle'
											)}
										>
											{active ? <Check size={14} /> : <AudioLines size={13} />}
										</span>
										<span className='min-w-0 flex-1'>
											<span className='block truncate text-sm text-fg'>
												{voice.name.replace(/^Microsoft |^Google /, '')}
											</span>
											<span className='block truncate text-2xs text-subtle'>
												{voice.lang}
											</span>
										</span>
									</button>
								)
							})}
						</div>
					) : (
						<p className='flex items-center gap-2 text-sm text-subtle'>
							<Loader2
								size={14}
								className='animate-spin'
							/>
							Загружаю голоса системы…
						</p>
					)}
				</div>
			)}

			<Slider
				label='Скорость'
				value={preferences.ttsRate}
				min={0.5}
				max={2}
				step={0.05}
				format={value => `${Number(value.toFixed(2))}×`}
				onChange={value => setPreferences({ ttsRate: value })}
			/>
			{!neural && (
				<Slider
					label='Высота голоса'
					value={preferences.ttsPitch}
					min={0.5}
					max={1.5}
					step={0.05}
					format={value => String(Number(value.toFixed(2)))}
					onChange={value => setPreferences({ ttsPitch: value })}
				/>
			)}

			<button
				type='button'
				disabled={neural && !cached}
				onClick={() =>
					testing ? stopSpeech() : speak(SAMPLE, 'Проверка голоса')
				}
				className='flex h-10 items-center gap-2 border border-border px-4 text-sm text-fg transition-colors hover:bg-white/[0.05] disabled:opacity-40'
			>
				{testing ? (
					<Square
						size={13}
						fill='currentColor'
					/>
				) : (
					<AudioLines
						size={15}
						className='text-primary'
					/>
				)}
				{testing ? 'Остановить' : 'Послушать'}
			</button>
			<label className='flex cursor-pointer items-start gap-3 border border-border px-4 py-3'>
				<input
					type='checkbox'
					checked={preferences.breathingVoice}
					onChange={event =>
						setPreferences({ breathingVoice: event.target.checked })
					}
					className='mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--primary))]'
				/>
				<span className='min-w-0'>
					<span className='block text-sm text-fg'>
						Голосовые подсказки в дыхании
					</span>
					<span className='block text-xs leading-5 text-subtle'>
						В программах (Вим Хоф, туммо и др.) голос говорит «Раунд 2», «Выдох
						и задержка», «Ещё десять секунд». По умолчанию выключено.
					</span>
				</span>
			</label>
			<p className='text-xs leading-5 text-subtle'>
				Читать: «⋯» на листе → «Озвучить лист», или выделите текст — появится
				кнопка «Озвучить».
			</p>
		</div>
	)
}

const QUALITY = [
	{ steps: 0, label: 'Авто', hint: 'по силам устройства' },
	{ steps: 4, label: 'Быстрее', hint: 'для слабого телефона' },
	{ steps: 12, label: 'Лучше', hint: 'для компьютера' }
]

function EngineCard({
	active,
	icon,
	title,
	hint,
	progress,
	onClick
}: {
	active: boolean
	icon: React.ReactNode
	title: string
	hint: string
	progress?: number | null
	onClick: () => void
}) {
	return (
		<button
			type='button'
			onClick={onClick}
			className={cn(
				'relative flex items-start gap-3 overflow-hidden px-4 py-3 text-left transition-colors',
				active ? 'bg-primary/10' : 'bg-surface hover:bg-white/[0.04]'
			)}
		>
			<span
				className={cn(
					'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
					active ? 'bg-primary text-white' : 'bg-white/[0.05] text-subtle'
				)}
			>
				{progress !== undefined && progress !== null ? (
					<Loader2
						size={14}
						className='animate-spin'
					/>
				) : (
					icon
				)}
			</span>
			<span className='min-w-0'>
				<span className='block text-sm font-medium text-fg'>{title}</span>
				<span className='block text-xs text-subtle'>{hint}</span>
			</span>
			{progress !== undefined && progress !== null && (
				<span
					className='absolute bottom-0 left-0 h-0.5 bg-primary transition-[width]'
					style={{ width: `${progress * 100}%` }}
				/>
			)}
		</button>
	)
}

function Slider({
	label,
	value,
	min,
	max,
	step,
	format,
	onChange
}: {
	label: string
	value: number
	min: number
	max: number
	step: number
	format: (value: number) => string
	onChange: (value: number) => void
}) {
	return (
		<label className='block'>
			<span className='mb-2 flex items-center justify-between'>
				<span className='eyebrow'>{label}</span>
				<span className='font-mono text-xs tabular-nums text-muted'>
					{format(value)}
				</span>
			</span>
			<input
				type='range'
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={event => onChange(Number(event.target.value))}
				className='w-full accent-[rgb(var(--primary))]'
			/>
		</label>
	)
}

/** Расшифровка аудио: выбор модели Whisper и её загрузка */
export function TranscriptionSettings() {
	const [preferences, setPreferences] = usePreferences()
	const [cached, setCached] = useState<Record<string, boolean>>({})
	const [downloading, setDownloading] = useState<{
		model: string
		progress: number
	} | null>(null)

	useEffect(() => {
		Promise.all(
			STT_MODELS.map(
				async model => [model.value, await isModelCached(model.value)] as const
			)
		).then(entries => setCached(Object.fromEntries(entries)))
	}, [downloading])

	const download = async (model: Exclude<TypeSttModel, 'off'>) => {
		setPreferences({ sttModel: model })
		if (cached[model]) return
		setDownloading({ model, progress: 0 })
		try {
			const device = await preloadModel(model, progress =>
				setDownloading({ model, progress })
			)
			toast.success('Модель готова', {
				description:
					device === 'ready' ? 'Расшифровка работает без интернета.' : undefined
			})
		} catch (error) {
			toast.error('Не удалось скачать модель', {
				description:
					error instanceof Error ? error.message.slice(0, 160) : undefined
			})
		} finally {
			setDownloading(null)
		}
	}

	return (
		<div
			id='transcription'
			className='space-y-3'
		>
			<div className='grid gap-px border border-border bg-border'>
				<button
					type='button'
					onClick={() => setPreferences({ sttModel: 'off' })}
					className={cn(
						'flex items-center gap-3 px-3 py-3 text-left transition-colors',
						preferences.sttModel === 'off'
							? 'bg-primary/10'
							: 'bg-surface hover:bg-white/[0.04]'
					)}
				>
					<Radio on={preferences.sttModel === 'off'} />
					<span className='text-sm text-fg'>Выключена</span>
				</button>
				{STT_MODELS.map(model => {
					const active = preferences.sttModel === model.value
					const loading = downloading?.model === model.value
					return (
						<button
							key={model.value}
							type='button'
							disabled={Boolean(downloading)}
							onClick={() => download(model.value)}
							className={cn(
								'relative flex items-center gap-3 overflow-hidden px-3 py-3 text-left transition-colors disabled:cursor-wait',
								active ? 'bg-primary/10' : 'bg-surface hover:bg-white/[0.04]'
							)}
						>
							<Radio on={active} />
							<span className='min-w-0 flex-1'>
								<span className='flex items-center gap-2 text-sm text-fg'>
									{model.label}
									<span className='font-mono text-2xs text-subtle'>
										Whisper {model.value}
									</span>
								</span>
								<span className='block text-xs text-subtle'>{model.hint}</span>
							</span>
							<span className='flex shrink-0 items-center gap-1.5 text-xs text-muted'>
								{loading ? (
									<>
										<Loader2
											size={13}
											className='animate-spin'
										/>
										{Math.round(downloading.progress * 100)}%
									</>
								) : cached[model.value] ? (
									<>
										<Check
											size={13}
											className='text-success'
										/>
										Скачана
									</>
								) : (
									<>
										<Download size={13} />
										{model.size}
									</>
								)}
							</span>
							{loading && (
								<span
									className='absolute bottom-0 left-0 h-0.5 bg-primary transition-[width]'
									style={{ width: `${downloading.progress * 100}%` }}
								/>
							)}
						</button>
					)
				})}
			</div>
			<p className='flex gap-2 text-xs leading-5 text-subtle'>
				<Cpu
					size={14}
					className='mt-0.5 shrink-0'
				/>
				Нейросеть Whisper работает прямо на этом устройстве: модель скачивается
				один раз, звук никуда не отправляется. На компьютере с видеокартой — в
				разы быстрее. Расшифровать: кнопка со свитком у голосового или аудио.
			</p>
		</div>
	)
}

function Radio({ on }: { on: boolean }) {
	return (
		<span
			className={cn(
				'grid h-4 w-4 shrink-0 place-items-center rounded-full border',
				on ? 'border-primary' : 'border-white/25'
			)}
		>
			{on && <span className='h-2 w-2 rounded-full bg-primary' />}
		</span>
	)
}
