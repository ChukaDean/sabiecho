import { Tensor, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

interface WhisperGenerationConfig {
  decoder_start_token_id: number;
  lang_to_id: Record<string, number>;
}

/**
 * Whisper in Transformers.js does not auto-detect the language (it falls back to English),
 * so we compare the model's first-token probabilities for <|en|> and <|fr|> ourselves.
 */
export async function detectEnglishOrFrench(
  asr: AutomaticSpeechRecognitionPipeline,
  audio: Float32Array,
  sampleRate: number,
): Promise<'en' | 'fr'> {
  const config = asr.model.generation_config as unknown as WhisperGenerationConfig;
  const { input_features } = await asr.processor(audio.subarray(0, 30 * sampleRate));
  const decoder_input_ids = new Tensor('int64', BigInt64Array.from([BigInt(config.decoder_start_token_id)]), [1, 1]);
  const { logits } = (await asr.model({ input_features, decoder_input_ids })) as { logits: Tensor };
  const data = logits.data as Float32Array;
  const vocab = logits.dims.at(-1)!;
  const last = data.subarray(data.length - vocab);
  return last[config.lang_to_id['<|fr|>']] > last[config.lang_to_id['<|en|>']] ? 'fr' : 'en';
}
