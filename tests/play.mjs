// Automated play-through in the installed Chrome (profile and cache on D:, because C: is full).
// Loads the game, starts it, meets Mason, talks, fights, and walks the quest line with
// screenshots at each step. Prints errors, dialogue, and quest progress.
//
//   node tests/play.mjs                                     # local, with python serve.py running
//   node tests/play.mjs https://w-electro.github.io/hollow-pines/
//   SHOTS=D:/W/_scratch/shots node tests/play.mjs
import { chromium } from 'playwright-core'
import fs from 'node:fs'

const URL = process.argv[2] || 'http://localhost:8765/'
const SHOTS = process.env.SHOTS || 'D:/W/_scratch/shots'
fs.mkdirSync(SHOTS, { recursive: true })
const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache', '--autoplay-policy=no-user-gesture-required'],
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => { errors.push(e.message); console.log('[pageerror]', e.message.slice(0, 300)) })
page.on('console', (m) => {
  const t = m.text()
  if (t.startsWith('[safety]')) console.log('   ', t)
  else if (m.type() === 'error' && !/404|favicon/.test(t)) { errors.push(t); console.log('[error]', t.slice(0, 300)) }
})
const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png` })
const wait = (ms) => page.waitForTimeout(ms)
const G = (fn, arg) => page.evaluate(fn, arg)

const t0 = Date.now()
await page.goto(URL)
await page.waitForTimeout(1500)
await shot('0-loading')
await page.waitForFunction(() => window.__game?.state() === 'title' || document.getElementById('loaderr').textContent, null, { timeout: 900000 })
console.log(`loaded in ${((Date.now() - t0) / 1000).toFixed(0)}s; error text: "${await page.textContent('#loaderr')}"`)
await shot('1-title')
await page.click('#start')
await wait(1500)
await shot('2-start')

// walk toward Mason with the keyboard for a moment, then close the gap
await page.keyboard.down('KeyW'); await wait(1200); await page.keyboard.up('KeyW')
await G(() => window.__game.teleport(2.6, 4.6))
await wait(2500)
console.log('quest:', await G(() => window.__game.quests.step().title), '| Mason bubble:', await G(() => window.__game.npcs.mason.bubble.text))
await shot('3-mason-greets')

await G(() => window.__game.talk('mason'))
for (const msg of ['hey what do i need to do?', 'where is the firewood?']) {
  await G((m) => window.__game.send(m), msg)
  console.log('You:', msg, '\n  Mason:', await G(() => window.__game.npcs.mason.bubble.text))
}
await shot('4-talking')
await G(() => window.__game.stopTalking())

// firewood quest: pick up logs, bring them to the fire
console.log('quest:', await G(() => window.__game.quests.step().title))
for (const [x, z] of [[-6, 14], [7, 15], [15, 1]]) {
  await G(([x, z]) => window.__game.teleport(x, z + 0.8), [x, z])
  await wait(300)
  await G(() => window.__game.act())
}
await G(() => window.__game.teleport(0, 2.4))
await wait(300)
await G(() => window.__game.act())
await wait(800)
console.log('after firewood → quest:', await G(() => window.__game.quests.step().title), '| fire:', await G(() => window.__game.world.fire.fuel.toFixed(2)))

// a fight: go into the dark, let shades come, swing
await G(() => window.__game.teleport(-20, 20))
await wait(5000)
await G(() => { const g = window.__game; g.shades.spawnNear(2); const me = g.player.avatar.position; g.shades.list.forEach((s, i) => { s.mesh.position.set(me.x + 5 + i, 0, me.z + 3); s.grow = 1 }) })
for (let i = 0; i < 30; i++) {
  // stand close to the nearest shade, face it, swing
  const left = await G(() => { const g = window.__game; const s = g.shades.list[0]; if (!s) return 0; const p = s.mesh.position; const me = g.player.avatar.position
    const d = Math.hypot(p.x - me.x, p.z - me.z); if (d > 2.2) { me.x = p.x - (p.x - me.x) / d * 1.9; me.z = p.z - (p.z - me.z) / d * 1.9 }
    g.player.avatar.rotation.y = Math.atan2(p.x - me.x, p.z - me.z); return g.shades.list.length })
  if (!left) break
  await page.mouse.click(640, 400)
  await wait(620)
}
console.log('kills:', await G(() => window.__game.kills()), '| hp:', await G(() => Math.round(window.__game.player.hp)))
await shot('5-fight')

console.log('errors:', errors.length)
await ctx.close()
