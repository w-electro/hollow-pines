// Speaks character lines with Kokoro (running in voice-worker.js) and a horror effect chain.
//
// Making speech takes about twice as long as speaking it, so two tricks hide the wait:
// fixed lines are made ahead of time in the background (prefetch), and live AI lines
// are spoken sentence by sentence, the first starting while the rest is still written.
// A live line always jumps ahead of background work.
import { playVoice, makePanner, ctx } from './audio.js'

let worker = null
let ready = false
let nextId = 1
const pending = new Map()
const cache = new Map() // voice|text → samples
const live = [] // { voice, text, speed, resolve, reject }
const background = []
let busy = false
// one queue for every character: they take turns, never talk over each other
let speech = Promise.resolve()

export function loadVoice(onProgress) {
  return new Promise((resolve, reject) => {
    worker = new Worker(new URL('./voice-worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'progress') onProgress(m.p)
      else if (m.type === 'ready') { ready = true; resolve() }
      else if (m.type === 'audio') { pending.get(m.id)?.resolve(m.audio); pending.delete(m.id) }
      else if (m.type === 'error') {
        if (m.id) { pending.get(m.id)?.reject(new Error(m.message)); pending.delete(m.id) } else reject(new Error(m.message))
      }
    }
    worker.onerror = (e) => reject(new Error(e.message || 'voice worker failed'))
    const abs = (u) => new URL(u, location.href).href
    worker.postMessage({ type: 'init', tjs: abs(window.HP.lib.tjs), phonemizer: abs(window.HP.lib.phonemizer), local: window.HP.local })
  })
}

export const voiceReady = () => ready
const keyOf = (voice, text) => voice + '|' + text

function pump() {
  if (busy || !ready) return
  // a live line whose moment has passed is dropped before any work is spent on it
  while (live.length && live[0].expires < performance.now()) live.shift().reject(new Error('stale'))
  const job = live.shift() ?? background.shift()
  if (!job) return
  const key = keyOf(job.voice, job.text)
  if (cache.has(key)) { job.resolve(cache.get(key)); pump(); return }
  busy = true
  const id = nextId++
  pending.set(id, {
    resolve: (a) => { cache.set(key, a); busy = false; job.resolve(a); pump() },
    reject: (e) => { busy = false; job.reject(e); pump() },
  })
  worker.postMessage({ type: 'speak', id, text: job.text, voice: job.voice, speed: job.speed })
}

function synth(text, voice, speed, priority, expires = Infinity) {
  const key = keyOf(voice, text)
  if (cache.has(key)) return Promise.resolve(cache.get(key))
  return new Promise((resolve, reject) => {
    ;(priority ? live : background).push({ voice, text, speed, resolve, reject, expires })
    pump()
  })
}

const tidy = (t) => t.replace(/…/g, '...').trim()

// Make a fixed line ahead of time, so it plays instantly later.
export function prefetch(npc, text) {
  if (!ready || !text) return
  synth(tidy(text), npc.voice.id, npc.voice.speed, false).catch(() => {})
}

// Each character keeps one panner, so the voice comes from where they stand.
// `patience`: seconds this line may wait to start before it is dropped (barks go stale).
export function speakAs(npc, text, { patience = 10 } = {}) {
  if (!ready || !ctx || !text || /^\.+$/.test(text.trim())) return speech
  npc.panner ??= makePanner()
  const expires = performance.now() + patience * 1000
  const audio = synth(tidy(text), npc.voice.id, npc.voice.speed, true, expires) // start making it now
  audio.catch(() => {})
  const job = speech.then(async () => {
    try {
      if (performance.now() > expires) return
      const samples = await audio
      npc.speaking = true
      await playVoice(samples, npc.voice.fx, npc.panner)
    } catch (e) {
      if (e.message !== 'stale') console.warn('voice failed', e)
    } finally {
      npc.speaking = false
    }
  })
  speech = job
  return job
}

// Feeds a streaming line in: every finished sentence goes to the voice as soon as it exists.
export function sentenceFeeder(npc) {
  let spoken = 0
  return {
    update(text) {
      const done = text.match(/[^.!?…]+[.!?…]+(\s|$)/g) ?? []
      while (spoken < done.length) speakAs(npc, done[spoken++].trim())
    },
    finish(text) {
      const done = (text.match(/[^.!?…]+[.!?…]+(\s|$)/g) ?? []).map((s) => s.trim())
      while (spoken < done.length) speakAs(npc, done[spoken++])
      const rest = text.slice(done.join(' ').length).trim()
      if (rest && !done.length) speakAs(npc, text)
      else if (rest) speakAs(npc, rest)
      return speech
    },
  }
}
