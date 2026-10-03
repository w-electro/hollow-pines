// All sound is made here, from code: no audio files to download.
// Ambience (wind, crickets, a low drone), a heartbeat when hurt, combat sounds,
// and the effect chains that turn plain speech into horror voices.
export let ctx = null
let master, sfxBus, voiceBus, ambBus
let heart = { gain: null, next: 0 }
let meter = null, voiceMeter = null
let reverbIR = null

export function startAudio() {
  if (ctx) return ctx
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = 0.9
  master.connect(ctx.destination)
  // a meter on everything that reaches the speakers: tests read it to prove sound comes out
  meter = ctx.createAnalyser()
  meter.fftSize = 2048
  master.connect(meter)
  voiceMeter = ctx.createAnalyser()
  voiceMeter.fftSize = 2048
  sfxBus = bus(0.7)
  voiceBus = bus(1.0)
  voiceBus.connect(voiceMeter)
  ambBus = bus(0.55)
  reverbIR = impulse(3.2, 2.4)
  ambience()
  return ctx
}

function bus(v) {
  const g = ctx.createGain()
  g.gain.value = v
  g.connect(master)
  return g
}

function noiseBuffer(seconds = 2) {
  const b = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return b
}

// a synthetic room tail: decaying noise, no impulse files needed
function impulse(seconds, decay) {
  const len = ctx.sampleRate * seconds
  const b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return b
}

function ambience() {
  // wind: filtered noise with a slowly wandering filter
  const wind = ctx.createBufferSource()
  wind.buffer = noiseBuffer(4)
  wind.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 420
  bp.Q.value = 0.6
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.07
  const lfoAmt = ctx.createGain()
  lfoAmt.gain.value = 260
  lfo.connect(lfoAmt).connect(bp.frequency)
  const wg = ctx.createGain()
  wg.gain.value = 0.22
  wind.connect(bp).connect(wg).connect(ambBus)
  wind.start()
  lfo.start()

  // a low drone that never resolves
  for (const f of [55, 58.3]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 180
    const g = ctx.createGain()
    g.gain.value = 0.025
    o.connect(lp).connect(g).connect(ambBus)
    o.start()
  }

  // crickets: short chirps at random
  const chirp = () => {
    if (!ctx) return
    const t = ctx.currentTime
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator()
      o.frequency.value = 4300 + Math.random() * 300
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t + i * 0.06)
      g.gain.linearRampToValueAtTime(0.012, t + i * 0.06 + 0.01)
      g.gain.linearRampToValueAtTime(0, t + i * 0.06 + 0.04)
      o.connect(g).connect(ambBus)
      o.start(t + i * 0.06)
      o.stop(t + i * 0.06 + 0.05)
    }
    setTimeout(chirp, 600 + Math.random() * 2600)
  }
  chirp()

  heart.gain = ctx.createGain()
  heart.gain.gain.value = 0
  heart.gain.connect(master)
}

function thump(t, freq, vol) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(freq, t)
  o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.12)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18)
  o.connect(g).connect(heart.gain)
  o.start(t)
  o.stop(t + 0.2)
}

// fear 0..1: the heartbeat gets louder and faster
export function setFear(fear) {
  if (!ctx) return
  heart.gain.gain.setTargetAtTime(fear * 0.8, ctx.currentTime, 0.3)
  if (fear > 0.05 && ctx.currentTime > heart.next) {
    const t = ctx.currentTime + 0.02
    thump(t, 70, 0.6)
    thump(t + 0.16, 60, 0.45)
    heart.next = t + 1.05 - fear * 0.5
  }
}

/* ── sound effects ───────────────────────────────────────────────────── */
function burst({ dur = 0.2, freq = 800, type = 'bandpass', q = 1, vol = 0.4, sweep = null }) {
  if (!ctx) return
  const t = ctx.currentTime
  const s = ctx.createBufferSource()
  s.buffer = noiseBuffer(dur + 0.05)
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(freq, t)
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur)
  f.Q.value = q
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, t)
  g.gain.exponentialRampToValueAtTime(0.001, t + dur)
  s.connect(f).connect(g).connect(sfxBus)
  s.start(t)
}

function tone({ freq = 440, to = null, dur = 0.3, type = 'sine', vol = 0.2, delay = 0 }) {
  if (!ctx) return
  const t = ctx.currentTime + delay
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(sfxBus)
  o.start(t)
  o.stop(t + dur + 0.05)
}

