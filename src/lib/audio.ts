const WHISPER_SAMPLE_RATE = 16000;

/** Decodes any browser-supported audio file to 16 kHz mono samples for Whisper. */
export async function decodeForWhisper(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer();
  const ctx = new AudioContext({ sampleRate: WHISPER_SAMPLE_RATE });
  try {
    const decoded = await ctx.decodeAudioData(bytes);
    if (decoded.numberOfChannels === 1) return decoded.getChannelData(0).slice();
    const mono = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const data = decoded.getChannelData(c);
      for (let i = 0; i < data.length; i++) mono[i] += data[i] / decoded.numberOfChannels;
    }
    return mono;
  } finally {
    void ctx.close();
  }
}

export class Recorder {
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.recorder = new MediaRecorder(stream);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start();
  }

  stop(): Promise<Blob> {
    const rec = this.recorder;
    if (!rec) return Promise.reject(new Error('Not recording'));
    return new Promise((resolve) => {
      rec.onstop = () => {
        rec.stream.getTracks().forEach((t) => t.stop());
        this.recorder = null;
        resolve(new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' }));
      };
      rec.stop();
    });
  }
}
