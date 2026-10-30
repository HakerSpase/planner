import type { TypeMusicStyle } from './preferences'

/*
 * Фоновая музыка, которая генерируется прямо в браузере (Web Audio):
 * бесконечная, без файлов и лицензий, не тратит место в хранилище.
 * Каждый запуск — своя тональность и гармония, а внутри стиля последовательности
 * аккордов сменяют друг друга, так что музыка не приедается.
 *  — lofi:    электропиано, бас, мягкий бит со свингом, треск винила
 *  — jazz:    ночной джаз — септаккорды, шагающий бас, щётки
 *  — piano:   спокойное фортепиано арпеджио, как для учёбы
 *  — ambient: медленные пэды с длинной реверберацией
 *  — rain:    шум дождя и редкие ноты пианино
 *  — forest:  ручей, птицы и тихий пэд
 *  — space:   космос — мерцающее арпеджио с эхом поверх пэдов
 *  — fire:    треск камина и мягкие переборы
 */

type Chord = number[]

// Набор гармоний: стиль выбирает свою и переключается между ними
const LOFI_PROGRESSIONS: Chord[][] = [
	// Fmaj7 → Em7 → Dm7 → Cmaj7
	[[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
	// Am9 → Dm9 → Gmaj7 → Cmaj7
	[[45, 55, 60, 64, 71], [50, 57, 60, 64, 65], [43, 55, 59, 62, 66], [48, 55, 59, 64]],
	// Ebmaj7 → Dm7 → Cm7 → Bbmaj7
	[[51, 55, 58, 62], [50, 53, 57, 60], [48, 51, 55, 58], [46, 50, 53, 57]],
	// Dm9 → G13 → Cmaj9 → A7b13
	[[50, 53, 57, 60, 64], [43, 53, 59, 64], [48, 52, 55, 59, 62], [45, 55, 61, 65]]
]

const JAZZ_PROGRESSIONS: Chord[][] = [
	// ii–V–I–VI в до мажоре
	[[50, 53, 57, 60], [43, 53, 59, 64], [48, 52, 55, 59], [45, 55, 61, 64]],
	// Минорный ii–V–i
	[[50, 53, 56, 60], [43, 53, 56, 59], [48, 51, 55, 58], [48, 51, 55, 58]],
	// iii–VI–ii–V
	[[52, 55, 59, 62], [45, 55, 61, 64], [50, 53, 57, 60], [43, 53, 59, 64]]
]

const PIANO_PROGRESSIONS: Chord[][] = [
	// C → G/B → Am → F
	[[48, 55, 60, 64], [47, 55, 59, 62], [45, 52, 57, 60], [41, 53, 57, 60]],
	// Am → F → C → G
	[[45, 52, 57, 60], [41, 53, 57, 60], [48, 55, 60, 64], [43, 55, 59, 62]],
	// Fmaj7 → G → Em7 → Am
	[[41, 53, 57, 64], [43, 55, 59, 62], [40, 52, 55, 62], [45, 52, 57, 60]]
]

const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76]
const MINOR_PENTATONIC = [57, 60, 62, 64, 67, 69, 72]

const TEMPO: Record<TypeMusicStyle, number> = {
	lofi: 72,
	jazz: 84,
	piano: 66,
	ambient: 60,
	rain: 60,
	forest: 60,
	space: 90,
	fire: 64
}

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)]
const chance = (probability: number) => Math.random() < probability

class AmbientMusic {
	private ctx: AudioContext | null = null
	private master: GainNode | null = null
	private bus: GainNode | null = null
	private tone: BiquadFilterNode | null = null
	private echo: GainNode | null = null
	private reverb: ConvolverNode | null = null
	private noise: AudioBuffer | null = null
	private loops: AudioScheduledSourceNode[] = []
	private timer: ReturnType<typeof setInterval> | null = null
	private nextTime = 0
	private step = 0

	// Случайные на каждый запуск: сдвиг тональности и текущая гармония
	private transpose = 0
	private progression: Chord[] = LOFI_PROGRESSIONS[0]