export const sfx = {
  swing: () => burst({ dur: 0.18, freq: 1800, sweep: 500, q: 0.8, vol: 0.35 }),
  hit: () => { burst({ dur: 0.12, freq: 300, type: 'lowpass', vol: 0.7 }); tone({ freq: 120, to: 50, dur: 0.15, type: 'square', vol: 0.12 }) },
  hurt: () => { burst({ dur: 0.25, freq: 200, type: 'lowpass', vol: 0.6 }); tone({ freq: 90, to: 40, dur: 0.3, type: 'sawtooth', vol: 0.12 }) },
  shadeHiss: () => burst({ dur: 0.6, freq: 3000, sweep: 900, q: 2, vol: 0.18 }),
  shadeDie: () => { burst({ dur: 0.9, freq: 2500, sweep: 120, q: 1.5, vol: 0.35 }); tone({ freq: 300, to: 60, dur: 0.8, type: 'sawtooth', vol: 0.06 }) },
  pickup: () => { tone({ freq: 660, dur: 0.12, vol: 0.12 }); tone({ freq: 990, dur: 0.18, vol: 0.1, delay: 0.08 }) },
  quest: () => { tone({ freq: 220, dur: 0.6, type: 'triangle', vol: 0.12 }); tone({ freq: 330, dur: 0.7, type: 'triangle', vol: 0.1, delay: 0.15 }); tone({ freq: 440, dur: 0.9, type: 'triangle', vol: 0.09, delay: 0.3 }) },
  step: () => burst({ dur: 0.06, freq: 600, type: 'lowpass', vol: 0.08 }),
  click: () => tone({ freq: 1200, dur: 0.05, type: 'square', vol: 0.05 }),
  generator: () => { tone({ freq: 50, to: 90, dur: 1.4, type: 'sawtooth', vol: 0.15 }); burst({ dur: 1.2, freq: 150, type: 'lowpass', vol: 0.3 }) },
  // the violin scrape every horror game needs
  stinger: () => { tone({ freq: 1400, to: 1900, dur: 1.1, type: 'sawtooth', vol: 0.05 }); tone({ freq: 1480, to: 2050, dur: 1.1, type: 'sawtooth', vol: 0.04 }); burst({ dur: 0.8, freq: 4000, q: 4, vol: 0.12 }) },
  crow: () => { tone({ freq: 900, to: 600, dur: 0.18, type: 'sawtooth', vol: 0.05 }); tone({ freq: 850, to: 560, dur: 0.2, type: 'sawtooth', vol: 0.05, delay: 0.25 }) },
}

/* ── voices ──────────────────────────────────────────────────────────── */
function distortion(amount) {
  const ws = ctx.createWaveShaper()
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x))
  }
  ws.curve = curve
  return ws
}

// Plays 24 kHz mono speech through a character's effect chain, placed at `pos` in 3D.
// Resolves when the line ends. `fx`: { rate, reverb, drive, lowpass, echo }.
export function playVoice(samples, fx, panner) {
  if (!ctx) return Promise.resolve()
  const buf = ctx.createBuffer(1, samples.length, 24000)
  buf.copyToChannel(samples, 0)
  const src = ctx.createBufferSource()
  src.buffer = buf
  src.playbackRate.value = fx.rate ?? 1 // below 1: deeper and slower, the cheapest horror effect

  let node = src
  if (fx.drive) { const d = distortion(fx.drive); node.connect(d); node = d }
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = fx.lowpass ?? 9000
  node.connect(lp)
  node = lp

  const dry = ctx.createGain()
  dry.gain.value = 1
  const wet = ctx.createGain()
  wet.gain.value = fx.reverb ?? 0.2
  const conv = ctx.createConvolver()
  conv.buffer = reverbIR
  const out = panner ?? voiceBus
  node.connect(dry).connect(out)
  node.connect(conv).connect(wet).connect(out)
  if (fx.echo) {
    const dl = ctx.createDelay(1)
    dl.delayTime.value = fx.echo
    const fb = ctx.createGain()
    fb.gain.value = 0.35
    node.connect(dl).connect(fb).connect(dl)
    dl.connect(out)
  }
  if (panner) panner.connect(voiceBus)
  // ends when the line ends — or a moment after it should have, whatever the browser reports
  const secs = samples.length / 24000 / (fx.rate ?? 1)
  return new Promise((res) => {
    src.onended = res
    setTimeout(res, secs * 1000 + 1500)
    src.start()
  })
}

export function makePanner() {
  const p = ctx.createPanner()
  p.panningModel = 'HRTF'
  p.distanceModel = 'inverse'
  p.refDistance = 2
  p.rolloffFactor = 1.2
  return p
}

export function setListener(pos, forward) {
  if (!ctx) return
  const l = ctx.listener
  if (l.positionX) {
    l.positionX.value = pos.x; l.positionY.value = pos.y; l.positionZ.value = pos.z
    l.forwardX.value = forward.x; l.forwardY.value = forward.y; l.forwardZ.value = forward.z
    l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0
  }
}

// loudness right now (RMS of what reaches the speakers / of the voices alone)
export function level(which = 'all') {
  const a = which === 'voice' ? voiceMeter : meter
  if (!a) return 0
  const buf = new Float32Array(a.fftSize)
  a.getFloatTimeDomainData(buf)
  let s = 0
  for (const x of buf) s += x * x
  return Math.sqrt(s / buf.length)
}
