import { type TypeSttModel, getPreferences } from './preferences'

/*
 * Расшифровка голосовых и аудио: обёртка над воркером с Whisper.
 * Звук декодируем здесь (в воркере нет AudioContext) в 16 кГц моно — так его ждёт Whisper.
 */

export const STT_MODELS: {
	value: Exclude<TypeSttModel, 'off'>
	label: string
	size: string
	hint: string
}[] = [
	{
		value: 'tiny',
		label: 'Быстрая',
		size: '≈ 45 МБ',
		hint: 'Для телефона, короткие голосовые'
	},
	{
		value: 'base',
		label: 'Сбалансированная',
		size: '≈ 80 МБ',
		hint: 'Хорошее качество, рекомендуем'
	},
	{
		value: 'small',
		label: 'Точная',
		size: '≈ 250 МБ',
		hint: 'Лучше всего для компьютера'
	}
]

export interface ITranscribeProgress {
	stage: 'download' | 'prepare' | 'recognize'
	// 0…1 для загрузки модели
	progress?: number
}

let worker: Worker | null = null
let counter = 0
const pending = new Map<
	number,
	{
		resolve: (value: any) => void
		reject: (error: Error) => void
		onProgress?: (progress: ITranscribeProgress) => void
	}
>()
// Загрузка файлов модели: по файлу — сколько скачано
const files = new Map<string, { loaded: number; total: number }>()

function getWorker() {
	if (worker) return worker
	// Воркер лежит в public: transformers.js он грузит сам, в сборку приложения она не попадает
	worker = new Worker('/transcribe-worker.js', { type: 'module' })
	worker.onmessage = (event: MessageEvent) => {
		const { type, id } = event.data
		if (type === 'progress') {
			files.set(event.data.file, {
				loaded: event.data.loaded,
				total: event.data.total
			})
			const all = Array.from(files.values())
			const progress =
				all.reduce((sum, file) => sum + file.loaded, 0) /
				Math.max(
					1,
					all.reduce((sum, file) => sum + file.total, 0)
				)
			pending.forEach(item =>
				item.onProgress?.({ stage: 'download', progress })
			)
			return
		}
		const request = pending.get(id)
		if (!request) return
		if (type === 'ready') {
			files.clear()
			if (request.onProgress) request.onProgress({ stage: 'recognize' })
			else {
				pending.delete(id)
				request.resolve(event.data.device)
			}
		} else if (type === 'result') {
			pending.delete(id)
			request.resolve(event.data.text)
		} else if (type === 'error') {
			pending.delete(id)
			request.reject(new Error(event.data.message))
		}
	}
	worker.onerror = event => {
		pending.forEach(item =>
			item.reject(new Error(event.message || 'Сбой распознавания'))
		)
		pending.clear()
		worker = null
	}
	return worker
}

function call<T>(
	message: Record<string, unknown>,
	onProgress?: (progress: ITranscribeProgress) => void,
	transfer?: Transferable[]
) {
	const id = ++counter
	return new Promise<T>((resolve, reject) => {
		pending.set(id, { resolve, reject, onProgress })
		getWorker().postMessage({ ...message, id }, transfer || [])
	})
}

/** Скачать модель заранее (из настроек), чтобы первая расшифровка не ждала */
export function preloadModel(
	model: Exclude<TypeSttModel, 'off'>,
	onProgress: (progress: number) => void
) {
	const id = ++counter
	return new Promise<string>((resolve, reject) => {
		pending.set(id, {
			resolve,
			reject,
			onProgress: progress => {
				if (progress.stage === 'download') onProgress(progress.progress ?? 0)
				else {
					pending.delete(id)
					resolve('ready')
				}
			}
		})
		getWorker().postMessage({ type: 'load', id, model })
	})
}

/** Модель уже лежит в кэше браузера? */
export async function isModelCached(model: Exclude<TypeSttModel, 'off'>) {
	try {
		const cache = await caches.open('transformers-cache')
		const keys = await cache.keys()
		return keys.some(
			request =>
				request.url.includes(`whisper-${model}/`) &&
				request.url.includes('.onnx')
		)
	} catch {
		return false
	}
}

async function decodeAudio(src: string) {
	const response = await fetch(src)
	if (!response.ok) throw new Error('Не удалось получить аудио')
	const buffer = await response.arrayBuffer()
	const context = new AudioContext({ sampleRate: 16000 })
	try {
		const audio = await context.decodeAudioData(buffer)
		if (audio.numberOfChannels === 1) return audio.getChannelData(0)
		// Стерео → моно
		const left = audio.getChannelData(0)
		const right = audio.getChannelData(1)
		const mono = new Float32Array(left.length)
		for (let i = 0; i < left.length; i++) mono[i] = (left[i] + right[i]) / 2
		return mono
	} finally {
		context.close()
	}
}

export async function transcribeAudio(
	src: string,
	onProgress: (progress: ITranscribeProgress) => void
) {
	const model = getPreferences().sttModel
	if (model === 'off') throw new Error('off')
	onProgress({ stage: 'prepare' })
	const audio = await decodeAudio(src)
	return call<string>({ type: 'transcribe', model, audio }, onProgress, [
		audio.buffer
	])
}
