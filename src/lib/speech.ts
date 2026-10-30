import { useSyncExternalStore } from 'react'

import { nativePlugin } from './native'
import { isNeuralVoice, synthesizeNeural } from './neural-tts'
import { getPreferences } from './preferences'

/*
 * Озвучка текста. Два движка — и никогда не вперемешку:
 * - «Нейросеть»: Supertonic 3 прямо на устройстве (31 язык, русский и английский),
 *   бесплатно и без интернета после первой загрузки модели;
 * - «Системный»: голос браузера (Web Speech API) или Android (в приложении).
 * Текст режется на фразы: по ним можно листать, а следующая готовится заранее.
 */

export interface ISpeechState {
	status: 'idle' | 'playing' | 'paused'
	index: number
	total: number
	title: string
	current: string
}

const IDLE: ISpeechState = {
	status: 'idle',
	index: 0,
	total: 0,
	title: '',
	current: ''
}

let state: ISpeechState = IDLE
let chunks: string[] = []
// Поколение: колбэки старой фразы после stop()/перехода не должны ничего делать
let generation = 0
const listeners = new Set<() => void>()

const emit = (patch: Partial<ISpeechState>) => {
	state = { ...state, ...patch }
	listeners.forEach(listener => listener())
}

// В Android-приложении системный голос — плагин TextToSpeech (в WebView синтеза нет)
const nativeTts = () => nativePlugin('TextToSpeech')
export const isNativeSpeech = () => Boolean(nativeTts())

const hasWebSpeech = () =>
	typeof window !== 'undefined' && 'speechSynthesis' in window

export const isSpeechSupported = () => typeof window !== 'undefined'

/** Язык фразы: латиницы больше кириллицы — читаем по-английски */
export function langOf(text: string) {
	const cyrillic = (text.match(/[а-яё]/gi) || []).length
	const latin = (text.match(/[a-z]/gi) || []).length
	return latin > cyrillic ? 'en-US' : 'ru-RU'
}

const useNeural = () => getPreferences().ttsEngine === 'neural'

/* ---------- Системные голоса ---------- */

let voicesCache: SpeechSynthesisVoice[] = []

export function getVoices() {
	if (!hasWebSpeech()) return []
	const voices = window.speechSynthesis.getVoices()
	if (voices.length) voicesCache = voices
	return voicesCache
}

