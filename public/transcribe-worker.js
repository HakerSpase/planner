/*
 * Расшифровка речи нейросетью Whisper прямо на устройстве (transformers.js, ONNX).
 * Библиотека грузится с CDN только когда нужна; модель скачивается один раз и хранится
 * в кэше браузера, звук никуда не уходит. С видеокартой (WebGPU) — быстрее, без неё — WASM.
 */
import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1'

env.allowLocalModels = false

const MODELS = {
	tiny: 'onnx-community/whisper-tiny',
	base: 'onnx-community/whisper-base',
	small: 'onnx-community/whisper-small'
}

let current = null

async function hasWebGpu() {
	try {
		return Boolean(navigator.gpu && (await navigator.gpu.requestAdapter()))
	} catch {
		return false
	}
}

const progress_callback = event => {
	if (event.status === 'progress')
		self.postMessage({ type: 'progress', file: event.file, loaded: event.loaded, total: event.total })
}

const create = (id, device) =>
	pipeline('automatic-speech-recognition', id, {
		device,
		dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
		progress_callback
	})

async function load(model) {
	if (current && current.key === model) {
		await current.asr
		return current
	}
	const id = MODELS[model] || MODELS.base
	const device = (await hasWebGpu()) ? 'webgpu' : 'wasm'
	current = { key: model, device, asr: create(id, device) }
	try {
		await current.asr
	} catch (error) {
		// WebGPU на некоторых устройствах падает — тогда процессор
		if (device === 'wasm') {
			current = null
			throw error
		}
		current = { key: model, device: 'wasm', asr: create(id, 'wasm') }
		await current.asr
	}
	return current
}

self.onmessage = async event => {
	const { type, id, model, audio } = event.data
	try {
		const loaded = await load(model)
		self.postMessage({ type: 'ready', id, device: loaded.device })
		if (type !== 'transcribe') return
		const asr = await loaded.asr
		const output = await asr(audio, {
			language: 'russian',
			task: 'transcribe',
			chunk_length_s: 30,
			stride_length_s: 5
		})
		const text = Array.isArray(output) ? output.map(item => item.text).join(' ') : output.text
		self.postMessage({ type: 'result', id, text: String(text || '').trim() })
	} catch (error) {
		self.postMessage({ type: 'error', id, message: error && error.message ? error.message : String(error) })
	}
}