	private style: TypeMusicStyle = 'lofi'
	private volume = 0.35
	private enabled = false
	private ducked = false
	private started = false

	/** Применить настройки. Сам звук стартует только после жеста пользователя (правило браузеров). */
	configure({ enabled, style, volume }: { enabled: boolean; style: TypeMusicStyle; volume: number }) {
		const styleChanged = style !== this.style
		this.enabled = enabled
		this.style = TEMPO[style] ? style : 'lofi'
		this.volume = Math.max(0, Math.min(1, volume / 100))
		if (!enabled) return this.stop()
		// Только что было нажатие (например, включили музыку кнопкой) — стартуем сразу
		if (!this.started)
			return (navigator as any).userActivation?.isActive ? this.start() : this.waitForGesture()
		if (styleChanged || !this.timer) this.restart()
		else this.applyVolume()
	}

	/** Во время сеанса дыхания музыка плавно затихает */
	setDucked(ducked: boolean) {
		this.ducked = ducked
		this.applyVolume(2)
	}

	private get beat() {
		return 60 / TEMPO[this.style]
	}

	private waitForGesture() {
		const start = () => {
			window.removeEventListener('pointerdown', start)
			window.removeEventListener('keydown', start)
			if (this.enabled) this.start()
		}
		window.addEventListener('pointerdown', start, { once: true })
		window.addEventListener('keydown', start, { once: true })
	}

	private ensureContext() {
		if (this.ctx) return this.ctx
		const Context = window.AudioContext || (window as any).webkitAudioContext
		const ctx: AudioContext = new Context()
		this.ctx = ctx

		this.master = ctx.createGain()
		this.master.gain.value = 0
		const tone = ctx.createBiquadFilter()
		tone.type = 'lowpass'
		tone.frequency.value = 2600
		this.tone = tone
		this.master.connect(tone).connect(ctx.destination)

		// Реверберация из сгенерированного отклика — без файлов
		this.reverb = ctx.createConvolver()
		const length = ctx.sampleRate * 3
		const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
		for (let channel = 0; channel < 2; channel++) {
			const data = impulse.getChannelData(channel)
			for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6)
		}
		this.reverb.buffer = impulse
		const wet = ctx.createGain()
		wet.gain.value = 0.35
		this.reverb.connect(wet).connect(this.master)

		this.bus = ctx.createGain()
		this.bus.connect(this.master)
		this.bus.connect(this.reverb)

		// Эхо с затуханием — для «космоса» и перебора у камина
		this.echo = ctx.createGain()
		const delay = ctx.createDelay(2)
		delay.delayTime.value = 0.42
		const feedback = ctx.createGain()
		feedback.gain.value = 0.38
		const damp = ctx.createBiquadFilter()
		damp.type = 'lowpass'
		damp.frequency.value = 1800
		this.echo.connect(delay)
		delay.connect(damp).connect(feedback).connect(delay)
		damp.connect(this.bus)
		this.echo.connect(this.bus)

