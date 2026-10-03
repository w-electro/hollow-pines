// Can you actually hear them? Plays like an impatient player (Start the moment the title
// shows), then measures the voices at the speakers: how long until each line is audible.
//   node tests/hear.mjs [url]
import { chromium } from 'playwright-core'

const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache', '--autoplay-policy=no-user-gesture-required'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
page.on('console', (m) => { if (/voice|error/i.test(m.text()) && !/MODEL_TYPE|404/.test(m.text())) console.log('[console]', m.text().slice(0, 200)) })
const G = (fn, a) => page.evaluate(fn, a)
await page.goto(process.argv[2] || 'http://localhost:8765/')
await page.waitForFunction(() => window.__game?.state() === 'title', null, { timeout: 900000 })
await page.click('#start')

// sample the voice meter in the page, ten times a second
await G(() => {
  window.__voice = []
  const t0 = performance.now()
  setInterval(() => window.__voice.push([Math.round(performance.now() - t0), window.__game.level('voice')]), 100)
})
const heardAfter = async (since, secs) => {
  const until = Date.now() + secs * 1000
  while (Date.now() < until) {
    const hit = await G((s) => window.__voice.find(([t, v]) => t >= s && v > 0.01), since)
    if (hit) return hit
    await page.waitForTimeout(200)
  }
  return null
}
const now = () => G(() => window.__voice.at(-1)?.[0] ?? 0)

await page.waitForTimeout(1500)
let t = await now()
await G(() => window.__game.teleport(2.4, 4.6))
let h = await heardAfter(t, 30)
console.log('Mason greeting:', h ? `heard ${((h[0] - t) / 1000).toFixed(1)}s after walking up (level ${h[1].toFixed(3)})` : 'NOT HEARD in 30s')

await page.waitForTimeout(6000)
await G(() => window.__game.talk('mason'))
t = await now()
await G(() => window.__game.send('what do i need to do?'))
h = await heardAfter(t, 30)
console.log('help question:', h ? `heard after ${((h[0] - t) / 1000).toFixed(1)}s` : 'NOT HEARD in 30s')

await page.waitForTimeout(5000)
t = await now()
await G(() => window.__game.send('are you scared of the dark?'))
h = await heardAfter(t, 40)
console.log('free question (AI line):', h ? `heard after ${((h[0] - t) / 1000).toFixed(1)}s` : 'NOT HEARD in 40s', '| text:', await G(() => window.__game.npcs.mason.bubble.text))
await ctx.close()