/** Голоса грузятся асинхронно (особенно на Android) — ждём событие */
export function onVoicesChanged(callback: () => void) {
	if (!hasWebSpeech()) return () => {}
	window.speechSynthesis.addEventListener('voiceschanged', callback)
	return () =>
		window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

const voiceScore = (voice: SpeechSynthesisVoice) =>
	(voice.lang.toLowerCase().startsWith('ru') ? 100 : 0) +
	(/multilingual/i.test(voice.name) ? 30 : 0) +
	(/natural|neural|online/i.test(voice.name) ? 20 : 0) +
	(/google/i.test(voice.name) ? 10 : 0)

export function sortVoices(voices: SpeechSynthesisVoice[]) {
	return [...voices].sort(
		(a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name)
	)
}

/** Выбранный системный голос — всегда он; не выбран — лучший для языка фразы */
function pickSystemVoice(lang = 'ru-RU') {
	const voices = getVoices()
	if (!voices.length) return undefined
	const chosen = voices.find(
		voice => voice.voiceURI === getPreferences().ttsVoice
	)
	if (chosen) return chosen
	const prefix = lang.slice(0, 2).toLowerCase()
	return (
		sortVoices(
			voices.filter(voice => voice.lang.toLowerCase().startsWith(prefix))
		)[0] ?? sortVoices(voices)[0]
	)
}

/* ---------- Нейроголос: кэш и подготовка следующей фразы ---------- */

const MAX_AUDIO_CACHE = 40
const audioCache = new Map<string, Promise<string>>()
const resolvedBlobUrls = new Map<string, string>()

function neuralOptions(text: string, rate: number) {
	const { ttsNeuralVoice, ttsSteps } = getPreferences()
	return {
		lang: langOf(text).slice(0, 2),
		voice: isNeuralVoice(ttsNeuralVoice) ? ttsNeuralVoice : 'F1',
		speed: rate,
		steps: ttsSteps
	}
}

function fetchAudioUrl(text: string, rate: number): Promise<string> {
	const options = neuralOptions(text, rate)
	const key = `${options.voice}|${options.steps}|${rate.toFixed(2)}|${text}`
	const existing = audioCache.get(key)
	if (existing) return existing

	if (audioCache.size >= MAX_AUDIO_CACHE) {
		const oldestKey = audioCache.keys().next().value
		if (oldestKey) {
			audioCache.delete(oldestKey)
			const oldUrl = resolvedBlobUrls.get(oldestKey)
			if (oldUrl) {
				URL.revokeObjectURL(oldUrl)
				resolvedBlobUrls.delete(oldestKey)
			}
		}
	}

	const promise = synthesizeNeural(text, options)
		.then(url => {
			resolvedBlobUrls.set(key, url)
			return url
		})
		.catch(error => {
			audioCache.delete(key)
			throw error
		})
	audioCache.set(key, promise)
	return promise
}

function prefetchChunk(index: number) {
	if (!useNeural() || index < 0) return
	// Две фразы вперёд: на телефоне синтез бывает медленнее речи
	for (const next of [index, index + 1]) {
		const text = chunks[next]
		if (text) void fetchAudioUrl(text, getPreferences().ttsRate).catch(() => {})
	}
}

/** Нейроголос не готов — говорим об этом, а не подменяем голос молча */
function neuralFailed(error: unknown) {
	stopSpeech()
	window.dispatchEvent(
		new CustomEvent('planner:tts-error', {
			detail: error instanceof Error ? error.message : String(error)
		})
	)
}

/* ---------- Управление активным аудио ---------- */

let currentAudio: HTMLAudioElement | null = null
let pausedAudio: HTMLAudioElement | null = null
let pausedIndex = -1

function stopCurrentAudio(keepPaused = false) {
	if (currentAudio) {
		currentAudio.onended = null
		currentAudio.onerror = null
		currentAudio.pause()
		if (!keepPaused) {
			currentAudio.removeAttribute('src')
			currentAudio = null
		}
	}
	if (!keepPaused) {
		pausedAudio = null
		pausedIndex = -1
	}
}

function cancelSynth(keepPaused = false) {
	stopCurrentAudio(keepPaused)
	const native = nativeTts()
	if (native) void native.stop().catch(() => {})
	else if (hasWebSpeech()) window.speechSynthesis.cancel()
}

/* ---------- Подготовка текста ---------- */

// Буква или цифра любого алфавита: фразы из одних знаков не читаем
const LETTER = new RegExp('[\\p{L}\\p{N}]', 'u')

/** Режем на фразы по ~200 символов: по предложениям, а слишком длинные — по запятым */
export function splitIntoChunks(text: string) {
	const sentences = text
		.replace(/[ \t]+/g, ' ')
		.split(/\n+|(?<=[.!?…])\s+(?=[«"(]?[А-ЯЁA-Z0-9])/)
		.map(item => item.trim())
		.filter(item => LETTER.test(item))
	const result: string[] = []
	for (const sentence of sentences) {
		if (sentence.length <= 220) {
			result.push(sentence)
			continue
		}
		let current = ''
		for (const part of sentence.split(/(?<=[,;:—])\s+/)) {
			if (current && (current + ' ' + part).length > 220) {
				result.push(current)
				current = part
			} else current = current ? `${current} ${part}` : part
		}
		if (current) result.push(current)
	}
	return result
}

const BLOCK = /^(P|LI|H[1-6]|TR|BLOCKQUOTE|DIV|PRE|UL|OL|TABLE|SECTION|FIGURE)$/

/**
 * Текст для чтения вслух из куска страницы: без формул, кода, графиков, скрытых ответов
 * и служебных пометок. Блоки разделяются переводом строки, ячейки — точкой.
 */
export function speechFromNode(root: Node) {
	const container = document.createElement('div')
	container.appendChild(root.cloneNode(true))
	container
		.querySelectorAll(
			'.katex, .math-render, .math-hidden, .math-source, pre, code, .visual-node, svg, canvas, img, audio, button, .annot-hidden, .callout-marker, .callout-toggle, [data-speech-skip], .link-preview'
		)
		.forEach(element => element.remove())
	// Карточка «вопрос :: ответ» читается как два предложения
	container
		.querySelectorAll('.card-separator')
		.forEach(element => (element.textContent = '. '))
	let text = ''
	const walk = (node: Node) => {
		if (node.nodeType === 3) {
			text += node.textContent
			return
		}
		if (node.nodeType !== 1) return
		const element = node as HTMLElement
		if (element.tagName === 'BR') {
			text += '\n'
			return
		}
		const block = BLOCK.test(element.tagName)
		if (block) text += '\n'
		element.childNodes.forEach(walk)
		if (element.tagName === 'TD' || element.tagName === 'TH') text += '. '
		if (block) text += '\n'
	}
	walk(container)
	return cleanForSpeech(text)
}

/** Остатки разметки, которые синтезатор прочитал бы как символы */
export function cleanForSpeech(text: string) {
	return text
		.replace(/\$\$[\s\S]*?\$\$|\$[^$\n]+\$/g, ' ')
		.replace(/\{[^\s|{}]{1,24}\\?\|/g, '')
		.replace(/[{}]|\[\[|\]\]|\[![a-zа-яё]+\][+-]?/gi, '')
		.replace(/[*_#`>|~^]+/g, ' ')
		.replace(/\s*(→|⇒|->|=>)\s*/g, ' — ')
		.replace(/https?:\/\/\S+/g, ' ')
		.replace(/[ \t]+/g, ' ')
		.replace(/ *\n */g, '\n')
		.trim()
}

/** Текст выделения на странице (или пустая строка) */
export function selectedSpeechText() {
	const selection = window.getSelection()
	if (!selection || selection.isCollapsed || !selection.rangeCount) return ''
	const fragment = selection.getRangeAt(0).cloneContents()
	const holder = document.createElement('div')
	holder.appendChild(fragment)
	return speechFromNode(holder)
}

/* ---------- Плеер ---------- */

function speakFallbackChunk(index: number, my: number) {
	const { ttsRate, ttsPitch } = getPreferences()
	const text = chunks[index]
	const lang = langOf(text)

	const native = nativeTts()
	if (native) {
		native
			.speak({
				text,
				lang,
				rate: ttsRate,
				pitch: ttsPitch,
				category: 'playback'
			})
			.then(() => {
				if (my === generation && state.status === 'playing')
					speakChunk(index + 1)
			})
			.catch(() => {
				if (my === generation) stopSpeech()
			})
		return
	}

	if (!hasWebSpeech()) {
		stopSpeech()
		return
	}

	const synth = window.speechSynthesis
	const utterance = new SpeechSynthesisUtterance(text)
	const voice = pickSystemVoice(lang)
	if (voice) utterance.voice = voice
	utterance.lang = voice?.lang || lang
	utterance.rate = ttsRate
	utterance.pitch = ttsPitch
	utterance.onend = () => {
		if (my === generation && state.status === 'playing') speakChunk(index + 1)
	}
	utterance.onerror = event => {
		if (
			my !== generation ||
			event.error === 'interrupted' ||
			event.error === 'canceled'
		)
			return
		stopSpeech()
	}
	setTimeout(() => {
		if (my === generation) synth.speak(utterance)
	}, 30)
}

function speakChunk(index: number) {
	const my = ++generation
	cancelSynth()
	if (index >= chunks.length) {
		stopSpeech()
		return
	}
	const text = chunks[index]
	emit({ status: 'playing', index, current: text })

	if (!useNeural()) {
		speakFallbackChunk(index, my)
		return
	}
	// Сначала текущая фраза, следом — следующие: нейросеть готовит их, пока звучит эта
	const current = fetchAudioUrl(text, getPreferences().ttsRate)
	prefetchChunk(index + 1)

	current
		.then(url => {
			if (my !== generation || state.status !== 'playing') return
			const audio = new Audio(url)
			currentAudio = audio
			audio.onended = () => {
				if (my === generation && state.status === 'playing') {
					speakChunk(index + 1)
				}
			}
			audio.onerror = () => {
				if (my === generation) neuralFailed('audio')
			}
			audio.play().catch(error => {
				if (my === generation) neuralFailed(error)
			})
		})
		.catch(error => {
			if (my === generation) neuralFailed(error)
		})
}

export function speak(text: string, title = '') {
	if (!isSpeechSupported()) return false
	chunks = splitIntoChunks(text)
	if (!chunks.length) return false
	emit({ title, total: chunks.length })
	speakChunk(0)
	return true
}

export function pauseSpeech() {
	if (state.status !== 'playing') return
	generation++
	if (currentAudio && !currentAudio.paused && !currentAudio.ended) {
		pausedAudio = currentAudio
		pausedIndex = state.index
		cancelSynth(true)
	} else {
		cancelSynth()
	}
	emit({ status: 'paused' })
}

export function resumeSpeech() {
	if (state.status !== 'paused') return
	if (
		pausedAudio &&
		pausedIndex === state.index &&
		pausedAudio.currentTime > 0 &&
		!pausedAudio.ended
	) {
		const my = ++generation
		const audio = pausedAudio
		const index = state.index
		pausedAudio = null
		pausedIndex = -1
		currentAudio = audio
		emit({ status: 'playing' })
		prefetchChunk(index + 1)
		audio.onended = () => {
			if (my === generation && state.status === 'playing') {
				speakChunk(index + 1)
			}
		}
		audio.onerror = () => {
			if (my !== generation) return
			speakChunk(index)
		}
		audio.play().catch(() => {
			if (my !== generation) return
			speakChunk(index)
		})
		return
	}
	speakChunk(state.index)
}

/** Фразы текущего чтения — для шкалы плеера */
export const getSpeechChunks = () => chunks

/** Перейти к фразе по номеру (перемотка по шкале) */
export function seekSpeechTo(index: number) {
	if (state.status === 'idle' || !chunks.length) return
	speakChunk(Math.max(0, Math.min(chunks.length - 1, index)))
}

export function seekSpeech(delta: number) {
	if (state.status === 'idle') return
	speakChunk(Math.max(0, Math.min(chunks.length - 1, state.index + delta)))
}

/** Скорость или голос поменяли на ходу — перечитываем текущую фразу с новыми настройками */
export function restartCurrent() {
	if (state.status === 'playing') speakChunk(state.index)
}

export function stopSpeech() {
	generation++
	if (isSpeechSupported()) cancelSynth()
	chunks = []
	emit(IDLE)
}

/** Короткая голосовая подсказка (дыхание и т. п.) — мимо плеера, перебивает прошлую */
export function sayCue(text: string) {
	if (!isSpeechSupported()) return
	stopSpeech()
	const my = ++generation
	const { ttsRate, ttsPitch } = getPreferences()
	const rate = Math.min(1.2, ttsRate)
	const lang = langOf(text)

	const system = () => {
		const native = nativeTts()
		if (native) {
			void native
				.speak({ text, lang, rate, pitch: ttsPitch, category: 'playback' })
				.catch(() => {})
			return
		}
		if (!hasWebSpeech()) return
		const utterance = new SpeechSynthesisUtterance(text)
		const voice = pickSystemVoice(lang)
		if (voice) utterance.voice = voice
		utterance.lang = voice?.lang || lang
		utterance.rate = rate
		utterance.pitch = ttsPitch
		window.speechSynthesis.speak(utterance)
	}

	if (!useNeural()) return system()
	fetchAudioUrl(text, rate)
		.then(url => {
			if (my !== generation) return
			const audio = new Audio(url)
			currentAudio = audio
			audio.play().catch(() => {})
		})
		.catch(() => {})
}

const subscribe = (listener: () => void) => {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function useSpeech() {
	return useSyncExternalStore(
		subscribe,
		() => state,
		() => IDLE
	)
}
