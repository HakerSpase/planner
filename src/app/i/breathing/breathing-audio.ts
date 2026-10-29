import type {
	BreathingPhaseType,
	CueStyleType,
	SoundscapeType
} from './breathing.types'

class BreathingAudioManager {
	private audioContext: AudioContext | null = null
	private keepAliveOsc: OscillatorNode | null = null
	private keepAliveGain: GainNode | null = null
	private wakeLockSentinel: any = null

	// Soundscape state & audio nodes
	private soundscapeType: SoundscapeType = 'none'
	private soundscapeVolume: number = 0.45
	private soundscapeMasterGain: GainNode | null = null
	private soundscapeActiveNodes: (AudioNode | OscillatorNode | AudioBufferSourceNode)[] = []
	private isSoundscapePlaying: boolean = false

	// Cues state
	private cueStyle: CueStyleType = 'tibetan'
	private cueVolume: number = 0.65

	// Cached noise buffers
	private pinkNoiseBuffer: AudioBuffer | null = null
	private brownNoiseBuffer: AudioBuffer | null = null

	private getContext(): AudioContext | null {
		if (typeof window === 'undefined') return null
		if (!this.audioContext) {
			const AudioContextClass =
				window.AudioContext || (window as any).webkitAudioContext
			if (AudioContextClass) {
				this.audioContext = new AudioContextClass()
			}
		}
		if (this.audioContext && this.audioContext.state === 'suspended') {
			this.audioContext.resume().catch(() => {})
		}
		return this.audioContext
	}

	// --------------------------------------------------------------------------
	// Mobile WakeLock & Audio Session Keep-Alive
	// --------------------------------------------------------------------------
	startBackgroundKeepAlive() {
		try {
			const ctx = this.getContext()
			if (!ctx) return
			if (this.keepAliveOsc) return

			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.frequency.setValueAtTime(40, ctx.currentTime)
			gain.gain.setValueAtTime(0.0001, ctx.currentTime)

			osc.connect(gain)
			gain.connect(ctx.destination)
			osc.start()

			this.keepAliveOsc = osc
			this.keepAliveGain = gain
		} catch {}
	}

	stopBackgroundKeepAlive() {
		try {
			if (this.keepAliveOsc) {
				this.keepAliveOsc.stop()
				this.keepAliveOsc.disconnect()
				this.keepAliveOsc = null
			}
			if (this.keepAliveGain) {
				this.keepAliveGain.disconnect()
				this.keepAliveGain = null
			}
		} catch {}
	}

