export const EMBEDDING_MODEL = {
  id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
  dtype: 'q8',
  approxMB: 118,
} as const;

export const ASR_MODEL = {
  id: 'onnx-community/whisper-base',
  dtype: { encoder_model: 'q8', decoder_model_merged: 'q8' },
  approxMB: 77,
} as const;
