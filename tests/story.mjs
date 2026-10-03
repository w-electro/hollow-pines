// Walks the whole story from the first step to the ending, using the test hook to move
// around quickly, and checks the voices actually play. Screenshots go to SHOTS.
//
//   node tests/story.mjs                (python serve.py running)
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
let errors = 0
page.on('pageerror', (e) => { errors++; console.log('[pageerror]', e.message.slice(0, 300)) })
page.on('console', (m) => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) { errors++; console.log('[error]', m.text().slice(0, 300)) } else if (/voice failed|\[safety\]/.test(m.text())) console.log('   ', m.text().slice(0, 200)) })
const wait = (ms) => page.waitForTimeout(ms)
const G = (fn, arg) => page.evaluate(fn, arg)
const shot = (n) => page.screenshot({ path: `${SHOTS}/story-${n}.png` })
const step = () => G(() => window.__game.quests.step().id)
async function goAct(x, z, label) {
  await G(([x, z]) => window.__game.teleport(x, z), [x, z])
  await wait(350)
  const p = await G(() => window.__game.prompt())
  await G(() => window.__game.act())
  await wait(250)
  console.log(`  ${label}: prompt="${(p || '').replace(/<[^>]+>/g, '')}" → step ${await step()}`)
}

await page.goto(URL)
await page.waitForFunction(() => window.__game?.state() === 'title', null, { timeout: 900000 })
await page.click('#start')
await wait(800)

// this run checks the story, not the fighting: the player can't be hurt
await G(() => { window.__game.player.damage = () => {} })
// count voice lines as they play
await G(() => { window.__spoke = []; setInterval(() => { for (const n of window.__game.npcs.all) if (n.speaking && window.__spoke.at(-1) !== n.id) window.__spoke.push(n.id) }, 100) })

console.log('isolated (multi-threaded voice):', await G(() => crossOriginIsolated))
console.log('step:', await step())
await G(() => window.__game.teleport(2.4, 5.2))
await wait(8000)
console.log('after meeting Mason → step:', await step())
await shot('1-meet')

for (const [x, z] of [[-6, 14], [7, 15], [15, 1]]) await goAct(x, z + 0.8, 'log')
await goAct(0, 2.6, 'fire')
for (const [x, z] of [[-11, 7.4], [11, 9.4]]) await goAct(x, z + 0.7, 'battery')
await goAct(17.2, -16.2, 'fuse')
await G(() => window.__game.teleport(-18, 0.6))
await wait(300)
await page.keyboard.down('KeyE'); await wait(2700); await page.keyboard.up('KeyE')
console.log('  generator → step:', await step(), '| lamps on:', await G(() => window.__game.world.lamps.every((l) => l.on)))
await wait(1500)
await shot('2-power')

for (const [x, z] of [[-21, 12], [22, -4], [-17, -22]]) {
  await goAct(x, z + 0.7, 'page')
  console.log('    page open:', await page.isVisible('#page'), await page.textContent('#page-title'))
  if (await page.isVisible('#page')) await page.click('#page-close')
}
await shot('3-pages')
await goAct(8, -19.8, 'key')
await goAct(-9, -30.4, 'radio')
await wait(5000)
console.log('finale running:', await step(), '| silas at', await G(() => window.__game.npcs.silas.mesh.position.toArray().map((v) => v.toFixed(0)).join(',')))
await G(() => window.__game.teleport(0, 4))
await wait(3000)
await shot('4-finale')
await G(() => { window.__game.finale().t = 1 })
await wait(2000)
console.log('after finale → step:', await step())
await G(() => window.__game.teleport(-1, -0.5))
await wait(500)
await G(() => window.__game.talk('silas'))
await page.waitForFunction(() => window.__game.state() === 'win', null, { timeout: 300000 }).catch(() => console.log('no win screen'))
await shot('5-win')
console.log('state:', await G(() => window.__game.state()), '| audio:', await G(() => window.__game.audio()))
console.log('voice lines played (in order):', (await G(() => window.__spoke)).join(' '))
console.log('errors:', errors)
await ctx.close()
