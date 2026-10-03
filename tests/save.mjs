// Saving: play to the journal, take one page, reload, Continue — is the night still there?
//   node tests/save.mjs      (python serve.py running)
import { chromium } from 'playwright-core'

const ctx = await chromium.launchPersistentContext('D:/W/_scratch/.browser-profile', {
  executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  headless: true,
  viewport: { width: 1280, height: 720 },
  args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan', '--disk-cache-dir=D:/W/_scratch/.browser-cache', '--autoplay-policy=no-user-gesture-required'],
})
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('[pageerror]', e.message))
const G = (fn, a) => page.evaluate(fn, a)
const ready = () => page.waitForFunction(() => window.__game?.state() === 'title', null, { timeout: 900000 })
await page.goto('http://localhost:8765/')
await ready()
await page.click('#start')
await page.waitForTimeout(500)
// jump the story to the journal step the way a player would get there
await G(() => { const g = window.__game; while (g.quests.step().id !== 'pages') g.quests.advance() })
await page.waitForTimeout(300)
await G(() => window.__game.teleport(-21, 12.7))
await page.waitForTimeout(300)
await G(() => window.__game.act())
await page.click('#page-close')
const before = await G(() => ({ step: window.__game.quests.step().id, progress: window.__game.quests.progress, pages: window.__game.items.items.filter((i) => i.kind === 'page' && i.active).length }))
console.log('before reload:', JSON.stringify(before))
await page.evaluate(() => dispatchEvent(new Event('pagehide')))
await page.reload()
await ready()
console.log('continue button visible:', await page.isVisible('#continue'))
await page.click('#continue')
await page.waitForTimeout(500)
const after = await G(() => ({ step: window.__game.quests.step().id, progress: window.__game.quests.progress, pages: window.__game.items.items.filter((i) => i.kind === 'page' && i.active).length, lamps: window.__game.world.lamps.every((l) => l.on) }))
console.log('after continue:', JSON.stringify(after))
console.log(before.step === after.step && before.progress === after.progress && before.pages === after.pages && after.lamps ? 'SAVE OK' : 'SAVE MISMATCH')
await ctx.close()
