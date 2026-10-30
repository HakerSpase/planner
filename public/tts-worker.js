/*
 * Озвучка нейросетью Supertonic 3 прямо на устройстве (ONNX Runtime: WebGPU, иначе WASM).
 * 31 язык, в том числе русский и английский, 10 голосов. Модель (~400 МБ) скачивается
 * один раз и лежит в кэше браузера — дальше всё работает без интернета.
 *
 * Перенесено из официального примера Supertonic (MIT): github.com/supertone-oss-archive/supertonic/web
 * Модель: huggingface.co/Supertone/supertonic-3 (OpenRAIL-M).
 */
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.webgpu.min.mjs'

const ORT_DIST = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/'
const MODEL_BASE =
	'https://huggingface.co/Supertone/supertonic-3/resolve/3cadd1ee6394adea1bd021217a0e650ede09a323/'
const CACHE = 'supertonic-3'
const MODELS = ['duration_predictor', 'text_encoder', 'vector_estimator', 'vocoder']
const LANGS = new Set(['en', 'ko', 'ja', 'ar', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hi', 'hr', 'hu', 'id', 'it', 'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'ru', 'sk', 'sl', 'sv', 'tr', 'uk', 'vi'])

ort.env.wasm.wasmPaths = ORT_DIST
ort.env.wasm.numThreads = self.crossOriginIsolated
	? Math.min(4, navigator.hardwareConcurrency || 1)
	: 1

let engine = null
let loading = null
const styles = new Map()

/* ---------- Загрузка файлов с кэшем и прогрессом ---------- */

async function fetchCached(path, onProgress) {
	const url = MODEL_BASE + path
	const cache = await caches.open(CACHE)
	const hit = await cache.match(url)
	if (hit) {
		const buffer = await hit.arrayBuffer()
		onProgress?.(buffer.byteLength, buffer.byteLength, true)
		return buffer
	}
	const response = await fetch(url)
	if (!response.ok) throw new Error(`Не удалось скачать ${path}`)
	const total = Number(response.headers.get('content-length')) || 0
	const reader = response.body.getReader()
	const parts = []
	let loaded = 0
	for (;;) {
		const { done, value } = await reader.read()
		if (done) break
		parts.push(value)
		loaded += value.byteLength
		onProgress?.(loaded, total || loaded, false)
	}
	const buffer = new Uint8Array(loaded)
	let offset = 0
	for (const part of parts) {
		buffer.set(part, offset)
		offset += part.byteLength
	}
	await cache.put(url, new Response(buffer.buffer.slice(0)))
	return buffer.buffer
}

const SIZES = {
	duration_predictor: 3.7e6,
	text_encoder: 36.4e6,
	vector_estimator: 256.5e6,
	vocoder: 101.4e6
}

// Где считаем: видеокарта (WebGPU) быстрее в разы; нет её — процессор (WASM)
let backend = 'wasm'

async function createSession(buffer) {
	if ('gpu' in navigator && backend !== 'wasm-only') {
		try {
			const session = await ort.InferenceSession.create(buffer, { executionProviders: ['webgpu'] })
			backend = 'webgpu'
			return session
		} catch {
			backend = 'wasm-only'
		}
	}
	return ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] })
}

function load(id) {
	if (engine) return Promise.resolve(engine)
	if (loading) return loading
	loading = (async () => {
		const done = {}
		const totalSize = Object.values(SIZES).reduce((a, b) => a + b, 0)
		const report = () => {
			const loaded = Object.values(done).reduce((a, b) => a + b, 0)
			self.postMessage({ type: 'progress', id, progress: Math.min(1, loaded / totalSize) })
		}
		const cfgs = JSON.parse(new TextDecoder().decode(await fetchCached('onnx/tts.json')))
		const indexer = JSON.parse(new TextDecoder().decode(await fetchCached('onnx/unicode_indexer.json')))
		const sessions = {}
		for (const name of MODELS) {
			const buffer = await fetchCached(`onnx/${name}.onnx`, (loaded, total) => {
				done[name] = (loaded / total) * SIZES[name]
				report()
			})
			sessions[name] = await createSession(buffer)
		}
		engine = { cfgs, indexer, sessions, sampleRate: cfgs.ae.sample_rate }
		return engine
	})()
	loading.catch(() => (loading = null))
	return loading
}

async function loadStyle(voice) {
	if (styles.has(voice)) return styles.get(voice)
	const json = JSON.parse(new TextDecoder().decode(await fetchCached(`voice_styles/${voice}.json`)))
	const tensor = item =>
		new ort.Tensor('float32', Float32Array.from(item.data.flat(Infinity)), item.dims)
	const style = { ttl: tensor(json.style_ttl), dp: tensor(json.style_dp) }
	styles.set(voice, style)
	return style
}

/* ---------- Подготовка текста (как в официальном примере) ---------- */

const EMOJI = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu

