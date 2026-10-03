// Character dialogue: Gemma 3 1B on the player's GPU.
//
// The game's mechanics never depend on the model understanding anything: quests,
// items and hints are code. The model only gives the characters a voice, and it is
// told what the player is currently doing so its hints point the right way.
import { pipeline, env, TextStreamer, InterruptableStoppingCriteria } from '@huggingface/transformers'
import { cleanLine, unsafeReply } from './safety.js'

const MODEL = 'onnx-community/gemma-3-1b-it-ONNX'

export function configureEnv() {
  if (window.HP.local) {
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = '/models/'
    env.useBrowserCache = false
    env.backends.onnx.wasm.wasmPaths = '/node_modules/onnxruntime-web/dist/'
  } else {
    env.allowLocalModels = false
  }
}

const RULES = 'You are a character in a horror game set in an abandoned summer camp at night, for players 13 and up, like a Roblox horror game. Be creepy, tense and in character. Reply with ONE or TWO short sentences of spoken dialogue only: no narration, no actions in asterisks, no name prefix, no quotation marks. Content limits: blood can exist and be mentioned, but never describe wounds, injuries or deaths in detail, never describe torture, never mention self-harm or suicide, no swearing, no romance. Never ask for or repeat real personal information (real names, addresses, schools, phone numbers). Answer the Player\'s latest message directly and never repeat a line you already said.'

let gen = null
let queue = Promise.resolve()

export async function loadDialogue(onProgress) {
  configureEnv()
  gen = await pipeline('text-generation', MODEL, { device: 'webgpu', dtype: 'q4f16', progress_callback: onProgress })
  return gen
}

export const dialogueReady = () => !!gen

// One generation at a time: two characters talking at once would fight over the GPU.
export function say(npc, playerTurn, { context = '', onText = () => {}, maxTokens = 60 } = {}) {
  const run = queue.then(() => generate(npc, playerTurn, context, onText, maxTokens))
  queue = run.catch(() => {})
  return run
}

async function generate(npc, playerTurn, context, onText, maxTokens) {
  npc.turns.push({ role: 'user', content: playerTurn })
  let recent = npc.turns.slice(-10)
  if (recent[0].role !== 'user') recent = recent.slice(1)
  const system = `${RULES}\nYou are ${npc.name}. ${npc.persona}\n${context}`
  let raw = ''
  let blocked = false
  const stop = new InterruptableStoppingCriteria()
  const streamer = new TextStreamer(gen.tokenizer, {
    skip_prompt: true, skip_special_tokens: true,
    callback_function: (t) => {
      if (blocked) return
      raw += t
      const line = cleanLine(raw, npc.name)
      // checked on every word: a bad line is never on screen, not even for a moment
      if (unsafeReply(line)) { blocked = true; stop.interrupt(); onText(''); return }
      if (line) onText(line)
    },
  })
  try {
    await gen([{ role: 'system', content: system }, ...recent], {
      max_new_tokens: maxTokens, do_sample: true, temperature: 0.85, top_p: 0.9,
      repetition_penalty: 1.2, streamer, stopping_criteria: [stop],
    })
  } catch (e) {
    console.warn('dialogue failed', e)
    raw = ''
  }
  let text = blocked ? npc.fallback() : (cleanLine(raw, npc.name) || npc.fallback())
  if (blocked) console.log('[safety] blocked a reply from', npc.name)
  text = npc.shape ? npc.shape(text) : text
  npc.turns.push({ role: 'assistant', content: text })
  return text
}
