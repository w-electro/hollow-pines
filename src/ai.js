// Character dialogue: Gemma 3 1B on the player's GPU, running in ai-worker.js.
//
// The game's mechanics never depend on the model understanding anything: quests,
// items and hints are code. The model only gives the characters a voice, and it is
// told what the player is currently doing so its hints point the right way.
// Safety runs here, on the main thread, on every streamed word.
import { cleanLine, unsafeReply, capSentences } from './safety.js'

const RULES = 'You are a character in a horror game set in an abandoned summer camp at night, for players 13 and up, like a Roblox horror game. Be creepy, tense and in character. Reply with ONE or TWO short sentences of spoken dialogue only: no narration, no actions in asterisks, no name prefix, no quotation marks. Content limits: blood can exist and be mentioned, but never describe wounds, injuries or deaths in detail, never describe torture, never mention self-harm or suicide, no swearing, no romance. Never ask for or repeat real personal information (real names, addresses, schools, phone numbers). Answer the Player\'s latest message directly and never repeat a line you already said.'

let worker = null
let ready = false
let nextId = 1
const jobs = new Map()
let queue = Promise.resolve()

export function loadDialogue(onProgress) {
  return new Promise((resolve, reject) => {
    worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'progress') onProgress(m.p)
      else if (m.type === 'ready') { ready = true; resolve() }
      else if (m.type === 'token') jobs.get(m.id)?.token(m.t)
      else if (m.type === 'done') jobs.get(m.id)?.done()
      else if (m.type === 'error') { if (m.id) jobs.get(m.id)?.fail(new Error(m.message)); else reject(new Error(m.message)) }
    }
    worker.onerror = (e) => reject(new Error(e.message || 'dialogue worker failed'))
    worker.postMessage({ type: 'init', tjs: new URL(window.HP.lib.tjs, location.href).href, local: window.HP.local })
  })
}

export const dialogueReady = () => ready

// One generation at a time: two characters talking at once would fight over the GPU.
export function say(npc, playerTurn, { context = '', onText = () => {}, maxTokens = 60 } = {}) {
  const run = queue.then(() => generate(npc, playerTurn, context, onText, maxTokens))
  queue = run.catch(() => {})
  return run
}

function generate(npc, playerTurn, context, onText, maxTokens) {
  npc.turns.push({ role: 'user', content: playerTurn })
  let recent = npc.turns.slice(-10)
  if (recent[0].role !== 'user') recent = recent.slice(1)
  // hidden example exchanges go first: small models copy examples far better than they follow rules
  const examples = (npc.examples ?? []).flatMap(([q, a]) => [{ role: 'user', content: q }, { role: 'assistant', content: a }])
  const messages = [{ role: 'system', content: `${RULES}\nYou are ${npc.name}. ${npc.persona}\n${context}` }, ...examples, ...recent]
  const id = nextId++
  return new Promise((resolve) => {
    let raw = ''
    let blocked = false
    let capped = false
    const max = npc.maxSentences ?? 2
    const finish = (failed) => {
      jobs.delete(id)
      let text = blocked || failed ? npc.fallback() : (capSentences(cleanLine(raw, npc.name), max).text || npc.fallback())
      if (blocked) console.log('[safety] blocked a reply from', npc.name)
      text = npc.shape ? npc.shape(text) : text
      npc.turns.push({ role: 'assistant', content: text })
      resolve(text)
    }
    jobs.set(id, {
      token: (t) => {
        if (blocked || capped) return
        raw += t
        const c = capSentences(cleanLine(raw, npc.name), max)
        // checked on every word: a bad line is never on screen, not even for a moment
        if (unsafeReply(c.text)) { blocked = true; worker.postMessage({ type: 'stop', id }); onText(''); return }
        // enough said: stop the model as soon as the last allowed sentence ends
        if (c.full) { capped = true; worker.postMessage({ type: 'stop', id }) }
        if (c.text) onText(c.text)
      },
      done: () => finish(false),
      fail: (e) => { console.warn('dialogue failed', e); finish(true) },
    })
    worker.postMessage({ type: 'generate', id, messages, maxTokens })
  })
}
