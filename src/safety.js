// Safety layer for what players type and what characters say. Code, not prompts:
// the model is small and can be talked into things, so nothing here trusts it.
//
// Content level: a Roblox horror game rated 13+. Horror talk is fine ("are we gonna
// die?", "is silas dead?", blood on a door). Violent DETAIL is not, and self-harm
// is never a story beat.

// A request for violent detail: a violent word together with a "describe it" word.
const VIOLENT = /\b(kill(ed|s|ing)?|murder\w*|bod(y|ies)|corpses?|stab\w*|slash\w*|blood\w*|gore|guts|tortur\w*|weapons?|hurt|injur\w*|wounds?|gor(e|y)|bloody)\b|what (did|does|would) (he|silas|it) do to/i
const DETAIL = /\b(describe|detail\w*|exactly|specific\w*|show me|graphic|step by step)\b|\bhow (did|does|do|would) (he|silas|it|they)\b|what (did|does|would) (he|silas|it) do to/i

// A kid saying this may mean it for real: the game answers, never a character.
const SELF_HARM = /\b(suicide|suicidal|kill (myself|me)|self.?harm|cut(ting)? myself|(want|wanna|going) to die|wanna die|end (it|my life))\b/i

// A reply describing violence or injury: stopped mid-stream, never shown, never remembered.
const UNSAFE_OUT = /\b(kill(ed|s|ing)?|murder\w*|corpses?|bod(y|ies)|stab\w*|slash\w*|struck|strike|lashed|beat(en)?|chests?|throats?|skulls?|bones?|wounds?|bleed(ing)?|severed|tortur\w*|suicide|self.?harm|knife|knives|axe|machete|scream(s|ed)? in pain)\b/i

export const isSelfHarm = (t) => SELF_HARM.test(t)
export const wantsGore = (t) => VIOLENT.test(t) && DETAIL.test(t)
export const unsafeReply = (t) => UNSAFE_OUT.test(t)

// Tidy a model line into one spoken line: no actions in asterisks, no "Name:" prefix,
// no quotes, no sentences where the character narrates itself, no pet names for the player.
export function cleanLine(t, name) {
  // no stage directions: *actions*, (actions) or [actions]
  t = t.replace(/\*[^*]*\*?/g, '').replace(/\([^)]*\)?/g, '').replace(/\[[^\]]*\]?/g, '').replace(new RegExp('^\\s*' + name + '\\s*:\\s*', 'i'), '')
    .replace(/["“”]/g, '').replace(/\s+/g, ' ').trim()
  const self = new RegExp('^' + name + '(’s|\'s)?\\s', 'i')
  const kept = t.split(/(?<=[.!?…])\s+/).filter((x) => !self.test(x))
  t = kept.length ? kept.join(' ') : t
  return t.replace(/,\s*(child|children|young ones?|little ones?|kiddo|darling|dear|sweetie|sweetheart|honey|my dear)(?=\s*[.,!?…]|\s*$)/gi, '')
    .replace(/\s+([.,!?])/g, '$1').trim()
}

// Phone numbers and emails a player types never reach the model.
export function redactPersonal(t) {
  return t.replace(/\+?\d[\d\s-]{6,}\d/g, '[number]').replace(/\S+@\S+\.\S+/g, '[email]')
}

// The first n complete sentences, and whether more came after them.
export function capSentences(t, n) {
  const parts = t.match(/[^.!?…]+[.!?…]+\s*/g) ?? []
  if (parts.length < n) return { text: t, full: false }
  const text = parts.slice(0, n).join('').trim()
  return { text, full: t.trim().length > text.length }
}
