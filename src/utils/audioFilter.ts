import { VoiceFilterType } from '../types/camera';

export class VoiceFilterProcessor {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private mixBus: GainNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private currentFilter: VoiceFilterType = 'normal';
  private nodes: AudioNode[] = [];

  constructor() {}

  public init(mediaStream: MediaStream): MediaStreamTrack | null {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) return null;

      this.sourceNode = this.audioCtx.createMediaStreamSource(mediaStream);
      this.mixBus = this.audioCtx.createGain();
      this.mixBus.gain.value = 1.0;
      this.destinationNode = this.audioCtx.createMediaStreamDestination();

      // Connect mixBus into the destination stream
      this.mixBus.connect(this.destinationNode);

      this.applyFilter(this.currentFilter);
      return this.destinationNode.stream.getAudioTracks()[0];
    } catch (e) {
      console.error('Failed to initialize AudioContext filter:', e);
      return mediaStream.getAudioTracks()[0] || null;
    }
  }

  public getAudioContext(): AudioContext | null {
    return this.audioCtx;
  }

  public getMixBus(): GainNode | null {
    return this.mixBus;
  }

  public getDestinationNode(): MediaStreamAudioDestinationNode | null {
    return this.destinationNode;
  }

  public applyFilter(filter: VoiceFilterType) {
    this.currentFilter = filter;
    if (!this.audioCtx || !this.sourceNode || !this.mixBus) return;

    // Disconnect existing nodes
    try {
      this.sourceNode.disconnect();
      for (const node of this.nodes) {
        node.disconnect();
      }
    } catch (e) {
      // ignore
    }
    this.nodes = [];

    const ctx = this.audioCtx;

    if (filter === 'normal') {
      this.sourceNode.connect(this.mixBus);
      return;
    }

    if (filter === 'deep') {
      // Deep Voice: Lowpass filter + bass boost
      const lowpass = ctx.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 600;

      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf';
      bass.frequency.value = 250;
      bass.gain.value = 12;

      this.sourceNode.connect(lowpass);
      lowpass.connect(bass);
      bass.connect(this.mixBus);
      this.nodes = [lowpass, bass];
      return;
    }

    if (filter === 'high') {
      // High Pitch: Highpass filter + peak frequency boost
      const highpass = ctx.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 1000;

      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 2500;
      peak.gain.value = 14;

      this.sourceNode.connect(highpass);
      highpass.connect(peak);
      peak.connect(this.mixBus);
      this.nodes = [highpass, peak];
      return;
    }

    if (filter === 'robot') {
      // Robot Voice: Ring modulation via oscillator + wave shaper
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 75; // 75Hz robotic carrier

      const modGain = ctx.createGain();
      modGain.gain.value = 0.5;

      const merger = ctx.createGain();
      merger.gain.value = 0.8;

      osc.connect(modGain.gain);
      this.sourceNode.connect(modGain);
      modGain.connect(merger);
      merger.connect(this.mixBus);

      osc.start();
      this.nodes = [osc, modGain, merger];
      return;
    }

    if (filter === 'radio') {
      // Walkie Talkie / Radio: Narrow bandpass filter (telephone effect)
      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.value = 1800;
      bandpass.Q.value = 1.8;

      const drive = ctx.createWaveShaper();
      drive.curve = this.makeDistortionCurve(15);

      this.sourceNode.connect(bandpass);
      bandpass.connect(drive);
      drive.connect(this.mixBus);
      this.nodes = [bandpass, drive];
      return;
    }

    if (filter === 'echo') {
      // Echo / Reverb: Delay + Feedback
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.28; // 280ms echo

      const feedback = ctx.createGain();
      feedback.gain.value = 0.45;

      const dryGain = ctx.createGain();
      dryGain.gain.value = 1.0;

      this.sourceNode.connect(dryGain);
      dryGain.connect(this.mixBus);

      this.sourceNode.connect(delay);
      delay.connect(feedback);
      feedback.connect(delay);
      delay.connect(this.mixBus);

      this.nodes = [delay, feedback, dryGain];
      return;
    }

    // Default fallback
    this.sourceNode.connect(this.mixBus);
  }

  private makeDistortionCurve(amount: number): Float32Array {
    const k = typeof amount === 'number' ? amount : 50;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public cleanup() {
    try {
      if (this.sourceNode) this.sourceNode.disconnect();
      for (const node of this.nodes) {
        node.disconnect();
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.close();
      }
    } catch (e) {
      // ignore
    }
    this.audioCtx = null;
    this.sourceNode = null;
    this.destinationNode = null;
    this.nodes = [];
  }
}
