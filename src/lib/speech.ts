import { useSyncExternalStore } from 'react'

import { nativePlugin } from './native'
import { getPreferences } from './preferences'

/*
 * Озвучка текста — через нейросетевые голоса Microsoft Edge TTS (/api/tts):
 * работает одинаково качественно на компьютере (в любом браузере и в Planner.exe)
 * и на телефоне (в мобильном браузере и в Android-приложении).
 * При отсутствии интернета автоматически переключается на системный синтезатор (Android / Web Speech API).
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

// В Android-приложении резервный офлайн-движок — системный плагин TextToSpeech
const nativeTts = () => nativePlugin('TextToSpeech')
export const isNativeSpeech = () => Boolean(nativeTts())

export const isSpeechSupported = () => typeof window !== 'undefined'

const hasWebSpeech = () =>
	typeof window !== 'undefined' && 'speechSynthesis' in window

/** Язык фразы: латиницы больше кириллицы — читаем английским голосом */
export function langOf(text: string) {
	const cyrillic = (text.match(/[а-яё]/gi) || []).length
	const latin = (text.match(/[a-z]/gi) || []).length
	return latin > cyrillic ? 'en-US' : 'ru-RU'
}

/* ---------- Голоса Edge TTS ---------- */

function createEdgeVoice(
	voiceURI: string,
	name: string,
	lang: string
): SpeechSynthesisVoice {
	return {
		voiceURI,
		name,
		lang,
		localService: false,
		default: voiceURI === 'ru-RU-SvetlanaNeural'
	}
}

export const EDGE_VOICES: SpeechSynthesisVoice[] = [
	createEdgeVoice(
		'ru-RU-SvetlanaNeural',
		'Светлана · Edge Neural',
		'ru-RU'
	),
	createEdgeVoice(
		'ru-RU-DmitryNeural',
		'Дмитрий · Edge Neural',
		'ru-RU'
	),
	createEdgeVoice(
		'ru-RU-DariyaNeural',
		'Дария · Edge Neural',
		'ru-RU'
	),
	createEdgeVoice(
		'en-US-AvaMultilingualNeural',
		'Ava Multilingual · Edge Neural',
		'en-US'
	),
	createEdgeVoice(
		'en-US-AndrewMultilingualNeural',
		'Andrew Multilingual · Edge Neural',
		'en-US'
	),
	createEdgeVoice(
		'en-US-EmmaMultilingualNeural',
		'Emma Multilingual · Edge Neural',
		'en-US'
	),
	createEdgeVoice(
		'en-US-BrianMultilingualNeural',
		'Brian Multilingual · Edge Neural',
		'en-US'
	),
	createEdgeVoice('en-US-AriaNeural', 'Aria · Edge Neural', 'en-US'),
	createEdgeVoice('en-US-GuyNeural', 'Guy · Edge Neural', 'en-US'),
	createEdgeVoice('en-GB-SoniaNeural', 'Sonia · Edge Neural', 'en-GB'),
	createEdgeVoice('en-GB-RyanNeural', 'Ryan · Edge Neural', 'en-GB')
]

const EDGE_VOICE_SET = new Set(EDGE_VOICES.map(v => v.voiceURI))

export function getVoices(): SpeechSynthesisVoice[] {
	return EDGE_VOICES
}

export function onVoicesChanged(_callback: () => void) {
	return () => {}
}

const voiceScore = (voice: SpeechSynthesisVoice) =>
	(EDGE_VOICE_SET.has(voice.voiceURI) ? 200 : 0) +
	(voice.lang.toLowerCase().startsWith('ru') ? 100 : 0) +
	(voice.voiceURI === 'ru-RU-SvetlanaNeural' ? 50 : 0) +
	(/multilingual/i.test(voice.voiceURI) ? 30 : 0) +
	(/natural|neural|online/i.test(voice.name) ? 20 : 0)

export function sortVoices(voices: SpeechSynthesisVoice[]) {
	return [...voices].sort(
		(a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name)
	)
}

/** Подбираем голос Edge TTS для текущего языка фразы */
function pickEdgeVoice(lang = 'ru-RU'): string {
	const { ttsVoice } = getPreferences()
	const chosen = EDGE_VOICE_SET.has(ttsVoice) ? ttsVoice : ''

	// Мультиязычные голоса Edge свободно читают и русский, и английский
	if (chosen && /multilingual/i.test(chosen)) {
		return chosen
	}

	const isRu = lang.toLowerCase().startsWith('ru')
	if (isRu) {
		if (chosen && chosen.startsWith('ru-')) return chosen
		return 'ru-RU-SvetlanaNeural'
	}

	if (chosen && chosen.startsWith('en-')) return chosen
	// Если выбран мужской русский голос (Дмитрий), английские фразы читаем мужским Andrew
	if (chosen === 'ru-RU-DmitryNeural') return 'en-US-AndrewMultilingualNeural'
	return 'en-US-AvaMultilingualNeural'
}

