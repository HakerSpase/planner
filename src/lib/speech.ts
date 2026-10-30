import { useSyncExternalStore } from 'react'

import { getPreferences } from './preferences'

/*
 * Озвучка текста — встроенным в браузер и систему синтезатором (Web Speech API):
 * бесплатно, без сервера, работает на Android, iPhone, в Chrome/Edge и в приложении на Windows.
 * Текст режется на предложения: длинную фразу Chrome обрывает примерно через 15 секунд,
 * а по предложениям можно листать вперёд и назад.
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

export const isSpeechSupported = () =>
	typeof window !== 'undefined' && 'speechSynthesis' in window

/* ---------- Голоса ---------- */

let voicesCache: SpeechSynthesisVoice[] = []

export function getVoices() {
	if (!isSpeechSupported()) return []
	const voices = window.speechSynthesis.getVoices()
	if (voices.length) voicesCache = voices
	return voicesCache
}

/** Голоса грузятся асинхронно (особенно на Android) — ждём событие */
export function onVoicesChanged(callback: () => void) {
	if (!isSpeechSupported()) return () => {}
	window.speechSynthesis.addEventListener('voiceschanged', callback)
	return () =>
		window.speechSynthesis.removeEventListener('voiceschanged', callback)
}

// Чем выше, тем лучше звучит: нейросетевые голоса Edge/Google — первыми
const voiceScore = (voice: SpeechSynthesisVoice) =>
	(voice.lang.toLowerCase().startsWith('ru') ? 100 : 0) +
	(/natural|neural|online/i.test(voice.name) ? 20 : 0) +
	(/google/i.test(voice.name) ? 10 : 0) +
	(voice.localService ? 0 : 2)

export function sortVoices(voices: SpeechSynthesisVoice[]) {
	return [...voices].sort(
		(a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name)
	)
}

function pickVoice() {
	const voices = getVoices()
	const { ttsVoice } = getPreferences()
	return (
		voices.find(voice => voice.voiceURI === ttsVoice) ?? sortVoices(voices)[0]
	)
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

const BLOCK =
	/^(P|LI|H[1-6]|TR|BLOCKQUOTE|DIV|PRE|UL|OL|TABLE|SECTION|FIGURE)$/

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

function speakChunk(index: number) {
	const synth = window.speechSynthesis
	const my = ++generation
	synth.cancel()
	if (index >= chunks.length) {
		stopSpeech()
		return
	}
	const { ttsRate, ttsPitch } = getPreferences()
	const utterance = new SpeechSynthesisUtterance(chunks[index])
	const voice = pickVoice()
	if (voice) utterance.voice = voice
	utterance.lang = voice?.lang || 'ru-RU'
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
	emit({ status: 'playing', index, current: chunks[index] })
	// cancel() в Chrome срабатывает не мгновенно — говорим на следующем такте
	setTimeout(() => {
		if (my === generation) synth.speak(utterance)
	}, 30)
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
	// pause() на Android глохнет навсегда — останавливаемся и продолжаем с этой же фразы
	generation++
	window.speechSynthesis.cancel()
	emit({ status: 'paused' })
}

export function resumeSpeech() {
	if (state.status === 'paused') speakChunk(state.index)
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
	if (isSpeechSupported()) window.speechSynthesis.cancel()
	chunks = []
	emit(IDLE)
}

/** Короткая голосовая подсказка (дыхание и т. п.) — мимо плеера, перебивает прошлую */
export function sayCue(text: string) {
	if (!isSpeechSupported()) return
	stopSpeech()
	const { ttsRate, ttsPitch } = getPreferences()
	const utterance = new SpeechSynthesisUtterance(text)
	const voice = pickVoice()
	if (voice) utterance.voice = voice
	utterance.lang = voice?.lang || 'ru-RU'
	utterance.rate = Math.min(1.2, ttsRate)
	utterance.pitch = ttsPitch
	window.speechSynthesis.speak(utterance)
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
