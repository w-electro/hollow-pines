// Camp Hollow Pines — wiring: loading, the loop, interactions, story, talking.
import * as THREE from 'three'
import { buildWorld, SPOTS, PAGES, BATTERIES, LOGS } from './world.js'
import { makePlayer } from './player.js'
import { makeNPCs } from './npc.js'
import { makeShades } from './enemies.js'
import { makeWildlife } from './wildlife.js'
import { makeItems, ITEM_INFO } from './items.js'
import { makeQuests, STEPS, PAGE_TEXT } from './quests.js'
import { makeUI } from './ui.js'
import { startAudio, sfx, setFear, setListener, ctx as audioCtx } from './audio.js'
import { loadDialogue, say } from './ai.js'
import { loadVoice, speakAs, prefetch, sentenceFeeder } from './voice.js'
import { isSelfHarm, wantsGore, redactPersonal } from './safety.js'

const $ = (id) => document.getElementById(id)

/* ── renderer and scene ─────────────────────────────────────────────── */
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.35
$('game').append(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 160)
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(innerWidth, innerHeight)
})

const world = buildWorld(scene)
const player = makePlayer(scene, camera, renderer.domElement, SPOTS.playerStart)
const npcs = makeNPCs(scene)
const { mason, silas } = npcs
const ui = makeUI(camera)
const items = makeItems(scene)
let kills = 0
const shades = makeShades(scene, { player, world, onKill: () => onKill() })
const wildlife = makeWildlife(scene, { player, shades })
const quests = makeQuests((step, advanced) => onQuest(step, advanced))

let state = 'loading' // loading → title → play → dead | win
let talkingTo = null
let busyTalking = false
let holdE = 0
let finale = null
const found = { battery: 0 }

for (const p of LOGS) items.add('log', p)
for (const p of BATTERIES) items.add('battery', p)

/* ── loading: one bar for everything ─────────────────────────────────── */
const bytes = new Map()
function progress(p) {
  if (p.status === 'progress' && p.total) bytes.set((p.name ?? '') + '/' + p.file, [p.loaded, p.total])
  let loaded = 0, total = 0
  for (const [l, t] of bytes.values()) { loaded += l; total += t }
  // the two models together are about 850 MB; until both have reported, assume that
  ui.loading(Math.min(0.99, loaded / Math.max(total, 850e6)))
}
async function load() {
  if (!navigator.gpu) {
    ui.loadError('This game needs WebGPU. Please open it in Chrome or Edge on a computer.')
    return
  }
  try {
    await Promise.all([loadDialogue(progress), loadVoice(progress)])
  } catch (e) {
    console.error(e)
    ui.loadError('Something went wrong while loading. Refresh the page to try again.')
    return
  }
  ui.loading(1)
  // fixed lines, voiced in the background while the title is up — in the order they are needed
  for (const t of mason.greetings) prefetch(mason, t)
  for (const s of STEPS) if (MASON_BARKS[s.id]) prefetch(mason, MASON_BARKS[s.id])
  for (const t of silas.greetings) prefetch(silas, t)
  for (const [who, line] of ENDING) prefetch(who === 'silas' ? silas : mason, line)
  for (const t of silas.safe) prefetch(silas, t)
  for (const t of mason.safe) prefetch(mason, t)
  setTimeout(() => {
    ui.show('loading', false)
    ui.show('title')
    ui.show('continue', !!readSave())
    state = 'title'
  }, 300)
}
load()

function begin() {
  startAudio()
  sfx.stinger()
  ui.show('title', false)
  ui.show('hud')
  state = 'play'
  onQuest(quests.step(), false)
}
$('start').onclick = () => {
  try { localStorage.removeItem(SAVE_KEY) } catch {}
  begin()
  ui.toast('Find out who is sitting by the fire.', 'quest')
}
$('continue').onclick = () => {
  restore(readSave())
  begin()
  ui.toast('Back at Camp Hollow Pines…', 'quest')
}