		const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
		const data = noise.getChannelData(0)
		let last = 0
		for (let i = 0; i < data.length; i++) {
			// розовато-коричневый шум — мягче белого
			last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
			data[i] = last * 3.5
		}
		this.noise = noise
		return ctx
	}

	private start() {
		const ctx = this.ensureContext()
		ctx.resume().catch(() => {})
		this.started = true
		this.restart()
	}

	private restart() {
		if (!this.ctx) return
		this.stopSources()
		this.transpose = pick([-3, -2, 0, 0, 2, 3])
		this.progression = pick(this.progressions())
		// Птицам и треску камина нужны верха — остальным стилям мягкий, «тёплый» звук
		this.tone!.frequency.value = this.style === 'forest' || this.style === 'fire' ? 7000 : 2600
		this.nextTime = this.ctx.currentTime + 0.1
		this.step = 0
		this.startLoops()
		this.timer = setInterval(() => this.schedule(), 60)
		this.applyVolume(1.5)
	}

	private progressions() {
		if (this.style === 'jazz') return JAZZ_PROGRESSIONS
		if (this.style === 'piano' || this.style === 'fire') return PIANO_PROGRESSIONS
		return LOFI_PROGRESSIONS
	}

	private stop() {
		if (!this.ctx || !this.master) return
		this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
		setTimeout(() => {
			if (!this.enabled) this.stopSources()
		}, 1500)
	}

	private stopSources() {
		if (this.timer) clearInterval(this.timer)
		this.timer = null
		this.loops.forEach(node => {
			try {
				node.stop()
			} catch {}
		})
		this.loops = []
	}

	private applyVolume(seconds = 0.6) {
		if (!this.ctx || !this.master) return
		const target = this.enabled && !this.ducked ? this.volume * 0.5 : 0
		this.master.gain.setTargetAtTime(target, this.ctx.currentTime, seconds / 3)
	}

	/* ---------- Постоянные слои: треск винила, дождь, ручей, камин ---------- */

	private noiseLoop(type: BiquadFilterType, frequency: number, level: number, q = 0.7) {
		const ctx = this.ctx!
		const source = ctx.createBufferSource()
		source.buffer = this.noise
		source.loop = true
		source.loopStart = Math.random()
		const filter = ctx.createBiquadFilter()
		filter.type = type
		filter.frequency.value = frequency
		filter.Q.value = q
		const gain = ctx.createGain()
		gain.gain.value = level
		source.connect(filter).connect(gain).connect(this.master!)
		source.start(0, Math.random() * 3)
		this.loops.push(source)
		return { filter, gain }
	}

	/** Медленное «дыхание» параметра — волны ручья, порывы дождя */
	private wobble(param: AudioParam, depth: number, rate: number) {
		const ctx = this.ctx!
		const lfo = ctx.createOscillator()
		lfo.frequency.value = rate
		const amount = ctx.createGain()
		amount.gain.value = depth
		lfo.connect(amount).connect(param)
		lfo.start()
		this.loops.push(lfo)
	}

	private drone(midi: number, level: number) {
		const ctx = this.ctx!
		const osc = ctx.createOscillator()
		osc.type = 'sine'
		osc.frequency.value = freq(midi + this.transpose)
		const gain = ctx.createGain()
		gain.gain.value = level
		osc.connect(gain).connect(this.bus!)
		osc.start()
		this.loops.push(osc)
	}

	private startLoops() {
		switch (this.style) {
			case 'lofi':
				this.noiseLoop('bandpass', 3200, 0.025, 0.6)
				break
			case 'jazz':
				this.noiseLoop('bandpass', 2600, 0.012, 0.5)
				break
			case 'rain': {
				const { gain } = this.noiseLoop('highpass', 900, 0.16)
				this.wobble(gain.gain, 0.04, 0.07)
				break
			}
			case 'forest': {
				const stream = this.noiseLoop('bandpass', 1300, 0.09, 0.4)
				this.wobble(stream.filter.frequency, 400, 0.13)
				this.wobble(stream.gain.gain, 0.025, 0.21)
				this.drone(48, 0.025)
				break
			}
			case 'fire': {
				const hum = this.noiseLoop('lowpass', 280, 0.12)
				this.wobble(hum.gain.gain, 0.03, 0.09)
				break
			}
			case 'ambient':
				this.drone(36, 0.05)
				break
			case 'space':
				this.drone(33, 0.04)
				this.drone(40, 0.02)
				break
		}
	}

	/* ---------- Планировщик событий (смотрит на 0,4 с вперёд) ---------- */

	private schedule() {
		const ctx = this.ctx
		if (!ctx) return
		while (this.nextTime < ctx.currentTime + 0.4) {
			const time = this.nextTime
			const step = this.step
			// Каждые 16 тактов — другая гармония, чтобы не приедалось
			if (step > 0 && step % (8 * 16) === 0) this.progression = pick(this.progressions())
			switch (this.style) {
				case 'lofi':
					this.lofiStep(time, step)
					break
				case 'jazz':
					this.jazzStep(time, step)
					break
				case 'piano':
					this.pianoStep(time, step)
					break
				case 'ambient':
					this.ambientStep(time, step)
					break
				case 'rain':
					this.rainStep(time, step)
					break
				case 'forest':
					this.forestStep(time, step)
					break
				case 'space':
					this.spaceStep(time, step)
					break
				case 'fire':
					this.fireStep(time, step)
					break
			}
			// восьмые доли; у лоу-фая и джаза — со свингом
			const swing = this.style === 'lofi' || this.style === 'jazz' ? 0.12 : 0
			this.nextTime += (this.beat / 2) * (step % 2 === 0 ? 1 + swing : 1 - swing)
			this.step++
		}
	}

	private chordAt(step: number, barsPerChord = 2) {
		const bar = Math.floor(step / 8)
		return this.progression[Math.floor(bar / barsPerChord) % this.progression.length].map(
			note => note + this.transpose
		)
	}

	private lofiStep(time: number, step: number) {
		const eighth = step % 8
		const chord = this.chordAt(step)
		const beat = this.beat

		if (eighth === 0) {
			chord.forEach((note, i) => this.keys(time + i * 0.012, note, beat * 4, 0.05))
			this.bass(time, chord[0] - 12, beat * 1.6)
		}
		if (eighth === 5 && chance(0.5))
			chord.slice(1).forEach(note => this.keys(time, note + 12, beat * 1.5, 0.022))
		if (eighth === 4) this.bass(time, chord[0] - 12, beat * 1.2)

		if (eighth === 0 || eighth === 4 || (eighth === 5 && chance(0.3))) this.kick(time)
		if (eighth === 2 || eighth === 6) this.snare(time)
		this.hat(time, eighth % 2 === 0 ? 0.018 : 0.01)

		// изредка — короткая мелодия сверху
		if (chance(0.12)) this.keys(time, pick(PENTATONIC) + 12 + this.transpose, beat, 0.02)
	}

	private jazzStep(time: number, step: number) {
		const eighth = step % 8
		const chord = this.chordAt(step, 1)
		const beat = this.beat

		// Шагающий бас по четвертям: тоника, терция, квинта, проходящая нота
		if (eighth % 2 === 0) {
			const walk = [chord[0], chord[1], chord[2], chord[0] + (chance(0.5) ? 1 : -1)]
			this.bass(time, walk[eighth / 2] - 12, beat * 0.9, 0.1)
		}
		// Аккорды «вразнобой», как у пианиста в баре
		if (eighth === 0 || (eighth === 3 && chance(0.6)) || (eighth === 6 && chance(0.3)))
			chord.slice(1).forEach((note, i) => this.keys(time + i * 0.01, note, beat * 1.4, 0.035))
		// Щётки по малому барабану и райд
		this.noiseHit(time, 'bandpass', 4200, eighth % 2 === 0 ? 0.03 : 0.018, 0.16)
		if (eighth === 2 || eighth === 6) this.noiseHit(time, 'bandpass', 1700, 0.05, 0.12)
		if (chance(0.1)) this.keys(time, pick(PENTATONIC) + 12 + this.transpose, beat * 0.8, 0.025)
	}

	private pianoStep(time: number, step: number) {
		const chord = this.chordAt(step)
		const eighth = step % 8
		// Перебор: бас, затем ноты аккорда вверх-вниз
		const pattern = [0, 1, 2, 3, 2, 1, 2, 3]
		const note = eighth === 0 ? chord[0] - 12 : chord[pattern[eighth] % chord.length] + (eighth > 3 ? 12 : 0)
		this.piano(time, note, eighth === 0 ? 0.07 : 0.04)
		if (eighth === 4 && chance(0.35)) this.piano(time, pick(PENTATONIC) + 12 + this.transpose, 0.035)
	}

	private ambientStep(time: number, step: number) {
		if (step % 6 !== 0) return
		const note = pick(PENTATONIC) - 12 + this.transpose
		this.pad(time, note, 9)
		if (chance(0.4)) this.pad(time + 1.5, note + 7, 8)
	}

	private rainStep(time: number, step: number) {
		if (chance(step % 4 === 0 ? 0.35 : 0.08)) {
			const note = pick(PENTATONIC) + this.transpose
			this.piano(time, note)
			if (chance(0.3)) this.piano(time + 0.18, note - 12)
		}
		// далёкий гром — очень редко
		if (step % 64 === 32 && chance(0.25)) this.noiseHit(time, 'lowpass', 120, 0.25, 3.5)
	}

	private forestStep(time: number, step: number) {
		if (chance(0.06)) this.bird(time)
		if (step % 16 === 0) this.pad(time, pick(PENTATONIC) - 12 + this.transpose, 10, 0.02)
		if (step % 12 === 6 && chance(0.3)) this.piano(time, pick(PENTATONIC) + 12 + this.transpose, 0.025)
	}

	private spaceStep(time: number, step: number) {
		const chord = this.chordAt(step, 4)
		const sixteenth = step % 8
		// Мерцающее арпеджио, повторы уходят в эхо
		const note = chord[sixteenth % chord.length] + 12
		this.bell(time, note, sixteenth === 0 ? 0.04 : 0.022)
		if (step % 32 === 0) chord.forEach(item => this.pad(time, item - 12, 12, 0.022))
	}

	private fireStep(time: number, step: number) {
		// Треск поленьев
		if (chance(0.45)) this.noiseHit(time + Math.random() * 0.2, 'highpass', 2500 + Math.random() * 3000, 0.05 + Math.random() * 0.08, 0.03)
		if (chance(0.04)) this.noiseHit(time, 'bandpass', 900, 0.14, 0.08)
		// Неспешный перебор, как на гитаре
		const chord = this.chordAt(step)
		const eighth = step % 8
		if (eighth % 2 === 0 || chance(0.25)) {
			const note = eighth === 0 ? chord[0] : chord[1 + (eighth % (chord.length - 1))]
			this.pluck(time, note, eighth === 0 ? 0.07 : 0.045)
		}
	}

	/* ---------- Инструменты ---------- */

	private envelope(time: number, attack: number, peak: number, length: number) {
		const gain = this.ctx!.createGain()
		gain.gain.setValueAtTime(0, time)
		gain.gain.linearRampToValueAtTime(peak, time + attack)
		gain.gain.setTargetAtTime(0, time + length, length / 4)
		return gain
	}

	private keys(time: number, midi: number, length: number, peak: number) {
		const ctx = this.ctx!
		const env = this.envelope(time, 0.02, peak, length)
		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.frequency.value = 1500
		;['triangle', 'sine'].forEach((type, i) => {
			const osc = ctx.createOscillator()
			osc.type = type as OscillatorType
			osc.frequency.value = freq(midi + i * 12)
			osc.detune.value = (Math.random() - 0.5) * 8
			osc.connect(filter)
			osc.start(time)
			osc.stop(time + length * 2)
		})
		filter.connect(env).connect(this.bus!)
	}

	private bass(time: number, midi: number, length: number, peak = 0.12) {
		const osc = this.ctx!.createOscillator()
		osc.type = 'sine'
		osc.frequency.value = freq(midi)
		const env = this.envelope(time, 0.01, peak, length)
		osc.connect(env).connect(this.master!)
		osc.start(time)
		osc.stop(time + length * 2)
	}

	private kick(time: number) {
		const ctx = this.ctx!
		const osc = ctx.createOscillator()
		osc.frequency.setValueAtTime(120, time)
		osc.frequency.exponentialRampToValueAtTime(42, time + 0.14)
		const gain = ctx.createGain()
		gain.gain.setValueAtTime(0.32, time)
		gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3)
		osc.connect(gain).connect(this.master!)
		osc.start(time)
		osc.stop(time + 0.32)
	}

	private noiseHit(time: number, type: BiquadFilterType, frequency: number, peak: number, decay: number) {
		const ctx = this.ctx!
		const source = ctx.createBufferSource()
		source.buffer = this.noise
		const filter = ctx.createBiquadFilter()
		filter.type = type
		filter.frequency.value = frequency
		const gain = ctx.createGain()
		gain.gain.setValueAtTime(peak, time)
		gain.gain.exponentialRampToValueAtTime(0.0001, time + decay)
		source.connect(filter).connect(gain).connect(this.bus!)
		source.start(time, Math.random() * 3)
		source.stop(time + decay + 0.05)
	}

	private snare(time: number) {
		this.noiseHit(time, 'bandpass', 1900, 0.09, 0.2)
	}

	private hat(time: number, peak: number) {
		this.noiseHit(time, 'highpass', 7500, peak, 0.05)
	}

	private pad(time: number, midi: number, length: number, peak = 0.035) {
		const ctx = this.ctx!
		const env = this.envelope(time, length * 0.4, peak, length * 0.6)
		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.frequency.value = 900
		;[-6, 6].forEach(detune => {
			const osc = ctx.createOscillator()
			osc.type = 'sawtooth'
			osc.frequency.value = freq(midi)
			osc.detune.value = detune
			osc.connect(filter)
			osc.start(time)
			osc.stop(time + length * 1.6)
		})
		filter.connect(env).connect(this.bus!)
	}

	private piano(time: number, midi: number, peak = 0.06) {
		const ctx = this.ctx!
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, time)
		env.gain.linearRampToValueAtTime(peak, time + 0.005)
		env.gain.exponentialRampToValueAtTime(0.0001, time + 3.2)
		;[1, 2, 3].forEach((harmonic, i) => {
			const osc = ctx.createOscillator()
			osc.type = 'sine'
			osc.frequency.value = freq(midi) * harmonic
			const level = ctx.createGain()
			level.gain.value = [1, 0.25, 0.08][i]
			osc.connect(level).connect(env)
			osc.start(time)
			osc.stop(time + 3.3)
		})
		env.connect(this.bus!)
	}

	/** Колокольчик: чистый тон с призвуком, хвост уходит в эхо */
	private bell(time: number, midi: number, peak: number) {
		const ctx = this.ctx!
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, time)
		env.gain.linearRampToValueAtTime(peak, time + 0.004)
		env.gain.exponentialRampToValueAtTime(0.0001, time + 1.6)
		;[1, 2.76].forEach((ratio, i) => {
			const osc = ctx.createOscillator()
			osc.type = 'sine'
			osc.frequency.value = freq(midi) * ratio
			const level = ctx.createGain()
			level.gain.value = i ? 0.18 : 1
			osc.connect(level).connect(env)
			osc.start(time)
			osc.stop(time + 1.7)
		})
		env.connect(this.echo!)
	}

	/** Щипок струны: яркая атака, быстрое затухание и мягкий фильтр */
	private pluck(time: number, midi: number, peak: number) {
		const ctx = this.ctx!
		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.frequency.setValueAtTime(3200, time)
		filter.frequency.exponentialRampToValueAtTime(500, time + 0.6)
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, time)
		env.gain.linearRampToValueAtTime(peak, time + 0.003)
		env.gain.exponentialRampToValueAtTime(0.0001, time + 2)
		;['sawtooth', 'triangle'].forEach(type => {
			const osc = ctx.createOscillator()
			osc.type = type as OscillatorType
			osc.frequency.value = freq(midi)
			osc.detune.value = (Math.random() - 0.5) * 6
			osc.connect(filter)
			osc.start(time)
			osc.stop(time + 2.1)
		})
		filter.connect(env).connect(this.echo!)
	}

	/** Птичья трель: несколько коротких свистов с быстрым скольжением высоты */
	private bird(time: number) {
		const ctx = this.ctx!
		const base = 2200 + Math.random() * 1800
		const chirps = 2 + Math.floor(Math.random() * 4)
		for (let i = 0; i < chirps; i++) {
			const start = time + i * (0.09 + Math.random() * 0.05)
			const osc = ctx.createOscillator()
			osc.type = 'sine'
			osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), start)
			osc.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), start + 0.06)
			const env = ctx.createGain()
			env.gain.setValueAtTime(0, start)
			env.gain.linearRampToValueAtTime(0.018, start + 0.01)
			env.gain.exponentialRampToValueAtTime(0.0001, start + 0.08)
			osc.connect(env).connect(this.bus!)
			osc.start(start)
			osc.stop(start + 0.1)
		}
	}
}

export const ambientMusic = typeof window === 'undefined' ? null : new AmbientMusic()
