/**
 * Industrial Press Brake Sound FX Engine
 * Uses Native Web Audio API (Zero external MP3 dependencies, 0 kB bandwidth, zero latency).
 */

class SoundEngine {
  private ctx: AudioContext | null = null
  private isMuted: boolean = false
  private pumpOsc: OscillatorNode | null = null
  private pumpGain: GainNode | null = null

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AudioCtx) {
        this.ctx = new AudioCtx()
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted
    if (muted) {
      this.stopPumpHum()
    }
  }

  public getMuted(): boolean {
    return this.isMuted
  }

  /**
   * Ambient low-frequency hydraulic pump power unit hum
   */
  public startPumpHum() {
    if (this.isMuted) return
    this.initCtx()
    if (!this.ctx || this.pumpOsc) return

    try {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      const filter = this.ctx.createBiquadFilter()

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(58, this.ctx.currentTime) // 58 Hz power pack rumble

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(140, this.ctx.currentTime)

      gain.gain.setValueAtTime(0.001, this.ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.045, this.ctx.currentTime + 0.4)

      osc.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start()
      this.pumpOsc = osc
      this.pumpGain = gain
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public stopPumpHum() {
    if (!this.ctx || !this.pumpOsc || !this.pumpGain) return
    try {
      this.pumpGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.3)
      setTimeout(() => {
        if (this.pumpOsc) {
          try {
            this.pumpOsc.stop()
            this.pumpOsc.disconnect()
          } catch {}
          this.pumpOsc = null
          this.pumpGain = null
        }
      }, 350)
    } catch {
      this.pumpOsc = null
      this.pumpGain = null
    }
  }

  /**
   * Mechanical clamp / pinch contact clack
   */
  public playPinchClack() {
    if (this.isMuted) return
    this.initCtx()
    if (!this.ctx) return

    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, t)
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.08)

      gain.gain.setValueAtTime(0.12, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(t)
      osc.stop(t + 0.1)
    } catch {}
  }

  /**
   * Deep metallic forming resonance
   */
  public playFormingTone() {
    if (this.isMuted) return
    this.initCtx()
    if (!this.ctx) return

    try {
      const t = this.ctx.currentTime
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()

      osc.type = 'sine'
      osc.frequency.setValueAtTime(110, t)
      osc.frequency.linearRampToValueAtTime(75, t + 0.3)

      gain.gain.setValueAtTime(0.08, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)

      osc.connect(gain)
      gain.connect(this.ctx.destination)

      osc.start(t)
      osc.stop(t + 0.36)
    } catch {}
  }

  /**
   * Hydraulic decompression valve hiss on ram opening
   */
  public playDecompressHiss() {
    if (this.isMuted) return
    this.initCtx()
    if (!this.ctx) return

    try {
      const t = this.ctx.currentTime
      // Generate short white noise buffer
      const bufferSize = this.ctx.sampleRate * 0.18
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
      const data = buffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1
      }

      const noise = this.ctx.createBufferSource()
      noise.buffer = buffer

      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1800, t)
      filter.Q.setValueAtTime(3.0, t)

      const gain = this.ctx.createGain()
      gain.gain.setValueAtTime(0.06, t)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18)

      noise.connect(filter)
      filter.connect(gain)
      gain.connect(this.ctx.destination)

      noise.start(t)
    } catch {}
  }
}

export const soundEngine = new SoundEngine()