/* ── saving: a kid closing the tab shouldn't lose the night ──────────── */
const SAVE_KEY = 'hollow-pines-save-v1'
const collectedPages = new Set()
function readSave() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) } catch { return null }
}
function save() {
  if (state !== 'play') return
  // the finale restarts from the radio: it is a moment, not a place to resume in the middle of
  const finaleAt = STEPS.findIndex((s) => s.id === 'finale')
  const index = quests.index >= finaleAt ? finaleAt - 1 : quests.index
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      index, progress: index === quests.index ? quests.progress : 0, inv: player.inv, hp: player.hp, battery: player.battery,
      fuel: world.fire.fuel, kills, found, pages: [...collectedPages], metMason: mason.greeted,
    }))
  } catch {}
}
function restore(s) {
  if (!s) return
  quests.index = s.index
  quests.progress = s.progress
  Object.assign(player.inv, s.inv)
  if (quests.index === STEPS.findIndex((x) => x.id === 'radio')) player.inv.key = 1 // the key comes back with the radio step
  player.hp = Math.max(40, s.hp)
  player.battery = Math.max(30, s.battery)
  world.fire.fuel = Math.max(0.4, s.fuel)
  kills = s.kills
  Object.assign(found, s.found)
  for (const p of s.pages) collectedPages.add(p)
  mason.greeted = s.metMason
  player.avatar.position.copy(SPOTS.fire).add(new THREE.Vector3(0, 0, 3.5))
  // the world as it was: lights on, and whatever the current step put out there
  if (quests.past('power')) for (const l of world.lamps) { l.on = true; l.bulb.material.color.set(0xfff0c0) }
  const id = quests.step().id
  if (id === 'fuse') items.add('fuse', SPOTS.boathouse.clone().add(new THREE.Vector3(-0.8, 0, 2.2)))
  if (id === 'power' && !player.inv.fuse) player.inv.fuse = 1
  if (id === 'pages') PAGES.forEach((p, i) => { if (!collectedPages.has(i)) items.add('page', p, { page: i }) })
  if (id === 'key') items.add('key', SPOTS.dockEnd)
}
setInterval(save, 10000)
addEventListener('pagehide', save)

