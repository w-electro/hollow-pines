// Frame rate while exploring, in a fight, and while a character is thinking.
//   node tests/perf.mjs          (python serve.py running)
import { chromium } from 'playwright-core'

const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache', '--autoplay-policy=no-user-gesture-required'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
await page.goto(process.argv[2] || 'http://localhost:8765/')
await page.waitForFunction(() => window.__game?.state() === 'title', null, { timeout: 900000 })
await page.click('#start')
const G = (fn, a) => page.evaluate(fn, a)
const fps = () => G(() => new Promise((res) => {
  let n = 0, worst = 0, last = performance.now()
  const t0 = last
  const tick = () => {
    const now = performance.now()
    worst = Math.max(worst, now - last)
    last = now
    n++
    if (now - t0 < 4000) requestAnimationFrame(tick)
    else res({ fps: Math.round(n / ((now - t0) / 1000)), worstFrameMs: Math.round(worst) })
  }
  requestAnimationFrame(tick)
}))
await page.waitForTimeout(1500)
console.log('exploring:', JSON.stringify(await fps()))
await G(() => { const g = window.__game; g.player.damage = () => {}; g.shades.spawnNear(6) })
await page.waitForTimeout(3000)
console.log('6 shades:', JSON.stringify(await fps()))
await G(() => { const g = window.__game; g.teleport(2.4, 4.4) })
await page.waitForTimeout(2000)
await G(() => { const g = window.__game; g.talk('mason'); g.send('what should i do now?') })
console.log('while Mason thinks:', JSON.stringify(await fps()))
await ctx.close()
