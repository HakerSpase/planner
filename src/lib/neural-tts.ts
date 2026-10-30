/*
 * Нейроголос Supertonic 3 на устройстве: обёртка над воркером /tts-worker.js.
 * Модель скачивается один раз (~400 МБ) и дальше работает без интернета.
 */

export const NEURAL_VOICES: { id: string; name: string }[] = [
	{ id: 'F1', name: 'Женский 1' },
	{ id: 'F2', name: 'Женский 2' },
	{ id: 'F3', name: 'Женский 3' },
	{ id: 'F4', name: 'Женский 4' },
	{ id: 'F5', name: 'Женский 5' },
	{ id: 'M1', name: 'Мужской 1' },
	{ id: 'M2', name: 'Мужской 2' },
	{ id: 'M3', name: 'Мужской 3' },
	{ id: 'M4', name: 'Мужской 4' },
	{ id: 'M5', name: 'Мужской 5' }
]

export const isNeuralVoice = (id: string) =>
	NEURAL_VOICES.some(voice => voice.id === id)

const CACHE = 'supertonic-3'

let worker: Worker | null = null
let counter = 0
const pending = new Map<
	number,
	{
		resolve: (value: any) => void
		reject: (error: Error) => void
		onProgress?: (progress: number) => void
	}
>()
let ready = false
// На чём считает модель: webgpu (видеокарта) или wasm (процессор)
let backend = ''
export const neuralBackend = () => backend

function getWorker() {
	if (worker) return worker
	worker = new Worker('/tts-worker.js', { type: 'module' })
	worker.onmessage = (event: MessageEvent) => {
		const { type, id } = event.data
		const request = pending.get(id)
		if (type === 'progress') {
			request?.onProgress?.(event.data.progress)
			return
		}
		if (!request) return
		pending.delete(id)
		if (type === 'ready') {
			ready = true
			backend = event.data.backend || 'wasm'
			request.resolve(true)
		} else if (type === 'audio') {
			ready = true
			request.resolve({
				wav: event.data.wav as Float32Array,
				sampleRate: event.data.sampleRate as number
			})
		} else if (type === 'error') request.reject(new Error(event.data.message))
	}
	worker.onerror = event => {
		pending.forEach(item =>
			item.reject(new Error(event.message || 'Сбой нейроголоса'))
		)
		pending.clear()
		worker = null
		ready = false
	}
	return worker
}

/** Модель уже в памяти воркера — фразы пойдут без задержки на загрузку */
export const isNeuralReady = () => ready

/** Модель лежит в кэше браузера? (все четыре файла) */
export async function isNeuralCached() {
	try {
		const cache = await caches.open(CACHE)
		const keys = await cache.keys()
		return [
			'duration_predictor',
			'text_encoder',
			'vector_estimator',
			'vocoder'
		].every(name =>
			keys.some(request => request.url.includes(`/onnx/${name}.onnx`))
		)
	} catch {
		return false
	}
}

/** Скачать и подготовить модель (из настроек), с прогрессом 0…1 */
export function preloadNeural(onProgress?: (progress: number) => void) {
	const id = ++counter
	return new Promise<boolean>((resolve, reject) => {
		pending.set(id, { resolve, reject, onProgress })
		getWorker().postMessage({ type: 'load', id })
	})
}

/** Удалить скачанную модель */
export async function removeNeural() {
	worker?.terminate()
	worker = null
	ready = false
	await caches.delete(CACHE).catch(() => false)
}

/** Озвучить фразу: вернёт ссылку на WAV для <audio> */
export async function synthesizeNeural(
	text: string,
	options: { lang: string; voice: string; speed: number; steps: number }
) {
	const id = ++counter
	const { wav, sampleRate } = await new Promise<{
		wav: Float32Array
		sampleRate: number
	}>((resolve, reject) => {
		pending.set(id, { resolve, reject })
		getWorker().postMessage({ type: 'synthesize', id, text, ...options })
	})
	return URL.createObjectURL(
		new Blob([toWav(wav, sampleRate)], { type: 'audio/wav' })
	)
}

function toWav(samples: Float32Array, sampleRate: number) {
	const buffer = new ArrayBuffer(44 + samples.length * 2)
	const view = new DataView(buffer)
	const write = (offset: number, text: string) => {
		for (let i = 0; i < text.length; i++)
			view.setUint8(offset + i, text.charCodeAt(i))
	}
	write(0, 'RIFF')
	view.setUint32(4, 36 + samples.length * 2, true)
	write(8, 'WAVE')
	write(12, 'fmt ')
	view.setUint32(16, 16, true)
	view.setUint16(20, 1, true)
	view.setUint16(22, 1, true)
	view.setUint32(24, sampleRate, true)
	view.setUint32(28, sampleRate * 2, true)
	view.setUint16(32, 2, true)
	view.setUint16(34, 16, true)
	write(36, 'data')
	view.setUint32(40, samples.length * 2, true)
	for (let i = 0; i < samples.length; i++) {
		const value = Math.max(-1, Math.min(1, samples[i]))
		view.setInt16(44 + i * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true)
	}
	return buffer
}