/** Резервный системный голос для офлайн-режима */
function pickFallbackBrowserVoice(lang = 'ru-RU') {
	if (!hasWebSpeech()) return undefined
	const voices = window.speechSynthesis.getVoices()
	if (!voices.length) return undefined
	const prefix = lang.slice(0, 2).toLowerCase()
	const sameLang = voices.filter(voice =>
		voice.lang.toLowerCase().startsWith(prefix)
	)
	if (sameLang.length) {
		return [...sameLang].sort(
			(a, b) =>
				(/natural|neural|online/i.test(b.name) ? 2 : 0) +
				(/google/i.test(b.name) ? 1 : 0) -
				((/natural|neural|online/i.test(a.name) ? 2 : 0) +
					(/google/i.test(a.name) ? 1 : 0))
		)[0]
	}
	return voices[0]
}

/* ---------- Кэш и предзагрузка аудио Edge TTS ---------- */

const MAX_AUDIO_CACHE = 50
const audioCache = new Map<string, Promise<string>>()
const resolvedBlobUrls = new Map<string, string>()

function makeTtsKey(text: string, voice: string, rate: number, pitch: number) {
	return `${voice}|${rate.toFixed(2)}|${pitch.toFixed(2)}|${text}`
}

function fetchEdgeAudioUrl(
	text: string,
	voice: string,
	rate: number,
	pitch: number
): Promise<string> {
	const key = makeTtsKey(text, voice, rate, pitch)
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

	const promise = fetch('/api/tts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ text, voice, rate, pitch })
	})
		.then(async res => {
			if (!res.ok) throw new Error(`TTS HTTP ${res.status}`)
			const blob = await res.blob()
			if (!blob.size) throw new Error('Empty TTS blob')
			const url = URL.createObjectURL(blob)
			resolvedBlobUrls.set(key, url)
			return url
		})
		.catch(err => {
			audioCache.delete(key)
			throw err
		})

	audioCache.set(key, promise)
	return promise
}

function prefetchChunk(index: number) {
	if (index < 0 || index >= chunks.length) return
	const text = chunks[index]
	if (!text) return
	const { ttsRate, ttsPitch } = getPreferences()
	const voice = pickEdgeVoice(langOf(text))
	void fetchEdgeAudioUrl(text, voice, ttsRate, ttsPitch).catch(() => {})
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
	const voice = pickFallbackBrowserVoice(lang)
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
	const { ttsRate, ttsPitch } = getPreferences()
	const lang = langOf(text)
	const voice = pickEdgeVoice(lang)

	emit({ status: 'playing', index, current: text })
	// Предзагружаем следующую фразу параллельно, чтобы переход между предложениями был бесшовным
	prefetchChunk(index + 1)

	fetchEdgeAudioUrl(text, voice, ttsRate, ttsPitch)
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
				if (my !== generation) return
				speakFallbackChunk(index, my)
			}
			audio.play().catch(() => {
				if (my !== generation) return
				speakFallbackChunk(index, my)
			})
		})
		.catch(() => {
			if (my !== generation) return
			speakFallbackChunk(index, my)
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
	const voice = pickEdgeVoice(lang)

	fetchEdgeAudioUrl(text, voice, rate, ttsPitch)
		.then(url => {
			if (my !== generation) return
			const audio = new Audio(url)
			currentAudio = audio
			audio.play().catch(() => {})
		})
		.catch(() => {
			if (my !== generation) return
			const native = nativeTts()
			if (native) {
				void native
					.speak({
						text,
						lang,
						rate,
						pitch: ttsPitch,
						category: 'playback'
					})
					.catch(() => {})
				return
			}
			if (!hasWebSpeech()) return
			const utterance = new SpeechSynthesisUtterance(text)
			const fallbackVoice = pickFallbackBrowserVoice(lang)
			if (fallbackVoice) utterance.voice = fallbackVoice
			utterance.lang = fallbackVoice?.lang || lang
			utterance.rate = rate
			utterance.pitch = ttsPitch
			window.speechSynthesis.speak(utterance)
		})
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
