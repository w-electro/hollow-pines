// Kokoro-82M text-to-speech, in a worker so the game never stutters while a line is made.
//
// Text normalisation and phoneme post-processing follow kokoro-js by hexgrad/xenova
// (Apache-2.0, https://github.com/hexgrad/kokoro), rewritten on Transformers.js v4 so
// the game ships one copy of the ML runtime instead of two.
//
// Runs on WASM (CPU): Kokoro's quantized weights do not sound right on WebGPU, and the
// GPU is busy with the dialogue model and the 3D scene anyway.

const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
let T, phonemize, tokenizer, model, voiceBase
const voices = new Map()

self.onmessage = async (e) => {
  const m = e.data
  try {
    if (m.type === 'init') await init(m)
    else if (m.type === 'speak') {
      const audio = await speak(m.text, m.voice, m.speed)
      self.postMessage({ type: 'audio', id: m.id, audio }, [audio.buffer])
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: m.id, message: String(err && err.message || err) })
  }
}

async function init({ tjs, phonemizer, local, device = 'wasm', dtype = 'q8' }) {
  T = await import(tjs)
  ;({ phonemize } = await import(phonemizer))
  if (local) {
    T.env.allowRemoteModels = false
    T.env.allowLocalModels = true
    T.env.localModelPath = '/models/'
    T.env.useBrowserCache = false
    T.env.backends.onnx.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/'
    voiceBase = `/models/${MODEL}/voices/`
  } else {
    T.env.allowLocalModels = false
    voiceBase = `https://huggingface.co/${MODEL}/resolve/main/voices/`
  }
  // several CPU threads when the page is cross-origin isolated (see serve.py / coi.js)
  if (self.crossOriginIsolated) T.env.backends.onnx.wasm.numThreads = Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 2))
  self.postMessage({ type: 'threads', n: self.crossOriginIsolated ? T.env.backends.onnx.wasm.numThreads : 1 })
  const progress = (p) => self.postMessage({ type: 'progress', p })
  tokenizer = await T.AutoTokenizer.from_pretrained(MODEL, { progress_callback: progress })
  model = await T.StyleTextToSpeech2Model.from_pretrained(MODEL, { dtype, device, progress_callback: progress })
  self.postMessage({ type: 'ready' })
}

async function voiceVector(id) {
  if (!voices.has(id)) {
    const r = await fetch(voiceBase + id + '.bin')
    if (!r.ok) throw new Error('voice ' + id + ' ' + r.status)
    voices.set(id, new Float32Array(await r.arrayBuffer()))
  }
  return voices.get(id)
}

async function speak(text, voice, speed = 1) {
  const phonemes = await toPhonemes(text, voice[0] === 'b' ? 'en' : 'en-us')
  const { input_ids } = tokenizer(phonemes, { truncation: true })
  const n = Math.min(Math.max(input_ids.dims.at(-1) - 2, 0), 509)
  const style = (await voiceVector(voice)).slice(256 * n, 256 * n + 256)
  const { waveform } = await model({
    input_ids,
    style: new T.Tensor('float32', style, [1, 256]),
    speed: new T.Tensor('float32', [speed], [1]),
  })
  return new Float32Array(waveform.data) // 24 kHz mono
}

/* ── text → phonemes (after kokoro-js) ───────────────────────────────── */
const PUNCT = ';:,.!?¡¿—…"«»“”(){}[]'
const PUNCT_RE = new RegExp(`(\\s*[${PUNCT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]+\\s*)+`, 'g')

function normalize(t) {
  return t
    .replace(/[‘’]/g, "'").replace(/[“”«»]/g, '"').replace(/[^\S \n]/g, ' ').replace(/  +/, ' ')
    .replace(/\bD[Rr]\.(?= [A-Z])/g, 'Doctor').replace(/\b(?:Mr\.|MR\.(?= [A-Z]))/g, 'Mister')
    .replace(/\b(?:Ms\.|MS\.(?= [A-Z]))/g, 'Miss').replace(/\b(?:Mrs\.|MRS\.(?= [A-Z]))/g, 'Mrs')
    .replace(/\betc\.(?! [A-Z])/gi, 'etc').replace(/\b(y)eah?\b/gi, "$1e'a")
    .replace(/(?<=\d),(?=\d)/g, '').replace(/\d*\.\d+/g, (x) => { const [a, b] = x.split('.'); return `${a} point ${b.split('').join(' ')}` })
    .replace(/(?<=\d)-(?=\d)/g, ' to ').trim()
}

async function toPhonemes(text, lang) {
  const t = normalize(text)
  const parts = []
  let last = 0
  for (const m of t.matchAll(PUNCT_RE)) {
    if (last < m.index) parts.push({ punct: false, text: t.slice(last, m.index) })
    if (m[0].length) parts.push({ punct: true, text: m[0] })
    last = m.index + m[0].length
  }
  if (last < t.length) parts.push({ punct: false, text: t.slice(last) })
  const out = (await Promise.all(parts.map(async (p) => (p.punct ? p.text : (await phonemize(p.text, lang)).join(' '))))).join('')
  let ph = out
    .replace(/ʲ/g, 'j').replace(/r/g, 'ɹ').replace(/x/g, 'k').replace(/ɬ/g, 'l')
    .replace(/(?<=[a-zɹː])(?=hˈʌndɹɪd)/g, ' ').replace(/ z(?=[;:,.!?¡¿—…"«»“” ]|$)/g, 'z')
  if (lang === 'en-us') ph = ph.replace(/(?<=nˈaɪn)ti(?!ː)/g, 'di')
  return ph.trim()
}
