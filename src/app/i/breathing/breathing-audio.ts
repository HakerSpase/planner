import type { BreathingPhaseType } from './breathing.types'

class BreathingAudioManager {
	private audioContext: AudioContext | null = null
	private keepAliveOsc: OscillatorNode | null = null
	private keepAliveGain: GainNode | null = null
	private wakeLockSentinel: any = null

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

	startBackgroundKeepAlive() {
		try {
			const ctx = this.getContext()
			if (!ctx) return
			if (this.keepAliveOsc) return

			// Create a near-silent node to keep mobile browser audio session active with screen off
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()
			osc.frequency.setValueAtTime(40, ctx.currentTime)
			gain.gain.setValueAtTime(0.0001, ctx.currentTime) // Inaudible keep-alive

			osc.connect(gain)
			gain.connect(ctx.destination)
			osc.start()

			this.keepAliveOsc = osc
			this.keepAliveGain = gain
		} catch {
			// Ignore unsupported environments
		}
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

	vibrate(type: BreathingPhaseType) {
		if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return
		try {
			switch (type) {
				case 'inhale':
					navigator.vibrate([55])
					break
				case 'holdIn':
					navigator.vibrate([35, 45, 35])
					break
				case 'exhale':
					navigator.vibrate([75])
					break
				case 'holdOut':
					navigator.vibrate([30, 40, 30])
					break
			}
		} catch {}
	}

	playTone(type: BreathingPhaseType) {
		try {
			const ctx = this.getContext()
			if (!ctx) return

			const now = ctx.currentTime
			const osc = ctx.createOscillator()
			const gain = ctx.createGain()

			let freq = 432
			let duration = 1.6

			switch (type) {
				case 'inhale':
					freq = 432 // Meditative A
					duration = 1.8
					break
				case 'holdIn':
					freq = 576 // Calm upper harmony
					duration = 1.4
					break
				case 'exhale':
					freq = 324 // Deep grounding frequency
					duration = 2.0
					break
				case 'holdOut':
					freq = 384 // Balance tone
					duration = 1.4
					break
			}

			osc.type = 'sine'
			osc.frequency.setValueAtTime(freq, now)

			// Gentle bell envelope: soft attack, exponential peaceful decay
			gain.gain.setValueAtTime(0.0001, now)
			gain.gain.exponentialRampToValueAtTime(0.12, now + 0.08)
			gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)

			osc.connect(gain)
			gain.connect(ctx.destination)

			osc.start(now)
			osc.stop(now + duration)
		} catch {}
	}
}

export const breathingAudio = new BreathingAudioManager()