/* ── the story ────────────────────────────────────────────────────────── */
const MASON_BARKS = {
  wood: "The fire's dying. When it goes out, they come closer. Can you bring me wood? Three pieces, from the trees around camp.",
  batteries: "Your flashlight's getting weak. The cabins always kept spare batteries by the doors. Check the doorsteps.",
  fuse: "We need the lights back on. The generator's missing a fuse... Silas kept spare parts in the boathouse, by the lake.",
  power: "You found the fuse! The generator shed is west of here. Get the lights on. Please.",
  pages: "The lights work! Wait... Silas always wrote in a journal. If the pages are out there, I need to know what happened.",
  key: "The end of the dock. That's where he left the key. Go, I'll keep the fire going.",
  radio: "The ranger station is up north. If that radio still works... maybe he'll hear us.",
  finale: "He answered! He's coming! Don't let them near the fire!",
}
// When a player asks for help, Mason's answer is written, not generated: it must be right.
const ASKS_HELP = /\b(what (do|should|can|am) (i|we)\b.*\bdo(ing)?|what now|what next|where (is|are|do|should|can|to)|how do i|help|i'?m lost|stuck|objective|quest|task|mission|which way)\b/i
function masonHint() {
  const s = quests.step()
  const left = s.need ? s.need - quests.progress : 0
  const n = ['', 'one', 'two', 'three'][left] ?? String(left)
  const H = {
    meet: "The fire's dying. Bring wood from the trees around camp and throw it on the fire. Three pieces.",
    wood: `Firewood. ${n} more piece${left === 1 ? '' : 's'} from the trees around camp, then throw ${left === 1 ? 'it' : 'them'} on the fire. Follow the arrow.`,
    batteries: `Check the doorsteps of the cabins. We need ${n} more batter${left === 1 ? 'y' : 'ies'}.`,
    fuse: 'The boathouse. East side, by the lake. The fuse should be there.',
    power: "Take the fuse to the generator shed, west of here. Hold E on the generator.",
    pages: `His journal pages are out in the woods. ${n} left. Follow the arrow.`,
    key: "The key is at the very end of the dock, out on the lake.",
    radio: "The ranger station is up north. Get inside and use the radio.",
    finale: "Just hold on! Stay in the light, he's coming!",
    reunite: "He's here... Silas is right there. Go to him. Please.",
  }
  return H[s.id] ?? 'Stay close to the fire.'
}

const ENDING = [
  ['silas', 'Mason.'],
  ['mason', 'Silas? Is it... is it really you?'],
  ['silas', 'I kept them away. As long as I could.'],
  ['mason', "You don't have to anymore. Come home. Please."],
]

function onQuest(step, advanced) {
  if (advanced) {
    setTimeout(save, 0)
    sfx.quest()
    ui.toast('New objective: ' + step.title, 'quest')
    const bark = MASON_BARKS[step.id]
    if (bark) masonSays(bark)
    if (step.id === 'fuse') items.add('fuse', SPOTS.boathouse.clone().add(new THREE.Vector3(-0.8, 0, 2.2)))
    if (step.id === 'pages') PAGES.forEach((p, i) => items.add('page', p, { page: i }))
    if (step.id === 'key') items.add('key', SPOTS.dockEnd)
    if (step.id === 'batteries') {
      // batteries found before this step count too
      quests.progress = Math.min(found.battery, step.need)
      if (quests.progress >= step.need) setTimeout(() => quests.is('batteries') && quests.advance(), 1500)
    }
    if (step.id === 'finale') startFinale()
  }
  refreshQuest()
}

function refreshQuest() {
  const step = quests.step()
  const sides = []
  if (quests.past('wood')) sides.push(`🔥 Keep the fire burning (${Math.round(world.fire.fuel * 100)}%)`)
  sides.push(`👁 Shades banished: ${kills}`)
  ui.quest(step, quests.progress, sides)
}

function masonSays(line) {
  mason.bubble = { text: line, thinking: false, until: performance.now() + 9000 }
  speakAs(mason, line, { patience: 8 })
}

function onKill() {
  kills++
  // shades sometimes leave something behind
  const r = Math.random()
  const at = player.avatar.position.clone().add(player.forward().multiplyScalar(2))
  if (r < 0.22) items.add('battery', at)
  else if (r < 0.37) items.add('bandage', at)
  if (kills === 5 || kills === 15) ui.toast(kills === 5 ? 'They can be beaten. Keep swinging.' : 'The shades are afraid of you now.')
  refreshQuest()
}

/* ── interactions ─────────────────────────────────────────────────────── */
function nearNPC() {
  const pp = player.avatar.position
  for (const n of npcs.all) {
    if (n === silas && finale && !finale.done) continue
    if (n.mesh.position.distanceTo(pp) < 3.6) return n
  }
  return null
}

// What E does here (talking is Enter, so standing by Mason never blocks the fire)
function availableAction() {
  const pp = player.avatar.position
  const it = items.nearest(pp)
  if (it) return { text: `<kbd>E</kbd> Pick up ${ITEM_INFO[it.kind].name.toLowerCase()}`, run: () => pickUp(it) }
  if (pp.distanceTo(SPOTS.fire) < 3.2 && player.inv.log > 0) return { text: `<kbd>E</kbd> Add firewood (${player.inv.log})`, run: feedFire }
  if (quests.is('power') && pp.distanceTo(SPOTS.generator) < 4.4) return { text: `<kbd>E</kbd> Hold to fix the generator`, hold: fixGenerator }
  if (quests.is('radio') && pp.distanceTo(SPOTS.rangerDoor) < 2.6) return { text: `<kbd>E</kbd> Unlock the station and use the radio`, run: useRadio }
  return null
}

function promptText(a) {
  const n = nearNPC()
  const talk = n ? `<kbd>Enter</kbd> Talk to ${n.name}` : ''
  return [talk, a?.text].filter(Boolean).join(' &nbsp;·&nbsp; ') || null
}

function pickUp(it) {
  items.take(it)
  sfx.pickup()
  const info = ITEM_INFO[it.kind]
  if (it.kind === 'battery') {
    player.battery = 100
    found.battery++
    ui.toast('🔋 Flashlight recharged')
    if (quests.is('batteries')) quests.bump()
    return
  }
  player.inv[it.kind] = (player.inv[it.kind] ?? 0) + 1
  ui.toast(`${info.icon} ${info.name}`)
  if (it.kind === 'log') {
    if (quests.is('wood')) ui.toast('Bring it to the campfire')
    setTimeout(() => items.add('log', it.pos), 90000) // the woods grow more
  }
  if (it.kind === 'fuse' && quests.is('fuse')) quests.advance()
  if (it.kind === 'page') {
    collectedPages.add(it.page)
    const page = PAGE_TEXT[it.page]
    ui.page(page.title, page.text)
    // Silas's voice reads his own words, from wherever he is
    speakAs(silas, page.text.split('\n').slice(1).join(' '), { patience: 4 })
    player.frozen = true
    if (quests.is('pages')) quests.bump()
  }
  if (it.kind === 'key' && quests.is('key')) {
    sfx.stinger()
    shades.spawnNear(4)
    ui.toast('Something moved in the water…')
    quests.advance()
  }
}

function feedFire() {
  const n = player.inv.log
  player.inv.log = 0
  world.fire.fuel = Math.min(1, world.fire.fuel + n * 0.3)
  sfx.pickup()
  ui.toast(`🔥 The fire burns brighter`)
  if (quests.is('wood')) quests.bump(n)
  refreshQuest()
}

function fixGenerator(dt) {
  holdE += dt
  ui.prompt(`Fixing the generator… ${Math.min(100, Math.round((holdE / 2.2) * 100))}%`)
  if (holdE >= 2.2) {
    holdE = 0
    player.inv.fuse = 0
    sfx.generator()
    for (const l of world.lamps) { l.on = true; l.bulb.material.color.set(0xfff0c0) }
    ui.toast('⚡ The lights are on')
    setTimeout(() => { sfx.stinger(); silas.mesh.position.set(-22, 0, -8) }, 1500) // and someone was watching
    quests.advance()
  }
}

function useRadio() {
  player.inv.key = 0
  sfx.click()
  ui.toast('📻 "...Silas? Silas, it\'s Mason. Please come back."')
  setTimeout(() => { sfx.stinger(); ui.toast('📻 A whisper on the radio: "...coming."') }, 2500)
  setTimeout(() => quests.advance(), 4500)
}

function startFinale() {
  finale = { t: STEPS.find((s) => s.id === 'finale').timer, done: false }
  silas.mesh.position.set(-24, 0, -20)
  shades.spawnNear(5)
  world.fire.fuel = Math.max(world.fire.fuel, 0.6)
}

let ending = false
async function playEnding() {
  if (ending) return
  ending = true
  player.frozen = true
  for (const [who, line] of ENDING) {
    const n = who === 'silas' ? silas : mason
    n.bubble = { text: line, thinking: false, until: performance.now() + 7000 }
    await speakAs(n, line, { patience: 40 })
    await new Promise((r) => setTimeout(r, 500))
  }
  $('win-text').textContent = 'Silas lowers the mask. Under it is just a tired kid who has been brave for far too long. Mason grabs his brother and doesn\'t let go. The fire burns high, and for the first time in years, nothing moves in the dark.'
  try { localStorage.removeItem(SAVE_KEY) } catch {}
  setTimeout(() => { state = 'win'; ui.show('win') }, 800)
}

addEventListener('keydown', (e) => {
  if (state !== 'play') return
  if (talkingTo) {
    if (e.code === 'Escape') stopTalking()
    return
  }
  if (e.code === 'KeyE') {
    const a = availableAction()
    if (a?.run) a.run()
  }
  if (e.code === 'Enter') {
    const n = nearNPC()
    if (n) startTalking(n)
  }
  if (e.code === 'Digit1' && player.inv.bandage > 0 && player.hp < 100) {
    player.inv.bandage--
    player.heal(40)
    sfx.pickup()
    ui.toast('🩹 +40 health')
  }
})

/* ── talking ──────────────────────────────────────────────────────────── */
function startTalking(n) {
  if (quests.is('reunite') && n === silas) { playEnding(); return }
  talkingTo = n
  player.talking = true
  if (n === silas) silas.talkLock = true
  ui.talk(n)
}
function stopTalking() {
  if (!talkingTo) return
  if (talkingTo === silas) { silas.talkLock = false; silas.vanishNow = true }
  talkingTo = null
  player.talking = false
  ui.talk(null)
}
$('send').onclick = () => send()
$('say').addEventListener('keydown', (e) => {
  if (e.code === 'Enter') { e.preventDefault(); send() }
  if (e.code === 'Escape') stopTalking()
  e.stopPropagation()
})
$('care-close').onclick = () => ui.show('care', false)
$('page-close').onclick = () => { ui.show('page', false); player.frozen = false }

async function send() {
  const text = $('say').value.trim()
  const npc = talkingTo
  if (!text || !npc || busyTalking) return
  $('say').value = ''
  if (isSelfHarm(text)) { console.log('[safety] self-harm wording: showing the care note'); ui.show('care'); return }
  let turn = redactPersonal(text)
  let extra = ''
  if (wantsGore(text)) {
    // the request itself never reaches the model; the character is told to refuse instead
    console.log('[safety] redirected a player message')
    turn = 'Tell me the gory details.'
    extra = ' The Player keeps asking for gory details. Refuse in a creepy way, and steer back to the mystery.'
  }
  if (npc === mason && !extra && ASKS_HELP.test(text)) {
    const hint = masonHint()
    npc.turns.push({ role: 'user', content: turn }, { role: 'assistant', content: hint })
    npc.bubble = { text: hint, thinking: false, until: performance.now() + 10000 }
    speakAs(mason, hint, { patience: 15 })
    if (quests.is('meet')) setTimeout(() => quests.is('meet') && quests.advance(), 2500)
    return
  }
  busyTalking = true
  ui.talkBusy(true, npc.name)
  npc.bubble = { text: '', thinking: true, until: performance.now() + 60000 }
  const feeder = sentenceFeeder(npc)
  const context = (npc === mason ? quests.context() : `Right now: ${quests.step().hint}`) + extra
  const line = await say(npc, turn, {
    context,
    maxTokens: npc === silas ? 16 : 60,
    onText: (t) => { npc.bubble.text = t; npc.bubble.thinking = !t; if (npc === mason) feeder.update(t) },
  })
  npc.bubble = { text: line, thinking: false, until: performance.now() + 9000 + line.length * 40 }
  // Mason speaks sentence by sentence as he writes; Silas's whisper is shaped first, then spoken
  if (npc === mason) feeder.finish(line)
  else speakAs(npc, line)
  busyTalking = false
  ui.talkBusy(false)
  if (quests.is('meet') && npc === mason) setTimeout(() => quests.is('meet') && quests.advance(), 2500)
}

/* ── death ────────────────────────────────────────────────────────────── */
function die() {
  state = 'dead'
  stopTalking()
  ui.show('dead')
}
$('respawn').onclick = () => {
  player.avatar.position.copy(SPOTS.fire).add(new THREE.Vector3(0, 0, 3))
  player.hp = 70
  player.battery = Math.max(player.battery, 40)
  player.inv.log = 0
  world.fire.fuel = Math.max(world.fire.fuel, 0.35)
  shades.clear()
  ui.show('dead', false)
  state = 'play'
}
$('again').onclick = () => { try { localStorage.removeItem(SAVE_KEY) } catch {} location.reload() }

/* ── the loop ─────────────────────────────────────────────────────────── */
const clock = new THREE.Clock()
let fireWarned = false
let questTick = 0
function frame() {
  requestAnimationFrame(frame)
  const dt = Math.min(clock.getDelta(), 0.05)
  world.update(dt)
  items.update(dt)

  if (state === 'play') {
    player.update(dt, world.colliders, world.occluders)
    const aggression = finale && !finale.done ? 2.4 : 0.35 + quests.index * 0.14
    shades.update(dt, { aggression, fireOut: world.fire.fuel <= 0 })
    wildlife.update(dt, world.colliders)
    npcs.update(dt, { player, finale })

    // greetings: they notice you before you speak
    for (const n of npcs.all) {
      if (!n.greeted && n.mesh.position.distanceTo(player.avatar.position) < 5 && !(finale && !finale.done)) {
        n.greeted = true
        const g = n.greet()
        n.turns.push({ role: 'user', content: '(I walk up to you in the dark with my flashlight.)' }, { role: 'assistant', content: g })
        n.bubble = { text: g, thinking: false, until: performance.now() + 8000 }
        speakAs(n, g)
        if (n === mason && quests.is('meet')) setTimeout(() => quests.is('meet') && quests.advance(), 6500)
      }
    }
    if (silas.vanished) { silas.vanished = false; sfx.stinger(); player.battery = Math.max(0, player.battery - 3) }
    // the first time you spot Silas at a new place: a sting, and your light stutters
    if (!silas.seenAt || silas.seenAt.distanceTo(silas.mesh.position) > 1) {
      const sp = silas.mesh.position.clone().setY(2).project(camera)
      const d = silas.mesh.position.distanceTo(player.avatar.position)
      if (sp.z < 1 && Math.abs(sp.x) < 0.8 && Math.abs(sp.y) < 0.8 && d < 26 && !(finale && !finale.done)) {
        silas.seenAt = silas.mesh.position.clone()
        if (state === 'play' && quests.index > 0) { sfx.stinger(); player.flicker = 0.9 }
      }
    }

    // actions under E
    const a = talkingTo ? null : availableAction()
    if (a?.hold && player._eHeld) a.hold(dt)
    else { holdE = 0; ui.prompt(talkingTo ? null : promptText(a)) }

    // the fire
    if (world.fire.fuel <= 0 && !fireWarned && quests.past('meet')) { fireWarned = true; ui.toast('The fire went out. They are getting bolder.'); sfx.stinger() }
    if (world.fire.fuel > 0.05) fireWarned = false

    // finale timer
    if (finale && !finale.done) {
      finale.t -= dt
      ui.timer(finale.t)
      if (finale.t <= 0) {
        finale.done = true
        shades.clear() // they all go at once
        silas.mesh.position.copy(SPOTS.fire).add(new THREE.Vector3(-2.5, 0, -2))
        ui.toast('The shadows pull back into the trees…', 'quest')
        quests.advance()
      }
    }

    questTick -= dt
    if (questTick <= 0) { refreshQuest(); questTick = 1 }

    if (player.hp <= 0) die()

    // fear: shades close, low health, fire out
    const fear = Math.min(1, Math.max(0, (10 - shades.nearestDist()) / 10) * 0.8 + (player.hp < 35 ? 0.4 : 0) + (world.fire.fuel <= 0 ? 0.1 : 0))
    setFear(fear)
    const look = new THREE.Vector3()
    camera.getWorldDirection(look)
    setListener(camera.position, look)
    for (const n of npcs.all) if (n.panner) {
      n.panner.positionX.value = n.mesh.position.x
      n.panner.positionY.value = 2
      n.panner.positionZ.value = n.mesh.position.z
    }

    const step = quests.step()
    const target = step.targets ? step.targets.find((p, i) => items.items.some((it) => it.kind === 'page' && it.page === i && it.active)) : step.target
    // the arrow is for finding things; once you are there it gets out of the way
    ui.waypoint(talkingTo || !target || target.distanceTo(player.avatar.position) < 6 ? null : target)
    ui.vitals(player, world.fire)
    ui.hotbar(player.inv)
  } else {
    // title / loading: a slow drift around the fire
    const t = performance.now() / 9000
    camera.position.set(Math.sin(t) * 14, 6, Math.cos(t) * 14)
    camera.lookAt(0, 1, 0)
    npcs.update(dt, { player, finale })
  }
  ui.bubbles(npcs.all, player.avatar.position)
  renderer.render(scene, camera)
}
frame()

// hold-to-use needs to know E is down
addEventListener('keydown', (e) => { if (e.code === 'KeyE') player._eHeld = true })
addEventListener('keyup', (e) => { if (e.code === 'KeyE') player._eHeld = false })

// test hook for the automated play-through (tests/play.mjs)
window.__game = {
  player, npcs, quests, items, shades, world, kills: () => kills, state: () => state,
  send: (t) => { $('say').value = t; return send() }, talk: (n) => startTalking(npcs[n]), stopTalking,
  teleport: (x, z) => player.avatar.position.set(x, 0, z), act: () => availableAction()?.run?.(),
  finale: () => finale, prompt: () => promptText(availableAction()), audio: () => audioCtx?.state,
}
