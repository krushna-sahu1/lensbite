/**
 * AudioWorklet that turns microphone audio into 16-bit PCM at 16 kHz,
 * which is the input format the Gemini Live API expects.
 *
 * The AudioContext runs at the device's native rate (usually 44.1 or 48 kHz),
 * so we downsample here by averaging the input samples that fall into each
 * output sample (a simple box filter, which also reduces aliasing).
 *
 * Every `chunkSize` output samples (100 ms by default) we post
 * { pcm: ArrayBuffer(Int16), rms: number } to the main thread.
 */
class PcmRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { targetRate = 16000, chunkSize = 1600 } = options.processorOptions || {};
    // `sampleRate` is a global in the AudioWorklet scope.
    this.ratio = Math.max(1, sampleRate / targetRate);
    this.chunkSize = chunkSize;
    this.buf = new Int16Array(chunkSize);
    this.n = 0;
    this.acc = 0; // running sum of input samples for the current output sample
    this.count = 0;
    this.t = 0; // input samples consumed since the last output sample
    this.sumSq = 0; // for the RMS level meter
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      this.acc += channel[i];
      this.count++;
      this.t += 1;
      if (this.t >= this.ratio) {
        this.t -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.acc / this.count));
        this.acc = 0;
        this.count = 0;
        this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.sumSq += s * s;

        if (this.n === this.chunkSize) {
          const rms = Math.sqrt(this.sumSq / this.n);
          this.port.postMessage({ pcm: this.buf.buffer, rms }, [this.buf.buffer]);
          this.buf = new Int16Array(this.chunkSize);
          this.n = 0;
          this.sumSq = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorder);
