import type { TypeMusicStyle } from './preferences'

/*
 * Фоновая музыка, которая генерируется прямо в браузере (Web Audio):
 * бесконечная, без файлов и лицензий, не тратит место в хранилище.
 *  — lofi:    аккорды электропиано, бас, мягкий бит со свингом, треск винила
 *  — ambient: медленные пэды с длинной реверберацией
 *  — rain:    шум дождя и редкие ноты пианино
 */

const BPM = 72
const BEAT = 60 / BPM

// Fmaj7 → Em7 → Dm7 → Cmaj7, по два такта на аккорд
const PROGRESSION = [
	[53, 57, 60, 64],
	[52, 55, 59, 62],
	[50, 53, 57, 60],
	[48, 52, 55, 59]
]
const PENTATONIC = [60, 62, 64, 67, 69, 72, 74, 76]

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12)

class AmbientMusic {
	private ctx: AudioContext | null = null
	private master: GainNode | null = null
	private bus: GainNode | null = null
	private reverb: ConvolverNode | null = null
	private noise: AudioBuffer | null = null
	private loops: AudioScheduledSourceNode[] = []
	private timer: ReturnType<typeof setInterval> | null = null
	private nextTime = 0
	private step = 0

	private style: TypeMusicStyle = 'lofi'
	private volume = 0.35
	private enabled = false
	private ducked = false
	private started = false

	/** Применить настройки. Сам звук стартует только после жеста пользователя (правило браузеров). */
	configure({ enabled, style, volume }: { enabled: boolean; style: TypeMusicStyle; volume: number }) {
		const styleChanged = style !== this.style
		this.enabled = enabled
		this.style = style
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
		this.nextTime = this.ctx.currentTime + 0.1
		this.step = 0
		this.startLoops()
		this.timer = setInterval(() => this.schedule(), 60)
		this.applyVolume(1.5)
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

	/* ---------- Постоянные слои: треск винила, дождь ---------- */

	private startLoops() {
		const ctx = this.ctx!
		if (this.style === 'lofi' || this.style === 'rain') {
			const source = ctx.createBufferSource()
			source.buffer = this.noise
			source.loop = true
			const filter = ctx.createBiquadFilter()
			const gain = ctx.createGain()
			if (this.style === 'lofi') {
				filter.type = 'bandpass'
				filter.frequency.value = 3200
				filter.Q.value = 0.6
				gain.gain.value = 0.025
			} else {
				filter.type = 'highpass'
				filter.frequency.value = 900
				gain.gain.value = 0.16
			}
			source.connect(filter).connect(gain).connect(this.master!)
			source.start()
			this.loops.push(source)
		}
		if (this.style === 'ambient') {
			// низкий тихий бурдон под пэдами
			const drone = ctx.createOscillator()
			drone.type = 'sine'
			drone.frequency.value = freq(36)
			const gain = ctx.createGain()
			gain.gain.value = 0.05
			drone.connect(gain).connect(this.bus!)
			drone.start()
			this.loops.push(drone)
		}
	}

	/* ---------- Планировщик событий (смотрит на 0,4 с вперёд) ---------- */

	private schedule() {
		const ctx = this.ctx
		if (!ctx) return
		while (this.nextTime < ctx.currentTime + 0.4) {
			if (this.style === 'lofi') this.lofiStep(this.nextTime, this.step)
			else if (this.style === 'ambient') this.ambientStep(this.nextTime, this.step)
			else this.rainStep(this.nextTime, this.step)
			// восьмые доли со свингом
			this.nextTime += (BEAT / 2) * (this.step % 2 === 0 ? 1.12 : 0.88)
			this.step++
		}
	}

	private lofiStep(time: number, step: number) {
		const eighth = step % 8
		const bar = Math.floor(step / 8)
		const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length]

		if (eighth === 0) {
			chord.forEach((note, i) => this.keys(time + i * 0.012, note, BEAT * 4, 0.05))
			this.bass(time, chord[0] - 12, BEAT * 1.6)
		}
		if (eighth === 5 && Math.random() < 0.5)
			chord.slice(1).forEach(note => this.keys(time, note + 12, BEAT * 1.5, 0.022))
		if (eighth === 4) this.bass(time, chord[0] - 12, BEAT * 1.2)

		if (eighth === 0 || eighth === 4 || (eighth === 5 && Math.random() < 0.3)) this.kick(time)
		if (eighth === 2 || eighth === 6) this.snare(time)
		this.hat(time, eighth % 2 === 0 ? 0.018 : 0.01)

		// изредка — короткая мелодия сверху
		if (Math.random() < 0.12)
			this.keys(time, PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] + 12, BEAT, 0.02)
	}

	private ambientStep(time: number, step: number) {
		if (step % 6 !== 0) return
		const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)] - 12
		this.pad(time, note, 9)
		if (Math.random() < 0.4) this.pad(time + 1.5, note + 7, 8)
	}

	private rainStep(time: number, step: number) {
		if (Math.random() < (step % 4 === 0 ? 0.35 : 0.08)) {
			const note = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]
			this.piano(time, note)
			if (Math.random() < 0.3) this.piano(time + 0.18, note - 12)
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

	private bass(time: number, midi: number, length: number) {
		const osc = this.ctx!.createOscillator()
		osc.type = 'sine'
		osc.frequency.value = freq(midi)
		const env = this.envelope(time, 0.01, 0.12, length)
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

	private pad(time: number, midi: number, length: number) {
		const ctx = this.ctx!
		const env = this.envelope(time, length * 0.4, 0.035, length * 0.6)
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

	private piano(time: number, midi: number) {
		const ctx = this.ctx!
		const env = ctx.createGain()
		env.gain.setValueAtTime(0, time)
		env.gain.linearRampToValueAtTime(0.06, time + 0.005)
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
}

export const ambientMusic = typeof window === 'undefined' ? null : new AmbientMusic()