	async requestWakeLock() {
		if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
			try {
				this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
			} catch {}
		}
	}

	releaseWakeLock() {
		if (this.wakeLockSentinel) {
			try {
				this.wakeLockSentinel.release().catch(() => {})
			} catch {}
			this.wakeLockSentinel = null
		}
	}

	// --------------------------------------------------------------------------
	// Haptic Feedback (Vibration)
	// --------------------------------------------------------------------------
	vibrate(type: BreathingPhaseType) {
		if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
		try {
			switch (type) {
				case 'inhale':
					navigator.vibrate([60])
					break
				case 'holdIn':
					navigator.vibrate([35, 45, 35])
					break
				case 'exhale':
					navigator.vibrate([80])
					break
				case 'holdOut':
					navigator.vibrate([30, 40, 30])
					break
			}
		} catch {}
	}

	// --------------------------------------------------------------------------
	// Phase Cues (Tibetan Bowl / Harmonic Bell / Soft Tone)
	// --------------------------------------------------------------------------
	setCueStyle(style: CueStyleType) {
		this.cueStyle = style
	}

	setCueVolume(vol: number) {
		this.cueVolume = Math.max(0, Math.min(1, vol))
	}

	playTone(type: BreathingPhaseType) {
		if (this.cueStyle === 'none' || this.cueVolume <= 0) return

		try {
			const ctx = this.getContext()
			if (!ctx) return

			if (this.cueStyle === 'tibetan') {
				this.playTibetanBowl(ctx, type)
			} else if (this.cueStyle === 'bell') {
				this.playHarmonicBell(ctx, type)
			} else {
				this.playSoftSine(ctx, type)
			}
		} catch {}
	}

	private playTibetanBowl(ctx: AudioContext, type: BreathingPhaseType) {
		const now = ctx.currentTime
		let rootFreq = 216 // Inhale (warm grounding F3/A3)
		let duration = 3.2

		switch (type) {
			case 'inhale':
				rootFreq = 216
				duration = 3.2
				break
			case 'holdIn':
				rootFreq = 270 // Higher octave peaceful hold
				duration = 2.8
				break
			case 'exhale':
				rootFreq = 180 // Deep settling resonance
				duration = 3.6
				break
			case 'holdOut':
				rootFreq = 198
				duration = 2.8
				break
		}

		const master = ctx.createGain()
		master.gain.setValueAtTime(0.0001, now)
		master.gain.exponentialRampToValueAtTime(0.25 * this.cueVolume, now + 0.05)
		master.gain.exponentialRampToValueAtTime(0.0001, now + duration)
		master.connect(ctx.destination)

		// 1. Root tone
		const osc1 = ctx.createOscillator()
		osc1.type = 'sine'
		osc1.frequency.setValueAtTime(rootFreq, now)
		osc1.connect(master)
		osc1.start(now)
		osc1.stop(now + duration)

		// 2. Detuned pair (+1.2 Hz) for singing bowl chorus shimmer
		const osc1Detune = ctx.createOscillator()
		osc1Detune.type = 'sine'
		osc1Detune.frequency.setValueAtTime(rootFreq + 1.2, now)
		const gainDetune = ctx.createGain()
		gainDetune.gain.setValueAtTime(0.5, now)
		osc1Detune.connect(gainDetune)
		gainDetune.connect(master)
		osc1Detune.start(now)
		osc1Detune.stop(now + duration)

		// 3. 2nd Harmonic (~2.76x)
		const osc2 = ctx.createOscillator()
		osc2.type = 'sine'
		osc2.frequency.setValueAtTime(rootFreq * 2.76, now)
		const gain2 = ctx.createGain()
		gain2.gain.setValueAtTime(0.3, now)
		gain2.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.7)
		osc2.connect(gain2)
		gain2.connect(master)
		osc2.start(now)
		osc2.stop(now + duration)

		// 4. 3rd Harmonic (~5.4x)
		const osc3 = ctx.createOscillator()
		osc3.type = 'sine'
		osc3.frequency.setValueAtTime(rootFreq * 5.4, now)
		const gain3 = ctx.createGain()
		gain3.gain.setValueAtTime(0.12, now)
		gain3.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.4)
		osc3.connect(gain3)
		gain3.connect(master)
		osc3.start(now)
		osc3.stop(now + duration)
	}

	private playHarmonicBell(ctx: AudioContext, type: BreathingPhaseType) {
		const now = ctx.currentTime
		let freq = 528 // Solfeggio frequency for transformation & peace
		let duration = 2.2

		if (type === 'exhale') freq = 432
		if (type === 'holdIn') freq = 639
		if (type === 'holdOut') freq = 396

		const master = ctx.createGain()
		master.gain.setValueAtTime(0.0001, now)
		master.gain.exponentialRampToValueAtTime(0.22 * this.cueVolume, now + 0.02)
		master.gain.exponentialRampToValueAtTime(0.0001, now + duration)
		master.connect(ctx.destination)

		const osc1 = ctx.createOscillator()
		osc1.type = 'sine'
		osc1.frequency.setValueAtTime(freq, now)
		osc1.connect(master)
		osc1.start(now)
		osc1.stop(now + duration)

		const osc2 = ctx.createOscillator()
		osc2.type = 'sine'
		osc2.frequency.setValueAtTime(freq * 2, now)
		const gain2 = ctx.createGain()
		gain2.gain.setValueAtTime(0.2, now)
		osc2.connect(gain2)
		gain2.connect(master)
		osc2.start(now)
		osc2.stop(now + duration)
	}

	private playSoftSine(ctx: AudioContext, type: BreathingPhaseType) {
		const now = ctx.currentTime
		let freq = 432
		const duration = 1.6

		if (type === 'holdIn') freq = 576
		if (type === 'exhale') freq = 324
		if (type === 'holdOut') freq = 384

		const osc = ctx.createOscillator()
		const gain = ctx.createGain()

		osc.type = 'sine'
		osc.frequency.setValueAtTime(freq, now)

		gain.gain.setValueAtTime(0.0001, now)
		gain.gain.exponentialRampToValueAtTime(0.18 * this.cueVolume, now + 0.06)
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

		osc.connect(gain)
		gain.connect(ctx.destination)

		osc.start(now)
		osc.stop(now + duration)
	}

	// --------------------------------------------------------------------------
	// Soundscapes (Ambient Noise Generators: Rain, Waves, Forest, Brown Noise)
	// --------------------------------------------------------------------------
	setSoundscape(type: SoundscapeType) {
		this.soundscapeType = type
		if (this.isSoundscapePlaying) {
			this.restartSoundscape()
		}
	}

	setSoundscapeVolume(vol: number) {
		this.soundscapeVolume = Math.max(0, Math.min(1, vol))
		if (this.soundscapeMasterGain && this.audioContext) {
			this.soundscapeMasterGain.gain.setTargetAtTime(
				this.soundscapeVolume,
				this.audioContext.currentTime,
				0.08
			)
		}
	}

	startSoundscape() {
		if (this.soundscapeType === 'none') return
		const ctx = this.getContext()
		if (!ctx) return

		this.stopSoundscapeNodes()

		const masterGain = ctx.createGain()
		masterGain.gain.setValueAtTime(0.0001, ctx.currentTime)
		masterGain.gain.setTargetAtTime(this.soundscapeVolume, ctx.currentTime, 0.4)
		masterGain.connect(ctx.destination)
		this.soundscapeMasterGain = masterGain

		switch (this.soundscapeType) {
			case 'rain':
				this.createRainSoundscape(ctx, masterGain)
				break
			case 'waves':
				this.createWavesSoundscape(ctx, masterGain)
				break
			case 'forest':
				this.createForestSoundscape(ctx, masterGain)
				break
			case 'brown_noise':
				this.createBrownNoiseSoundscape(ctx, masterGain)
				break
		}

		this.isSoundscapePlaying = true
	}

	stopSoundscape() {
		this.isSoundscapePlaying = false
		if (this.soundscapeMasterGain && this.audioContext) {
			const now = this.audioContext.currentTime
			this.soundscapeMasterGain.gain.setTargetAtTime(0.0001, now, 0.3)
			setTimeout(() => {
				this.stopSoundscapeNodes()
			}, 350)
		} else {
			this.stopSoundscapeNodes()
		}
	}

	/** Полная остановка: фон, «удержание» вкладки, блокировка экрана и сам аудиоконтекст */
	shutdown() {
		this.isSoundscapePlaying = false
		this.stopSoundscapeNodes()
		this.stopBackgroundKeepAlive()
		this.releaseWakeLock()
		if (this.audioContext) {
			this.audioContext.close().catch(() => {})
			this.audioContext = null
			this.pinkNoiseBuffer = null
			this.brownNoiseBuffer = null
		}
	}

	private restartSoundscape() {
		if (this.soundscapeType === 'none') {
			this.stopSoundscape()
		} else {
			this.startSoundscape()
		}
	}

	private stopSoundscapeNodes() {
		for (const node of this.soundscapeActiveNodes) {
			try {
				if ('stop' in node && typeof (node as any).stop === 'function') {
					;(node as any).stop()
				}
				node.disconnect()
			} catch {}
		}
		this.soundscapeActiveNodes = []
		if (this.soundscapeMasterGain) {
			try {
				this.soundscapeMasterGain.disconnect()
			} catch {}
			this.soundscapeMasterGain = null
		}
	}

	// 1. Rain: Bandpass-filtered Pink Noise + Subtle Highpass
	private createRainSoundscape(ctx: AudioContext, dest: AudioNode) {
		const source = this.createNoiseSource(ctx, 'pink')

		const filter = ctx.createBiquadFilter()
		filter.type = 'bandpass'
		filter.frequency.setValueAtTime(750, ctx.currentTime)
		filter.Q.setValueAtTime(0.7, ctx.currentTime)

		const highpass = ctx.createBiquadFilter()
		highpass.type = 'highpass'
		highpass.frequency.setValueAtTime(220, ctx.currentTime)

		const rainGain = ctx.createGain()
		rainGain.gain.setValueAtTime(0.7, ctx.currentTime)

		source.connect(filter)
		filter.connect(highpass)
		highpass.connect(rainGain)
		rainGain.connect(dest)

		source.start(0)
		this.soundscapeActiveNodes.push(source, filter, highpass, rainGain)
	}

	// 2. Waves: Lowpassed Brown Noise modulated with a slow LFO swell (10-12s cycle)
	private createWavesSoundscape(ctx: AudioContext, dest: AudioNode) {
		const source = this.createNoiseSource(ctx, 'brown')

		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.frequency.setValueAtTime(360, ctx.currentTime)

		const waveGain = ctx.createGain()
		waveGain.gain.setValueAtTime(0.3, ctx.currentTime)

		// LFO for wave swelling
		const lfo = ctx.createOscillator()
		lfo.type = 'sine'
		lfo.frequency.setValueAtTime(0.085, ctx.currentTime) // ~11.7s per wave cycle

		const lfoGain = ctx.createGain()
		lfoGain.gain.setValueAtTime(0.35, ctx.currentTime) // Modulation depth

		lfo.connect(lfoGain)
		lfoGain.connect(waveGain.gain)

		source.connect(filter)
		filter.connect(waveGain)
		waveGain.connect(dest)

		lfo.start(0)
		source.start(0)

		this.soundscapeActiveNodes.push(source, filter, waveGain, lfo, lfoGain)
	}

	// 3. Forest: Filtered noise with dual sweeping resonant breeze
	private createForestSoundscape(ctx: AudioContext, dest: AudioNode) {
		const source = this.createNoiseSource(ctx, 'pink')

		const filter1 = ctx.createBiquadFilter()
		filter1.type = 'bandpass'
		filter1.frequency.setValueAtTime(450, ctx.currentTime)
		filter1.Q.setValueAtTime(1.2, ctx.currentTime)

		// Gentle breeze sweep
		const lfo = ctx.createOscillator()
		lfo.type = 'sine'
		lfo.frequency.setValueAtTime(0.12, ctx.currentTime)

		const lfoGain = ctx.createGain()
		lfoGain.gain.setValueAtTime(180, ctx.currentTime) // Sweeps freq +/- 180Hz

		lfo.connect(lfoGain)
		lfoGain.connect(filter1.frequency)

		const forestGain = ctx.createGain()
		forestGain.gain.setValueAtTime(0.65, ctx.currentTime)

		source.connect(filter1)
		filter1.connect(forestGain)
		forestGain.connect(dest)

		lfo.start(0)
		source.start(0)

		this.soundscapeActiveNodes.push(source, filter1, forestGain, lfo, lfoGain)
	}

	// 4. Brown Noise: Deep, warm, soothing noise
	private createBrownNoiseSoundscape(ctx: AudioContext, dest: AudioNode) {
		const source = this.createNoiseSource(ctx, 'brown')

		const filter = ctx.createBiquadFilter()
		filter.type = 'lowpass'
		filter.frequency.setValueAtTime(500, ctx.currentTime)

		const gain = ctx.createGain()
		gain.gain.setValueAtTime(0.8, ctx.currentTime)

		source.connect(filter)
		filter.connect(gain)
		gain.connect(dest)

		source.start(0)
		this.soundscapeActiveNodes.push(source, filter, gain)
	}

	// --------------------------------------------------------------------------
	// Noise Buffer Generation (Pink & Brown)
	// --------------------------------------------------------------------------
	private createNoiseSource(
		ctx: AudioContext,
		type: 'pink' | 'brown'
	): AudioBufferSourceNode {
		const buffer =
			type === 'pink'
				? this.getPinkNoiseBuffer(ctx)
				: this.getBrownNoiseBuffer(ctx)

		const source = ctx.createBufferSource()
		source.buffer = buffer
		source.loop = true
		return source
	}

	private getPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
		if (this.pinkNoiseBuffer) return this.pinkNoiseBuffer

		const bufferSize = ctx.sampleRate * 5 // 5 seconds looped
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
		const data = buffer.getChannelData(0)

		let b0 = 0,
			b1 = 0,
			b2 = 0,
			b3 = 0,
			b4 = 0,
			b5 = 0,
			b6 = 0

		for (let i = 0; i < bufferSize; i++) {
			const white = Math.random() * 2 - 1
			b0 = 0.99886 * b0 + white * 0.0555179
			b1 = 0.99332 * b1 + white * 0.0750759
			b2 = 0.969 * b2 + white * 0.153852
			b3 = 0.8665 * b3 + white * 0.3104856
			b4 = 0.55 * b4 + white * 0.5329522
			b5 = -0.7616 * b5 - white * 0.016898
			data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08
			b6 = white * 0.115926
		}

		this.pinkNoiseBuffer = buffer
		return buffer
	}

	private getBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
		if (this.brownNoiseBuffer) return this.brownNoiseBuffer

		const bufferSize = ctx.sampleRate * 5
		const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
		const data = buffer.getChannelData(0)

		let lastOut = 0.0
		for (let i = 0; i < bufferSize; i++) {
			const white = Math.random() * 2 - 1
			data[i] = (lastOut + 0.02 * white) / 1.02
			lastOut = data[i]
			data[i] *= 2.8 // scale volume
		}

		this.brownNoiseBuffer = buffer
		return buffer
	}
}

export const breathingAudio = new BreathingAudioManager()
