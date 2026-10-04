import { readFileSync } from 'node:fs';
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';
import { detectEnglishOrFrench } from '../src/lib/whisper-language';
import { ASR_MODEL } from '../src/lib/models';

function readWav16kMono(path: string): Float32Array {
  const buf = readFileSync(path);
  let offset = 12;
  while (offset < buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === 'data') {
      const pcm = new Int16Array(buf.buffer, buf.byteOffset + offset + 8, size / 2);
      return Float32Array.from(pcm, (s) => s / 32768);
    }
    offset += 8 + size;
  }
  throw new Error('no data chunk');
}

const asr = (await pipeline('automatic-speech-recognition', ASR_MODEL.id, {
  dtype: ASR_MODEL.dtype,
})) as AutomaticSpeechRecognitionPipeline;

for (const file of process.argv.slice(2)) {
  const audio = readWav16kMono(file);
  const lang = await detectEnglishOrFrench(asr, audio, 16000);
  const out = await asr(audio, { language: lang === 'fr' ? 'french' : 'english', task: 'transcribe' });
  console.log(file, '->', lang, '|', Array.isArray(out) ? out[0].text : out.text);
}