function preprocess(text, lang) {
	text = text.normalize('NFKD').replace(EMOJI, '')
	const replacements = {
		'–': '-', '‑': '-', '—': '-', '_': ' ',
		'“': '"', '”': '"', '‘': "'", '’': "'", '´': "'", '`': "'",
		'«': '"', '»': '"', '[': ' ', ']': ' ', '|': ' ', '/': ' ', '#': ' ', '→': ' ', '←': ' '
	}
	for (const [from, to] of Object.entries(replacements)) text = text.replaceAll(from, to)
	text = text.replace(/[♥☆♡©\\]/g, '').replaceAll('@', ' at ')
	text = text
		.replace(/ ,/g, ',')
		.replace(/ \./g, '.')
		.replace(/ !/g, '!')
		.replace(/ \?/g, '?')
		.replace(/ ;/g, ';')
		.replace(/ :/g, ':')
		.replace(/ '/g, "'")
	while (text.includes('""')) text = text.replace('""', '"')
	while (text.includes("''")) text = text.replace("''", "'")
	text = text.replace(/\s+/g, ' ').trim()
	if (!/[.!?;:,'"')\]}…。」』】〉》›»]$/.test(text)) text += '.'
	return `<${lang}>${text}</${lang}>`
}

function gaussian(size) {
	const out = new Float32Array(size)
	for (let i = 0; i < size; i += 2) {
		const u1 = Math.max(1e-4, Math.random())
		const u2 = Math.random()
		const r = Math.sqrt(-2 * Math.log(u1))
		out[i] = r * Math.cos(2 * Math.PI * u2)
		if (i + 1 < size) out[i + 1] = r * Math.sin(2 * Math.PI * u2)
	}
	return out
}

/* ---------- Синтез одной фразы ---------- */

async function synthesize({ text, lang, voice, speed, steps }) {
	const { cfgs, indexer, sessions, sampleRate } = await load()
	const style = await loadStyle(voice)
	const code = LANGS.has(lang) ? lang : 'en'
	const processed = preprocess(text, code)

	const ids = new BigInt64Array(processed.length)
	for (let i = 0; i < processed.length; i++) {
		const point = processed.codePointAt(i)
		ids[i] = BigInt(point < indexer.length ? indexer[point] : -1)
	}
	const textIds = new ort.Tensor('int64', ids, [1, ids.length])
	const textMask = new ort.Tensor('float32', new Float32Array(ids.length).fill(1), [1, 1, ids.length])

	const { duration } = await sessions.duration_predictor.run({
		text_ids: textIds,
		style_dp: style.dp,
		text_mask: textMask
	})
	const seconds = duration.data[0] / (speed || 1)

	const { text_emb: textEmb } = await sessions.text_encoder.run({
		text_ids: textIds,
		style_ttl: style.ttl,
		text_mask: textMask
	})

	const wavLength = Math.floor(seconds * sampleRate)
	const chunkSize = cfgs.ae.base_chunk_size * cfgs.ttl.chunk_compress_factor
	const latentLength = Math.max(1, Math.ceil(wavLength / chunkSize))
	const latentDim = cfgs.ttl.latent_dim * cfgs.ttl.chunk_compress_factor
	let latent = gaussian(latentDim * latentLength)
	const latentMask = new ort.Tensor('float32', new Float32Array(latentLength).fill(1), [1, 1, latentLength])
	// 0 — «авто»: на видеокарте 8 шагов (лучше звук), на процессоре 4 (быстрее)
	if (!steps) steps = backend === 'webgpu' ? 8 : 4
	const totalStep = new ort.Tensor('float32', new Float32Array([steps]), [1])

	for (let step = 0; step < steps; step++) {
		const { denoised_latent: denoised } = await sessions.vector_estimator.run({
			noisy_latent: new ort.Tensor('float32', latent, [1, latentDim, latentLength]),
			text_emb: textEmb,
			style_ttl: style.ttl,
			latent_mask: latentMask,
			text_mask: textMask,
			current_step: new ort.Tensor('float32', new Float32Array([step]), [1]),
			total_step: totalStep
		})
		latent = new Float32Array(await denoised.getData())
	}

	const { wav_tts: wavTensor } = await sessions.vocoder.run({
		latent: new ort.Tensor('float32', latent, [1, latentDim, latentLength])
	})
	const wav = new Float32Array(await wavTensor.getData()).slice(0, wavLength || undefined)
	return { wav, sampleRate }
}

/* ---------- Сообщения ---------- */

// Фразы синтезируем строго по очереди — так меньше памяти и нет гонок на WebGPU
let queue = Promise.resolve()

self.onmessage = event => {
	const { type, id } = event.data
	if (type === 'load') {
		load(id)
			.then(() => self.postMessage({ type: 'ready', id, backend }))
			.catch(error => self.postMessage({ type: 'error', id, message: String(error?.message || error) }))
		return
	}
	if (type === 'synthesize') {
		queue = queue.then(() =>
			synthesize(event.data)
				.then(({ wav, sampleRate }) =>
					self.postMessage({ type: 'audio', id, wav, sampleRate }, [wav.buffer])
				)
				.catch(error =>
					self.postMessage({ type: 'error', id, message: String(error?.message || error) })
				)
		)
	}
}
