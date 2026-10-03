// Gemma 3 1B in a worker: the game keeps its frame rate while a character thinks.
// Streams text back token by token; the main thread checks safety and can stop it mid-sentence.
const MODEL = 'onnx-community/gemma-3-1b-it-ONNX'
let T, gen
const stops = new Map()

self.onmessage = async (e) => {
  const m = e.data
  try {
    if (m.type === 'init') await init(m)
    else if (m.type === 'generate') await generate(m)
    else if (m.type === 'stop') stops.get(m.id)?.interrupt()
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) })
  }
}

async function init({ tjs, local }) {
  T = await import(tjs)
  if (local) {
    T.env.allowRemoteModels = false
    T.env.allowLocalModels = true
    T.env.localModelPath = '/models/'
    T.env.useBrowserCache = false
    T.env.backends.onnx.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/'
  } else {
    T.env.allowLocalModels = false
  }
  gen = await T.pipeline('text-generation', MODEL, {
    device: 'webgpu', dtype: 'q4f16',
    progress_callback: (p) => self.postMessage({ type: 'progress', p }),
  })
  self.postMessage({ type: 'ready' })
}

async function generate({ id, messages, maxTokens }) {
  const stop = new T.InterruptableStoppingCriteria()
  stops.set(id, stop)
  const streamer = new T.TextStreamer(gen.tokenizer, {
    skip_prompt: true, skip_special_tokens: true,
    callback_function: (t) => self.postMessage({ type: 'token', id, t }),
  })
  await gen(messages, {
    max_new_tokens: maxTokens, do_sample: true, temperature: 0.85, top_p: 0.9,
    repetition_penalty: 1.2, streamer, stopping_criteria: [stop],
  })
  stops.delete(id)
  self.postMessage({ type: 'done', id })
}
